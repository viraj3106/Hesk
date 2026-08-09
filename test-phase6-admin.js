const app = require('./server');
const http = require('http');

const PORT = 3009;
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
  console.log('--- STARTING PHASE 6 ADMIN ENDPOINT & UI WORKFLOW TESTS ---');
  const rand = Math.floor(Math.random() * 100000);
  
  const emailCust = `cust_ph6_${rand}@test.com`;
  const emailAgent = `agent_ph6_${rand}@test.com`;
  const emailNonAgent = `nonagent_ph6_${rand}@test.com`;

  try {
    // 1. Setup users
    console.log('\n[Setup] Registering users...');
    const custRes = await apiRequest('POST', '/auth/signup', { name: 'Customer Ph6', email: emailCust, password: 'Password123!', role: 'customer' });
    const agentRes = await apiRequest('POST', '/auth/signup', { name: 'Agent Ph6', email: emailAgent, password: 'Password123!', role: 'agent' });
    const nonAgentRes = await apiRequest('POST', '/auth/signup', { name: 'NonAgent Ph6', email: emailNonAgent, password: 'Password123!', role: 'customer' });
    const adminLogin = await apiRequest('POST', '/auth/login', { email: 'admin@helpdesk.com', password: 'Admin123!' });

    const custToken = custRes.body.token;
    const agentToken = agentRes.body.token;
    const nonAgentToken = nonAgentRes.body.token;
    const adminToken = adminLogin.body.token;

    const custId = custRes.body.user.id;
    const agentId = agentRes.body.user.id;
    const nonAgentId = nonAgentRes.body.user.id;

    assert(custToken && agentToken && adminToken, 'Login & registration should work');

    // Create a support ticket
    const ticketRes = await apiRequest('POST', '/tickets', {
      title: 'Phase 6 Admin Ticket',
      category: 'Billing',
      priority: 'high',
      description: 'Test admin dashboard'
    }, custToken);
    const ticketId = ticketRes.body.id;
    assert(ticketId, 'Customer should successfully create a ticket');

    // 1. Admin login
    console.log('\n[1] Testing Admin login...');
    assert(adminLogin.status === 200 && adminLogin.body.token, 'Admin should successfully log in');

    // 2. Admin gets all tickets
    console.log('\n[2] Testing Admin gets all tickets...');
    const ticketsRes = await apiRequest('GET', '/admin/tickets', null, adminToken);
    assert(ticketsRes.status === 200 && Array.isArray(ticketsRes.body.data), 'Admin should successfully fetch tickets');
    const hasPh6Ticket = ticketsRes.body.data.some(t => Number(t.id) === Number(ticketId));
    assert(hasPh6Ticket, 'Response should contain the created ticket');

    // 3. Admin gets agents
    console.log('\n[3] Testing Admin gets agents...');
    const agentsRes = await apiRequest('GET', '/admin/agents', null, adminToken);
    assert(agentsRes.status === 200 && Array.isArray(agentsRes.body), 'Admin should successfully fetch agents');
    const hasAgent = agentsRes.body.some(a => Number(a.id) === Number(agentId));
    assert(hasAgent, 'Response should contain the registered agent');

    // 4. Admin workload is correct
    console.log('\n[4] Testing Admin workload details...');
    // Agent Ph6 currently has 0 active tickets
    const agentWorkloadBefore = agentsRes.body.find(a => Number(a.id) === Number(agentId));
    assert(agentWorkloadBefore && agentWorkloadBefore.active_ticket_count === 0, 'Agent active ticket count should be 0 before assignment');

    // 5. Admin stats are correct
    console.log('\n[5] Testing Admin stats...');
    const statsRes = await apiRequest('GET', '/admin/stats', null, adminToken);
    assert(statsRes.status === 200, 'Admin stats request should succeed');
    assert(statsRes.body.total > 0 && statsRes.body.open > 0, 'Admin stats total and open counts should be correct');

    // 6. Admin assigns ticket
    console.log('\n[6] Testing Admin assigns ticket...');
    const assignRes = await apiRequest('PATCH', `/tickets/${ticketId}/assign`, { agent_id: agentId }, adminToken);
    assert(assignRes.status === 200 && assignRes.body.status === 'assigned', 'Admin should assign ticket and update status to assigned');

    // Check workload after assignment
    const agentsResAfter = await apiRequest('GET', '/admin/agents', null, adminToken);
    const agentWorkloadAfter = agentsResAfter.body.find(a => Number(a.id) === Number(agentId));
    assert(agentWorkloadAfter && agentWorkloadAfter.active_ticket_count === 1, 'Agent active ticket count should increment to 1 after assignment');

    // 7. Assigned agent sees ticket in queue
    console.log('\n[7] Testing Assigned agent sees ticket in queue...');
    const agentQueueRes = await apiRequest('GET', '/tickets/queue', null, agentToken);
    assert(agentQueueRes.status === 200 && agentQueueRes.body.data.length >= 1, 'Agent should see ticket in queue');
    const inQueue = agentQueueRes.body.data.some(t => Number(t.id) === Number(ticketId));
    assert(inQueue, 'Queue must contain the assigned ticket');

    // 8. Customer cannot access /admin/tickets
    console.log('\n[8] Testing Customer cannot access /admin/tickets...');
    const custTicketsRes = await apiRequest('GET', '/admin/tickets', null, custToken);
    assert(custTicketsRes.status === 403, 'Customer must receive forbidden error (403)');

    // 9. Customer cannot access /admin/agents
    console.log('\n[9] Testing Customer cannot access /admin/agents...');
    const custAgentsRes = await apiRequest('GET', '/admin/agents', null, custToken);
    assert(custAgentsRes.status === 403, 'Customer must receive forbidden error (403)');

    // 10. Customer cannot access /admin/stats
    console.log('\n[10] Testing Customer cannot access /admin/stats...');
    const custStatsRes = await apiRequest('GET', '/admin/stats', null, custToken);
    assert(custStatsRes.status === 403, 'Customer must receive forbidden error (403)');

    // 11. Agent cannot access admin endpoints
    console.log('\n[11] Testing Agent cannot access admin endpoints...');
    const agentTicketsRes = await apiRequest('GET', '/admin/tickets', null, agentToken);
    assert(agentTicketsRes.status === 403, 'Agent must receive forbidden error (403) for tickets');
    const agentAgentsRes = await apiRequest('GET', '/admin/agents', null, agentToken);
    assert(agentAgentsRes.status === 403, 'Agent must receive forbidden error (403) for agents');
    const agentStatsRes = await apiRequest('GET', '/admin/stats', null, agentToken);
    assert(agentStatsRes.status === 403, 'Agent must receive forbidden error (403) for stats');

    // 12. Agent cannot assign tickets
    console.log('\n[12] Testing Agent cannot assign tickets...');
    const agentAssignRes = await apiRequest('PATCH', `/tickets/${ticketId}/assign`, { agent_id: agentId }, agentToken);
    assert(agentAssignRes.status === 403, 'Agent must receive forbidden error (403) for assignment');

    // 13. Invalid agent_id rejected
    console.log('\n[13] Testing Invalid agent_id rejected...');
    const invalidAssignRes = await apiRequest('PATCH', `/tickets/${ticketId}/assign`, { agent_id: 999999 }, adminToken);
    assert(invalidAssignRes.status === 400, 'Non-existent agent_id should be rejected with 400');

    // 14. Non-agent user cannot be assigned
    console.log('\n[14] Testing Non-agent user cannot be assigned...');
    const nonAgentAssignRes = await apiRequest('PATCH', `/tickets/${ticketId}/assign`, { agent_id: nonAgentId }, adminToken);
    assert(nonAgentAssignRes.status === 400, 'Non-agent role user should be rejected with 400');

    console.log(`\n✅ ALL PHASE 6 ADMIN ENDPOINT & UI WORKFLOW TESTS PASSED SUCCESSFULLY! (${assertionCount} assertions passed)`);
  } catch (err) {
    console.error('\n❌ TEST RUN ENCOUNTERED AN EXCEPTION:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

server = app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  runTests();
});
