const app = require('./server');
const http = require('http');
const { Client } = require('pg');

const PORT = 3018;
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
  console.log('--- STARTING PHASE 8 CUSTOMER REOPEN WORKFLOW TESTS ---');
  const rand = Math.floor(Math.random() * 100000);
  
  const adminEmail = `admin_re_${rand}@test.com`;
  const agentEmail = `agent_re_${rand}@test.com`;
  const custAEmail = `custa_re_${rand}@test.com`;
  const custBEmail = `custb_re_${rand}@test.com`;
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

    // Setup: Register users
    console.log('\n[Setup] Registering users...');
    const signupAgent = await apiRequest('POST', '/auth/signup', { name: 'Agent', email: agentEmail, password, role: 'agent' });
    const signupCustA = await apiRequest('POST', '/auth/signup', { name: 'Cust A', email: custAEmail, password, role: 'customer' });
    const signupCustB = await apiRequest('POST', '/auth/signup', { name: 'Cust B', email: custBEmail, password, role: 'customer' });
    
    assert(signupAgent.status === 201 && signupAgent.body.token, 'Agent signup succeeds');
    assert(signupCustA.status === 201 && signupCustA.body.token, 'Customer A signup succeeds');
    assert(signupCustB.status === 201 && signupCustB.body.token, 'Customer B signup succeeds');

    const agentToken = signupAgent.body.token;
    const custAToken = signupCustA.body.token;
    const custBToken = signupCustB.body.token;

    const agentId = signupAgent.body.user.id;
    const custAId = signupCustA.body.user.id;
    const custBId = signupCustB.body.user.id;

    // Create admin via DB insert & log in
    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    await dbClient.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      ['Admin User', adminEmail, passwordHash, 'admin']
    );
    const loginAdmin = await apiRequest('POST', '/auth/login', { email: adminEmail, password });
    assert(loginAdmin.status === 200 && loginAdmin.body.token, 'Admin login succeeds');
    const adminToken = loginAdmin.body.token;

    // Create tickets
    console.log('\n[Setup] Creating support tickets...');
    const tA = await apiRequest('POST', '/tickets', { title: 'Ticket Cust A', description: 'desc', category: 'Billing', priority: 'low' }, custAToken);
    const tB = await apiRequest('POST', '/tickets', { title: 'Ticket Cust B', description: 'desc', category: 'General', priority: 'high' }, custBToken);
    
    assert(tA.status === 201 && tA.body.id, 'Customer A ticket created');
    assert(tB.status === 201 && tB.body.id, 'Customer B ticket created');
    
    const tAId = tA.body.id;
    const tBId = tB.body.id;

    // 9, 10, 11. Open ticket cannot be reopened
    console.log('\n[9, 10, 11] Reopen fails on open status...');
    const reopenOpen = await apiRequest('PATCH', `/tickets/${tAId}/reopen`, null, custAToken);
    assert(reopenOpen.status === 400 && reopenOpen.body.error.includes('Only resolved or closed'), 'Cannot reopen open ticket');

    // Assign ticket A & set to in_progress
    await apiRequest('PATCH', `/tickets/${tAId}/assign`, { agent_id: agentId }, adminToken);
    
    // Assigned ticket cannot be reopened
    const reopenAssigned = await apiRequest('PATCH', `/tickets/${tAId}/reopen`, null, custAToken);
    assert(reopenAssigned.status === 400 && reopenAssigned.body.error.includes('Only resolved or closed'), 'Cannot reopen assigned ticket');

    await apiRequest('PATCH', `/tickets/${tAId}/status`, { status: 'in_progress' }, agentToken);
    
    // In-progress ticket cannot be reopened
    const reopenInProgress = await apiRequest('PATCH', `/tickets/${tAId}/reopen`, null, custAToken);
    assert(reopenInProgress.status === 400 && reopenInProgress.body.error.includes('Only resolved or closed'), 'Cannot reopen in-progress ticket');

    // Resolve ticket A
    await apiRequest('PATCH', `/tickets/${tAId}/status`, { status: 'resolved' }, agentToken);
    const checkResolved = await dbClient.query('SELECT resolved_at, updated_at FROM tickets WHERE id = $1', [tAId]);
    const firstResolvedAt = checkResolved.rows[0].resolved_at;
    const firstUpdatedAt = checkResolved.rows[0].updated_at;
    assert(firstResolvedAt !== null, 'resolved_at is populated');

    // --- AUTHORIZATION TESTS ---
    console.log('\n[Authorization] Running privilege checks...');
    
    // 3. Customer A cannot reopen Customer B's ticket
    const diffOwnerReopen = await apiRequest('PATCH', `/tickets/${tBId}/reopen`, null, custAToken);
    assert(diffOwnerReopen.status === 403, 'Customer A cannot reopen Customer B ticket (403)');

    // 4. Agent cannot use reopen endpoint
    const agentReopen = await apiRequest('PATCH', `/tickets/${tAId}/reopen`, null, agentToken);
    assert(agentReopen.status === 403, 'Agent cannot call reopen endpoint (403)');

    // 5. Admin cannot use customer reopen endpoint
    const adminReopen = await apiRequest('PATCH', `/tickets/${tAId}/reopen`, null, adminToken);
    assert(adminReopen.status === 403, 'Admin cannot call reopen endpoint (403)');

    // 6. Unauthenticated request rejected
    const unauthReopen = await apiRequest('PATCH', `/tickets/${tAId}/reopen`, null);
    assert(unauthReopen.status === 401, 'Unauthenticated request rejected (401)');

    // --- REOPEN WORKFLOW TESTS (RESOLVED) ---
    console.log('\n[Reopen resolved] Running resolved -> in_progress reopen...');
    // 1 & 7. Customer A reopens resolved ticket
    const reopenResolved = await apiRequest('PATCH', `/tickets/${tAId}/reopen`, null, custAToken);
    assert(reopenResolved.status === 200, 'Customer A successfully reopens their own resolved ticket');

    // 12, 13, 14, 15. Database checks after reopen
    const dbCheckAfterReopen = await dbClient.query('SELECT * FROM tickets WHERE id = $1', [tAId]);
    const ticketRow = dbCheckAfterReopen.rows[0];
    assert(ticketRow.status === 'in_progress', 'Ticket status becomes in_progress');
    assert(ticketRow.resolved_at === null, 'resolved_at becomes null');
    assert(Number(ticketRow.assigned_agent_id) === Number(agentId), 'Assigned agent remains unchanged');
    assert(new Date(ticketRow.updated_at) > new Date(firstUpdatedAt), 'updated_at is updated');

    // 16, 17, 18. Thread history audit check
    console.log('\n[Thread History] Checking audit responses...');
    const threadCheck = await apiRequest('GET', `/tickets/${tAId}`, null, custAToken);
    const responses = threadCheck.body.responses;
    assert(responses.length >= 1, 'Reopening created thread responses');
    const reopenMessage = responses.find(r => r.message.includes('Customer reopened this ticket'));
    assert(reopenMessage !== undefined, 'Audit reopen message found');
    assert(Number(reopenMessage.sender_id) === Number(custAId), 'Response sender_id is the customer who reopened');

    // 19, 20. Agent Queue checks
    console.log('\n[Agent Queue] Verifying queue visibility & updates...');
    const agentQueue = await apiRequest('GET', '/tickets/queue', null, agentToken);
    const queueTickets = agentQueue.body.data || [];
    const reopenedInQueue = queueTickets.find(t => t.id === tAId);
    assert(reopenedInQueue !== undefined, 'Reopened ticket is present in agent queue');
    assert(reopenedInQueue.status === 'in_progress', 'Reopened ticket status in queue is in_progress');

    // Agent can respond to the reopened ticket
    const agentReply = await apiRequest('POST', `/tickets/${tAId}/respond`, { message: 'Agent reply to reopened ticket' }, agentToken);
    assert(agentReply.status === 201, 'Agent responds to reopened ticket');

    // 21, 22, 23. Agent resolves again & gets new resolved_at
    console.log('\n[Re-resolving] Verifying new resolved_at timestamp...');
    const agentResolveAgain = await apiRequest('PATCH', `/tickets/${tAId}/status`, { status: 'resolved' }, agentToken);
    assert(agentResolveAgain.status === 200, 'Agent resolves the reopened ticket again');

    const dbResolveAgainCheck = await dbClient.query('SELECT resolved_at FROM tickets WHERE id = $1', [tAId]);
    const secondResolvedAt = dbResolveAgainCheck.rows[0].resolved_at;
    assert(secondResolvedAt !== null, 'resolved_at is populated again');
    assert(secondResolvedAt !== firstResolvedAt, 'A new resolved_at timestamp is generated (old timestamp not reused)');

    // --- REOPEN WORKFLOW TESTS (CLOSED) ---
    console.log('\n[Reopen closed] Running closed -> in_progress reopen...');
    // Close it first as Admin
    await apiRequest('PATCH', `/tickets/${tAId}/status`, { status: 'closed' }, adminToken);
    const dbClosedCheck = await dbClient.query('SELECT status FROM tickets WHERE id = $1', [tAId]);
    assert(dbClosedCheck.rows[0].status === 'closed', 'Ticket status set to closed');

    // 2 & 8. Customer A reopens closed ticket
    const reopenClosed = await apiRequest('PATCH', `/tickets/${tAId}/reopen`, null, custAToken);
    assert(reopenClosed.status === 200, 'Customer A successfully reopens closed ticket');

    const dbCheckAfterReopenClosed = await dbClient.query('SELECT status, resolved_at FROM tickets WHERE id = $1', [tAId]);
    assert(dbCheckAfterReopenClosed.rows[0].status === 'in_progress', 'Closed ticket becomes in_progress');
    assert(dbCheckAfterReopenClosed.rows[0].resolved_at === null, 'resolved_at becomes null');

    // 24 & 25. Analytics compatibility
    console.log('\n[Analytics] Checking updated analytics distribution...');
    const analytics = await apiRequest('GET', '/admin/analytics', null, adminToken);
    assert(analytics.status === 200, 'Admin analytics returns 200');
    // Ticket A is reopened (in_progress). Ticket B is open.
    // So openTickets >= 1, inProgressTickets >= 1, resolvedTickets = 0
    assert(analytics.body.inProgressTickets >= 1, 'inProgressTickets updated correctly');
    const agentWorkloadObj = analytics.body.agentWorkload.find(a => a.id === agentId);
    assert(agentWorkloadObj && agentWorkloadObj.activeTickets === 1, 'Agent active tickets workload count is correct (includes reopened ticket)');

    console.log(`\n✅ ALL CUSTOMER REOPEN WORKFLOW TESTS PASSED SUCCESSFULLY! (${assertionCount} assertions passed)`);
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
