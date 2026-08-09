const app = require('./server');
const http = require('http');
const { Client } = require('pg');

const PORT = 3017;
let server;
let assertionCount = 0;

function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = { text: data };
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  assertionCount++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('--- STARTING PHASE 7 ADMIN ANALYTICS TESTS ---');
  const rand = Math.floor(Math.random() * 100000);
  const adminEmail = `admin_an_${rand}@test.com`;
  const agentEmail = `agent_an_${rand}@test.com`;
  const customerEmail = `cust_an_${rand}@test.com`;
  const password = 'Password123!';

  // DB client for direct verification
  const dbClient = new Client({
    host: 'db.unkmginhqjvdgeqldzwj.supabase.co',
    port: 5432,
    user: 'postgres',
    password: 'helpdesk@capstone',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await dbClient.connect();

    // 1. Setup users
    console.log('\n[1] Registering users...');
    const signupAgent = await apiRequest('POST', '/auth/signup', { name: 'Agent', email: agentEmail, password, role: 'agent' });
    const signupCust = await apiRequest('POST', '/auth/signup', { name: 'Customer', email: customerEmail, password, role: 'customer' });

    assert(signupAgent.status === 201 && signupAgent.body.token, 'Agent registration succeeds');
    assert(signupCust.status === 201 && signupCust.body.token, 'Customer registration succeeds');

    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const insertAdminRes = await dbClient.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
      ['Admin User', adminEmail, passwordHash, 'admin']
    );
    assert(insertAdminRes.rows.length === 1, 'Admin user inserted directly into DB');
    
    const loginAdmin = await apiRequest('POST', '/auth/login', { email: adminEmail, password });
    assert(loginAdmin.status === 200 && loginAdmin.body.token, 'Admin login succeeds');

    const adminToken = loginAdmin.body.token;
    const agentToken = signupAgent.body.token;
    const custToken = signupCust.body.token;
    const agentId = signupAgent.body.user.id;

    // 2. Authorization Checks
    console.log('\n[2] Checking route access privileges...');
    const custAccess = await apiRequest('GET', '/admin/analytics', null, custToken);
    assert(custAccess.status === 403, 'Customer access to /admin/analytics is forbidden (403)');

    const agentAccess = await apiRequest('GET', '/admin/analytics', null, agentToken);
    assert(agentAccess.status === 403, 'Agent access to /admin/analytics is forbidden (403)');

    const adminAccess = await apiRequest('GET', '/admin/analytics', null, adminToken);
    assert(adminAccess.status === 200, 'Admin access to /admin/analytics is allowed (200)');

    // 3. Create Support Tickets
    console.log('\n[3] Creating tickets for analytics verify...');
    const ticket1 = await apiRequest('POST', '/tickets', { title: 'Ticket Low Priority', description: 'desc', category: 'General', priority: 'low' }, custToken);
    const ticket2 = await apiRequest('POST', '/tickets', { title: 'Ticket High Priority', description: 'desc', category: 'Billing', priority: 'high' }, custToken);
    
    assert(ticket1.status === 201 && ticket1.body.id, 'First ticket created successfully');
    assert(ticket2.status === 201 && ticket2.body.id, 'Second ticket created successfully');
    
    const t1Id = ticket1.body.id;
    const t2Id = ticket2.body.id;

    // 4. Assign Ticket & update to in_progress
    console.log('\n[4] Assigning and transitioning ticket status...');
    const assignRes = await apiRequest('PATCH', `/tickets/${t1Id}/assign`, { agent_id: agentId }, adminToken);
    assert(assignRes.status === 200, 'Admin assigns ticket 1 to agent');

    const updateInProgress = await apiRequest('PATCH', `/tickets/${t1Id}/status`, { status: 'in_progress' }, agentToken);
    assert(updateInProgress.status === 200, 'Agent sets ticket 1 status to in_progress');

    // 5. Verify resolved_at tracking on transition to resolved
    console.log('\n[5] Transitioning ticket to resolved and verifying resolved_at...');
    const checkBefore = await dbClient.query('SELECT resolved_at FROM tickets WHERE id = $1', [t1Id]);
    assert(checkBefore.rows[0].resolved_at === null, 'resolved_at should initially be null');

    const updateResolved = await apiRequest('PATCH', `/tickets/${t1Id}/status`, { status: 'resolved' }, agentToken);
    assert(updateResolved.status === 200, 'Agent sets ticket 1 status to resolved');

    const checkAfter = await dbClient.query('SELECT resolved_at FROM tickets WHERE id = $1', [t1Id]);
    assert(checkAfter.rows[0].resolved_at !== null, 'resolved_at should be updated to current time when resolved');

    // 6. Test GET /admin/analytics structure and aggregates
    console.log('\n[6] Fetching and verifying admin analytics data...');
    const analyticsRes = await apiRequest('GET', '/admin/analytics', null, adminToken);
    assert(analyticsRes.status === 200, 'Analytics endpoint returns 200');

    const data = analyticsRes.body;
    assert(data.totalTickets >= 2, 'Total tickets count matches');
    assert(data.resolvedTickets >= 1, 'Resolved ticket count matches');
    assert(data.openTickets >= 1, 'Open ticket count matches (ticket 2 is still open)');
    
    // Priorities
    assert(data.lowPriority >= 1, 'Low priority count matches');
    assert(data.highPriority >= 1, 'High priority count matches');

    // Password hashes verification
    assert(!data.hasOwnProperty('password_hash'), 'Analytics body must not expose password_hash');

    // 7. Workload check
    console.log('\n[7] Verifying agent workload sorting...');
    assert(Array.isArray(data.agentWorkload), 'agentWorkload should be an array');
    if (data.agentWorkload.length > 0) {
      const activeWorkloadAgent = data.agentWorkload.find(a => a.id === agentId);
      assert(activeWorkloadAgent !== undefined, 'Agent should be present in workload list');
      // Ticket 1 is resolved (not active). Ticket 2 is open (unassigned). So active tickets for agent should be 0.
      assert(activeWorkloadAgent.activeTickets === 0, 'Agent activeTickets count is correct');
    }

    // 8. Order of recent tickets
    console.log('\n[8] Checking order and format of recent tickets...');
    assert(Array.isArray(data.recentTickets), 'recentTickets should be an array');
    assert(data.recentTickets.length >= 2, 'recentTickets should contain created tickets');
    
    const firstRecent = data.recentTickets[0];
    const secondRecent = data.recentTickets[1];
    assert(new Date(firstRecent.created_at) >= new Date(secondRecent.created_at), 'Recent tickets are ordered by created_at DESC');
    assert(firstRecent.customer_email !== undefined, 'Recent ticket should include customer email');

    console.log(`\n✅ ALL ADMIN ANALYTICS TESTS PASSED SUCCESSFULLY! (${assertionCount} assertions passed)`);
  } catch (err) {
    console.error('\n❌ TEST RUN ENCOUNTERED AN EXCEPTION:', err);
    process.exit(1);
  } finally {
    await dbClient.end();
    server.close();
  }
}

server = app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  runTests();
});
