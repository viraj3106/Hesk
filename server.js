require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('./database');
const { authenticateJWT, requireRole, JWT_SECRET } = require('./middleware/auth');

// Temporary stubs for SQLite helpers to keep other routes compilable during migration
const initDb = async () => {};
const dbGet = async () => null;
const dbAll = async () => [];
const dbRun = async () => ({ id: 1 });

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static('public'));

// Legal transition lookup table
const LEGAL_TRANSITIONS = {
  'open': ['assigned'],
  'assigned': ['in_progress'],
  'in_progress': ['resolved'],
  'resolved': ['closed', 'in_progress'], // in_progress via customer reopen
  'closed': ['in_progress'] // in_progress via customer reopen
};

// ---------------- AUTH ROUTES ----------------

// Signup Route (primarily for customers and agents)
app.post('/auth/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  if (!['customer', 'agent'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Check duplicate email
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email);

    if (checkError) {
      return res.status(500).json({ error: checkError.message });
    }
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert([{ name, email, password_hash: passwordHash, role }])
      .select();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    const user = inserted[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login Route
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data: user, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (selectError) {
      return res.status(500).json({ error: selectError.message });
    }
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/forgot-password
app.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const genericResponse = {
    success: true,
    message: 'If an account exists, password reset instructions have been sent.'
  };

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (user) {
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

      const { error: insertError } = await supabase
        .from('password_reset_tokens')
        .insert([{
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
          used: false
        }]);

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }

      console.log(`[DEV ONLY] Password reset token for ${email}: ${token}`);

      const fs = require('fs');
      try {
        fs.writeFileSync('reset_token_dev.json', JSON.stringify({ email, token }));
      } catch (err) {
        console.error('Failed to write dev reset token file:', err.message);
      }
    }

    return res.json(genericResponse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/reset-password
app.post('/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data: resetTokenRecord, error: fetchError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('used', false)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }
    if (!resetTokenRecord) {
      return res.status(400).json({ error: 'Invalid or already used reset token' });
    }

    const expiresAt = new Date(resetTokenRecord.expires_at);
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', resetTokenRecord.user_id);

    if (userUpdateError) {
      return res.status(500).json({ error: userUpdateError.message });
    }

    const { error: tokenUpdateError } = await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', resetTokenRecord.id);

    if (tokenUpdateError) {
      return res.status(500).json({ error: tokenUpdateError.message });
    }

    const fs = require('fs');
    try {
      if (fs.existsSync('reset_token_dev.json')) {
        fs.unlinkSync('reset_token_dev.json');
      }
    } catch (err) {}

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for validating tickets
async function getTicketOr404(req, res, id) {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return null;
  }
  return ticket;
}

// ---------------- TICKET ROUTES ----------------

// POST /tickets — Create ticket (customer only)
app.post('/tickets', authenticateJWT, requireRole(['customer']), async (req, res) => {
  const { title, category, priority, description } = req.body;
  if (!title || !category || !priority || !description) {
    return res.status(400).json({ error: 'Title, category, priority, and description are required' });
  }
  if (!['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  try {
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert([
        {
          title,
          category,
          priority,
          description,
          customer_id: req.user.id,
          status: 'open'
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tickets/my — Retrieve customer's tickets (customer only)
app.get('/tickets/my', authenticateJWT, requireRole(['customer']), async (req, res) => {
  try {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('customer_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tickets/queue — Retrieve agent's queue (agent only, paginated)
app.get('/tickets/queue', authenticateJWT, requireRole(['agent']), async (req, res) => {
  const statusFilter = req.query.status;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('tickets')
      .select('*', { count: 'exact' })
      .eq('assigned_agent_id', req.user.id);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    query = query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: tickets, count, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      data: tickets || [],
      page,
      limit,
      total: count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tickets/:id — View ticket details (customer of ticket, assigned agent, admin)
app.get('/tickets/:id', authenticateJWT, async (req, res) => {
  try {
    const ticket = await getTicketOr404(req, res, req.params.id);
    if (!ticket) return;

    // RBAC: customer must own it, agent must be assigned to it, admin can access all
    if (req.user.role === 'customer' && Number(ticket.customer_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access forbidden: not your ticket' });
    }
    if (req.user.role === 'agent' && Number(ticket.assigned_agent_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access forbidden: not assigned to you' });
    }

    // Retrieve responses
    const { data: responses, error: respError } = await supabase
      .from('responses')
      .select('*, users:sender_id (email, role)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });

    if (respError) {
      return res.status(500).json({ error: respError.message });
    }

    const flatResponses = (responses || []).map(r => ({
      id: r.id,
      ticket_id: r.ticket_id,
      sender_id: r.sender_id,
      message: r.message,
      created_at: r.created_at,
      email: r.users ? r.users.email : '',
      role: r.users ? r.users.role : ''
    }));

    res.json({ ...ticket, responses: flatResponses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tickets/:id/respond — Post response on ticket
app.post('/tickets/:id/respond', authenticateJWT, async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const ticket = await getTicketOr404(req, res, req.params.id);
    if (!ticket) return;

    // RBAC check
    if (req.user.role === 'customer' && Number(ticket.customer_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access forbidden: not your ticket' });
    }
    if (req.user.role === 'agent' && Number(ticket.assigned_agent_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access forbidden: not assigned to you' });
    }

    // Insert response
    const { error: insertError } = await supabase
      .from('responses')
      .insert([
        {
          ticket_id: ticket.id,
          sender_id: req.user.id,
          message: message.trim()
        }
      ]);

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    // Bump ticket updated_at
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticket.id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.status(201).json({ message: 'Response added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /tickets/:id/status — Update ticket status
app.patch('/tickets/:id/status', authenticateJWT, requireRole(['agent', 'admin']), async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const ticket = await getTicketOr404(req, res, req.params.id);
    if (!ticket) return;

    // RBAC check: Agent must be the assigned agent, admin can do all
    if (req.user.role === 'agent' && Number(ticket.assigned_agent_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access forbidden: not assigned to you' });
    }

    // Validate Transition Rules
    const currentStatus = ticket.status;
    const allowed = LEGAL_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid transition from ${currentStatus} to ${status}` });
    }

    // assigned_agent_id must be set before status can move past 'assigned'
    if (status !== 'assigned' && !ticket.assigned_agent_id) {
      return res.status(400).json({ error: 'Cannot transition status past assigned without an assigned agent' });
    }

    // Update
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticket.id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ message: `Status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /tickets/:id/assign — Assign ticket (admin only)
app.patch('/tickets/:id/assign', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const { agent_id } = req.body;
  if (!agent_id) {
    return res.status(400).json({ error: 'Agent ID is required' });
  }

  try {
    const ticket = await getTicketOr404(req, res, req.params.id);
    if (!ticket) return;

    // Verify agent_id is indeed an agent
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('role')
      .eq('id', agent_id)
      .maybeSingle();

    if (agentError) {
      return res.status(500).json({ error: agentError.message });
    }
    if (!agent || agent.role !== 'agent') {
      return res.status(400).json({ error: 'Invalid agent ID' });
    }

    // Update
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        assigned_agent_id: agent_id,
        status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticket.id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ message: 'Ticket assigned successfully', assigned_agent_id: agent_id, status: 'assigned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /tickets/:id/reopen — Reopen resolved/closed ticket (customer only)
app.patch('/tickets/:id/reopen', authenticateJWT, requireRole(['customer']), async (req, res) => {
  try {
    const ticket = await getTicketOr404(req, res, req.params.id);
    if (!ticket) return;

    // Must own the ticket
    if (ticket.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access forbidden: not your ticket' });
    }

    // Must be resolved or closed
    if (!['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ error: 'Only resolved or closed tickets can be reopened' });
    }

    // Reopen -> in_progress
    await dbRun(
      "UPDATE tickets SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [ticket.id]
    );

    res.json({ message: 'Ticket reopened successfully', status: 'in_progress' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- ADMIN ROUTES ----------------

// GET /admin/tickets — Paginated list of all tickets
app.get('/admin/tickets', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const statusFilter = req.query.status;
  const priorityFilter = req.query.priority;
  const agentFilter = req.query.assigned_agent_id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('tickets')
      .select('*, customer:customer_id (name, email), agent:assigned_agent_id (name, email)', { count: 'exact' });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    if (priorityFilter) {
      query = query.eq('priority', priorityFilter);
    }
    if (agentFilter) {
      if (agentFilter === 'unassigned') {
        query = query.is('assigned_agent_id', null);
      } else {
        query = query.eq('assigned_agent_id', agentFilter);
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: tickets, count, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const formattedTickets = (tickets || []).map(t => ({
      id: t.id,
      title: t.title,
      category: t.category,
      priority: t.priority,
      status: t.status,
      customer_id: t.customer_id,
      customer_name: t.customer ? t.customer.name : null,
      customer_email: t.customer ? t.customer.email : null,
      assigned_agent_id: t.assigned_agent_id,
      agent_name: t.agent ? t.agent.name : null,
      agent_email: t.agent ? t.agent.email : null,
      created_at: t.created_at,
      updated_at: t.updated_at
    }));

    res.json({
      data: formattedTickets,
      page,
      limit,
      total: count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/agents — Agents list with ticket counts for workload view
app.get('/admin/agents', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'agent');

    if (agentsError) {
      return res.status(500).json({ error: agentsError.message });
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('assigned_agent_id')
      .in('status', ['assigned', 'in_progress']);

    if (ticketsError) {
      return res.status(500).json({ error: ticketsError.message });
    }

    const countsMap = {};
    (tickets || []).forEach(t => {
      if (t.assigned_agent_id) {
        countsMap[t.assigned_agent_id] = (countsMap[t.assigned_agent_id] || 0) + 1;
      }
    });

    const result = (agents || []).map(agent => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      active_ticket_count: countsMap[agent.id] || 0
    }));

    result.sort((a, b) => b.active_ticket_count - a.active_ticket_count);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/stats — Overall ticket statistics
app.get('/admin/stats', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('status, created_at, updated_at');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'open').length;
    const assigned = tickets.filter(t => t.status === 'assigned').length;
    const in_progress = tickets.filter(t => t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    const closed = tickets.filter(t => t.status === 'closed').length;

    const resolvedClosedTickets = tickets.filter(t => ['resolved', 'closed'].includes(t.status));
    let avg_resolution_days = 0;
    if (resolvedClosedTickets.length > 0) {
      const totalDays = resolvedClosedTickets.reduce((sum, t) => {
        const created = new Date(t.created_at);
        const updated = new Date(t.updated_at);
        const diffMs = updated - created;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return sum + Math.max(0, diffDays);
      }, 0);
      avg_resolution_days = parseFloat((totalDays / resolvedClosedTickets.length).toFixed(2));
    }

    res.json({
      total,
      open,
      assigned,
      in_progress,
      resolved,
      closed,
      avg_resolution_days
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to initialize database:', err);
  });
}

module.exports = app; // For testing
