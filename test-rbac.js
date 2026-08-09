const app = require('./server');
const { db } = require('./database');
const http = require('http');

const PORT = 3001;
let server;

// Helper to make HTTP requests
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

async function runTests() {
  console.log('--- STARTING RBAC AND TRANSITION TESTS ---');
  
  // Wait a bit for database initialization to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Define test cases
  try {
    // 1. Signup test users
    console.log('\n[1] Creating test users...');
    const custARes = await apiRequest('POST', '/auth/signup', { email: 'customerA@test.com', password: 'Password123!', role: 'customer' });
    const custBRes = await apiRequest('POST', '/auth/signup', { email: 'customerB@test.com', password: 'Password123!', role: 'customer' });
    const agentARes = await apiRequest('POST', '/auth/signup', { email: 'agentA@test.com', password: 'Password123!', role: 'agent' });
    const agentBRes = await apiRequest('POST', '/auth/signup', { email: 'agentB@test.com', password: 'Password123!', role: 'agent' });
    
    // Login Admin
    const adminRes = await apiRequest('POST', '/auth/login', { email: 'admin@helpdesk.com', password: 'Admin123!' });

    const custAToken = custARes.body.token;
    const custBToken = custBRes.body.token;
    const agentAToken = agentARes.body.token;
    const agentBToken = agentBRes.body.token;
    const adminToken = adminRes.body.token;

    const agentAId = agentARes.body.user.id;

    console.log('Test users created successfully.');

    // 2. Ticket Creation RBAC
    console.log('\n[2] Testing Ticket Creation RBAC...');
    // Customer can create ticket
    const ticketRes = await apiRequest('POST', '/tickets', { title: 'Test Ticket A', description: 'Need help ASAP' }, custAToken);
    assert(ticketRes.status === 201, 'Customer A should be able to create a ticket');
    const ticketId = ticketRes.body.id;

    // Agent/Admin cannot create ticket
    const agentCreateRes = await apiRequest('POST', '/tickets', { title: 'Agent Ticket', description: 'Should fail' }, agentAToken);
    assert(agentCreateRes.status === 403, 'Agent should not be allowed to create a ticket (403)');

    const adminCreateRes = await apiRequest('POST', '/tickets', { title: 'Admin Ticket', description: 'Should fail' }, adminToken);
    assert(adminCreateRes.status === 403, 'Admin should not be allowed to create a ticket (403)');

    // 3. Ticket GET /tickets/my RBAC
    console.log('\n[3] Testing /tickets/my RBAC...');
    const custMyRes = await apiRequest('GET', '/tickets/my', null, custAToken);
    assert(custMyRes.status === 200 && custMyRes.body.length > 0, 'Customer A should get their tickets');

    const agentMyRes = await apiRequest('GET', '/tickets/my', null, agentAToken);
    assert(agentMyRes.status === 403, 'Agent should not access /tickets/my (403)');

    // 4. Ticket Detail GET /tickets/:id RBAC
    console.log('\n[4] Testing GET /tickets/:id RBAC...');
    // Customer A can view own ticket
    const custViewOwn = await apiRequest('GET', `/tickets/${ticketId}`, null, custAToken);
    assert(custViewOwn.status === 200, 'Customer A should be able to view their own ticket');

    // Customer B cannot view Customer A's ticket
    const custViewOther = await apiRequest('GET', `/tickets/${ticketId}`, null, custBToken);
    assert(custViewOther.status === 403, 'Customer B should be forbidden from viewing Customer A ticket (403)');

    // Agent A cannot view Customer A's ticket yet (not assigned)
    const agentViewUnassigned = await apiRequest('GET', `/tickets/${ticketId}`, null, agentAToken);
    assert(agentViewUnassigned.status === 403, 'Agent A should be forbidden from viewing unassigned ticket (403)');

    // Admin can view Customer A's ticket
    const adminView = await apiRequest('GET', `/tickets/${ticketId}`, null, adminToken);
    assert(adminView.status === 200, 'Admin should be allowed to view any ticket');

    // 5. Assign Ticket /tickets/:id/assign RBAC & Transition
    console.log('\n[5] Testing PATCH /tickets/:id/assign...');
    // Customer cannot assign
    const custAssign = await apiRequest('PATCH', `/tickets/${ticketId}/assign`, { agent_id: agentAId }, custAToken);
    assert(custAssign.status === 403, 'Customer cannot assign ticket (403)');

    // Agent cannot assign
    const agentAssign = await apiRequest('PATCH', `/tickets/${ticketId}/assign`, { agent_id: agentAId }, agentAToken);
    assert(agentAssign.status === 403, 'Agent cannot assign ticket (403)');

    // Admin can assign
    const adminAssign = await apiRequest('PATCH', `/tickets/${ticketId}/assign`, { agent_id: agentAId }, adminToken);
    assert(adminAssign.status === 200 && adminAssign.body.status === 'assigned', 'Admin should assign ticket and update status to assigned');

    // 6. Assigned Agent View
    console.log('\n[6] Testing Assigned Agent access...');
    // Agent A can now view ticket since they are assigned
    const agentViewAssigned = await apiRequest('GET', `/tickets/${ticketId}`, null, agentAToken);
    assert(agentViewAssigned.status === 200, 'Assigned Agent A should now be able to view the ticket');

    // Agent B still cannot view it
    const agentBViewAssigned = await apiRequest('GET', `/tickets/${ticketId}`, null, agentBToken);
    assert(agentBViewAssigned.status === 403, 'Unassigned Agent B should still be forbidden (403)');

    // 7. Responses /tickets/:id/respond RBAC
    console.log('\n[7] Testing POST /tickets/:id/respond...');
    // Owner customer can respond
    const custRespond = await apiRequest('POST', `/tickets/${ticketId}/respond`, { message: 'Customer response' }, custAToken);
    assert(custRespond.status === 201, 'Owner customer can respond');

    // Assigned agent can respond
    const agentRespond = await apiRequest('POST', `/tickets/${ticketId}/respond`, { message: 'Agent response' }, agentAToken);
    assert(agentRespond.status === 201, 'Assigned agent can respond');

    // Unassigned customer B cannot respond
    const custBRespond = await apiRequest('POST', `/tickets/${ticketId}/respond`, { message: 'Intruder response' }, custBToken);
    assert(custBRespond.status === 403, 'Other customer cannot respond (403)');

    // Unassigned agent B cannot respond
    const agentBRespond = await apiRequest('POST', `/tickets/${ticketId}/respond`, { message: 'Intruder response' }, agentBToken);
    assert(agentBRespond.status === 403, 'Unassigned agent cannot respond (403)');

    // 8. Status transition rules /tickets/:id/status RBAC & Validation
    console.log('\n[8] Testing Status Transition validation...');
    // Currently status is 'assigned'. Let's try transitioning to 'resolved' (invalid: must go to in_progress first)
    const invalidStatusTransition = await apiRequest('PATCH', `/tickets/${ticketId}/status`, { status: 'resolved' }, agentAToken);
    assert(invalidStatusTransition.status === 400, 'Transition assigned -> resolved should fail with 400');

    // Valid transition: assigned -> in_progress
    const validStatusTransition1 = await apiRequest('PATCH', `/tickets/${ticketId}/status`, { status: 'in_progress' }, agentAToken);
    assert(validStatusTransition1.status === 200, 'Transition assigned -> in_progress should succeed (200)');

    // Unassigned Agent B cannot change status
    const agentBChangeStatus = await apiRequest('PATCH', `/tickets/${ticketId}/status`, { status: 'resolved' }, agentBToken);
    assert(agentBChangeStatus.status === 403, 'Unassigned agent cannot update status (403)');

    // Customer cannot change status
    const custChangeStatus = await apiRequest('PATCH', `/tickets/${ticketId}/status`, { status: 'resolved' }, custAToken);
    assert(custChangeStatus.status === 403, 'Customer cannot update status via status endpoint (403)');

    // Valid transition: in_progress -> resolved
    const validStatusTransition2 = await apiRequest('PATCH', `/tickets/${ticketId}/status`, { status: 'resolved' }, agentAToken);
    assert(validStatusTransition2.status === 200, 'Transition in_progress -> resolved should succeed (200)');

    // 9. Reopen Ticket /tickets/:id/reopen RBAC & Transition
    console.log('\n[9] Testing Ticket Reopening...');
    // Agent cannot reopen
    const agentReopen = await apiRequest('PATCH', `/tickets/${ticketId}/reopen`, null, agentAToken);
    assert(agentReopen.status === 403, 'Agent cannot reopen ticket (403)');

    // Customer A can reopen
    const custReopen = await apiRequest('PATCH', `/tickets/${ticketId}/reopen`, null, custAToken);
    assert(custReopen.status === 200 && custReopen.body.status === 'in_progress', 'Customer A should reopen ticket to in_progress');

    // Reopen fails if status is not resolved/closed (since status is now in_progress)
    const custReopenAgain = await apiRequest('PATCH', `/tickets/${ticketId}/reopen`, null, custAToken);
    assert(custReopenAgain.status === 400, 'Reopen should fail if ticket is already active/in_progress (400)');

    // 10. Agent Queue pagination & access
    console.log('\n[10] Testing Agent Queue...');
    const agentQueueRes = await apiRequest('GET', '/tickets/queue', null, agentAToken);
    assert(agentQueueRes.status === 200 && Array.isArray(agentQueueRes.body.data), 'Agent can fetch queue');

    const customerQueueRes = await apiRequest('GET', '/tickets/queue', null, custAToken);
    assert(customerQueueRes.status === 403, 'Customer cannot fetch agent queue (403)');

    // 11. Admin Endpoints
    console.log('\n[11] Testing Admin Endpoints...');
    const adminTicketsRes = await apiRequest('GET', '/admin/tickets', null, adminToken);
    assert(adminTicketsRes.status === 200 && Array.isArray(adminTicketsRes.body.data), 'Admin can view all tickets');

    const adminAgentsRes = await apiRequest('GET', '/admin/agents', null, adminToken);
    assert(adminAgentsRes.status === 200 && Array.isArray(adminAgentsRes.body), 'Admin can view agents workload');

    const adminStatsRes = await apiRequest('GET', '/admin/stats', null, adminToken);
    assert(adminStatsRes.status === 200 && typeof adminStatsRes.body.total === 'number', 'Admin can view stats');

    // Customer/Agent cannot access admin endpoints
    const agentAdminTickets = await apiRequest('GET', '/admin/tickets', null, agentAToken);
    assert(agentAdminTickets.status === 403, 'Agent cannot access admin tickets (403)');

    const custAdminStats = await apiRequest('GET', '/admin/stats', null, custAToken);
    assert(custAdminStats.status === 403, 'Customer cannot access admin stats (403)');

    console.log('\n✅ ALL RBAC & TRANSITION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ TEST SUITE RUN ENCOUNTERED AN EXCEPTION:', err);
    process.exit(1);
  } finally {
    server.close();
    db.close();
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
  }
}

// Start temporary test server
server = app.listen(PORT, () => {
  console.log(`Test server listening on port ${PORT}`);
  runTests();
});
