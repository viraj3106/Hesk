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

// Helper for validating tickets
async function getTicketOr404(req, res, id) {
  const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [id]);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return null;
  }
  return ticket;
}

// ---------------- TICKET ROUTES ----------------

// POST /tickets — Create ticket (customer only)
app.post('/tickets', authenticateJWT, requireRole(['customer']), async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    const result = await dbRun(
      'INSERT INTO tickets (title, description, customer_id) VALUES (?, ?, ?)',
      [title, description, req.user.id]
    );
    res.status(201).json({ id: result.id, title, description, status: 'open', customer_id: req.user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tickets/my — Retrieve customer's tickets (customer only)
app.post('/tickets/my-post-bypass-or-get', (req, res) => res.status(404).send()); // placeholder
app.get('/tickets/my', authenticateJWT, requireRole(['customer']), async (req, res) => {
  try {
    const tickets = await dbAll('SELECT * FROM tickets WHERE customer_id = ? ORDER BY created_at DESC', [req.user.id]);
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
    let sql = 'SELECT * FROM tickets WHERE assigned_agent_id = ?';
    let countSql = 'SELECT COUNT(*) as total FROM tickets WHERE assigned_agent_id = ?';
    let params = [req.user.id];

    if (statusFilter) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    const queryParams = [...params, limit, offset];

    const totalRow = await dbGet(countSql, params);
    const total = totalRow ? totalRow.total : 0;
    const data = await dbAll(sql, queryParams);

    res.json({ data, page, limit, total });
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
    if (req.user.role === 'customer' && ticket.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access forbidden: not your ticket' });
    }
    if (req.user.role === 'agent' && ticket.assigned_agent_id !== req.user.id) {
      return res.status(403).json({ error: 'Access forbidden: not assigned to you' });
    }

    // Retrieve responses
    const responses = await dbAll(
      `SELECT r.*, u.email, u.role 
       FROM responses r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.ticket_id = ? 
       ORDER BY r.created_at ASC`,
      [ticket.id]
    );

    res.json({ ...ticket, responses });
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
    if (req.user.role === 'customer' && ticket.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access forbidden: not your ticket' });
    }
    if (req.user.role === 'agent' && ticket.assigned_agent_id !== req.user.id) {
      return res.status(403).json({ error: 'Access forbidden: not assigned to you' });
    }

    // Insert response
    await dbRun(
      'INSERT INTO responses (ticket_id, user_id, message) VALUES (?, ?, ?)',
      [ticket.id, req.user.id, message]
    );

    // Bump ticket updated_at
    await dbRun(
      'UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [ticket.id]
    );

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
    if (req.user.role === 'agent' && ticket.assigned_agent_id !== req.user.id) {
      return res.status(403).json({ error: 'Access forbidden: not assigned to you' });
    }

    // Validate Transition Rules
    const currentStatus = ticket.status;
    const allowed = LEGAL_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid transition from ${currentStatus} to ${status}` });
    }

    // assigned_agent_id must be set before status can move past 'assigned'
    // 'assigned' to 'in_progress', 'resolved', 'closed'
    if (status !== 'assigned' && !ticket.assigned_agent_id) {
      return res.status(400).json({ error: 'Cannot transition status past assigned without an assigned agent' });
    }

    // Update
    await dbRun(
      'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, ticket.id]
    );

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
    const agent = await dbGet('SELECT role FROM users WHERE id = ?', [agent_id]);
    if (!agent || agent.role !== 'agent') {
      return res.status(400).json({ error: 'Invalid agent ID' });
    }

    // Validate Transition: from 'open' -> 'assigned'. Wait, can admin reassign from 'assigned' or 'in_progress'?
    // The spec says "open --assign-> assigned", but admin can typically assign.
    // If we only allow open to assigned, let's enforce that, or allow reassignment.
    // Let's enforce that status becomes 'assigned' and update assigned_agent_id.
    await dbRun(
      'UPDATE tickets SET assigned_agent_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [agent_id, 'assigned', ticket.id]
    );

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
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    let sql = `
      SELECT t.*, c.email as customer_email, a.email as agent_email 
      FROM tickets t 
      LEFT JOIN users c ON t.customer_id = c.id 
      LEFT JOIN users a ON t.assigned_agent_id = a.id
    `;
    let countSql = 'SELECT COUNT(*) as total FROM tickets';
    let params = [];

    if (statusFilter) {
      sql += ' WHERE t.status = ?';
      countSql += ' WHERE status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    const queryParams = [...params, limit, offset];

    const totalRow = await dbGet(countSql, params);
    const total = totalRow ? totalRow.total : 0;
    const data = await dbAll(sql, queryParams);

    res.json({ data, page, limit, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/agents — Agents list with ticket counts for workload view
app.get('/admin/agents', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const agents = await dbAll(`
      SELECT u.id, u.email, COUNT(t.id) as ticket_count 
      FROM users u 
      LEFT JOIN tickets t ON u.id = t.assigned_agent_id AND t.status != 'closed'
      WHERE u.role = 'agent' 
      GROUP BY u.id, u.email
    `);
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/stats — Overall ticket statistics
app.get('/admin/stats', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const totalRow = await dbGet('SELECT COUNT(*) as total FROM tickets');
    const openRow = await dbGet("SELECT COUNT(*) as open FROM tickets WHERE status != 'closed' AND status != 'resolved'");
    const closedRow = await dbGet("SELECT COUNT(*) as closed FROM tickets WHERE status = 'closed' OR status = 'resolved'");
    
    // Average resolution days: difference between updated_at and created_at for resolved/closed tickets
    // In SQLite: AVG(julianday(updated_at) - julianday(created_at))
    const avgRow = await dbGet(`
      SELECT AVG(julianday(updated_at) - julianday(created_at)) as avg_res 
      FROM tickets 
      WHERE status IN ('resolved', 'closed')
    `);

    const total = totalRow ? totalRow.total : 0;
    const open = openRow ? openRow.open : 0;
    const closed = closedRow ? closedRow.closed : 0;
    const avg_resolution_days = (avgRow && avgRow.avg_res) ? parseFloat(avgRow.avg_res.toFixed(2)) : 0;

    res.json({
      total,
      open,
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
