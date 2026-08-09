const app = require('./server');
const http = require('http');

const PORT = 3008;
let server;

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
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('--- STARTING PHASE 5 AGENT QUEUE & STATUS WORKFLOW TESTS ---');
  const rand = Math.floor(Math.random() * 100000);
  
  const emailCust = `cust_${rand}@test.com`;
  const emailAgentA = `agentA_${rand}@test.com`;
  const emailAgentB = `agentB_${rand}@test.com`;

  try {
    // 1. Setup users
    console.log('\n[1] Registering users...');
    const custRes = await apiRequest('POST', '/auth/signup', { name: 'Customer A', email: emailCust, password: 'Password123!', role: 'customer' });
    const agentARes = await apiRequest('POST', '/auth/signup', { name: 'Agent A', email: emailAgentA, password: 'Password123!', role: 'agent' });
    const agentBRes = await apiRequest('POST', '/auth/signup', { name: 'Agent B', email: emailAgentB, password: 'Password123!', role: 'agent' });
    const adminLogin = await apiRequest('POST', '/auth/login', { email: 'admin@helpdesk.com', password: 'Admin123!' });

    const custToken = custRes.body.token;
    const agentAToken = agentARes.body.token;
    const agentBToken = agentBRes.body.token;
    const adminToken = adminLogin.body.token;

    const agentAId = agentARes.body.user.id;
    const agentBId = agentBRes.body.user.id;

    assert(custToken && agentAToken && adminToken, 'Login & registration should work');

    // 2. Create ticket
    const ticketRes = await apiRequest('POST', '/tickets', {
      title: 'Agent Test Ticket',
      category: 'Technical Support',
      priority: 'high',
      description: 'Test agent queue'
    }, custToken);
    const ticketId = ticketRes.body.id;
    assert(ticketId, 'Customer should successfully create a ticket');

    // 3. Assign ticket to Agent A
    console.log('\n[2] Assigning ticket to Agent A...');
    const assignRes = await apiRequest('PATCH', `/tickets/${ticketId}/assign`, { agent_id: agentAId }, adminToken);
    assert(assignRes.status === 200, 'Admin should successfully assign the ticket');

    // 4. Retrieve Agent A queue
    console.log('\n[3] Testing Agent A queue retrieval...');
    const queueARes = await apiRequest('GET', '/tickets/queue', null, agentAToken);
    assert(queueARes.status === 200 && queueARes.body.data.length === 1, 'Agent A should see 1 ticket in queue');
    assert(Number(queueARes.body.data[0].id) === Number(ticketId), 'Queue ticket ID must match');

    // 5. Retrieve Agent B queue (must be empty)
    const queueBRes = await apiRequest('GET', '/tickets/queue', null, agentBToken);
    assert(queueBRes.status === 200 && queueBRes.body.data.length === 0, 'Agent B should see 0 tickets in queue');

    // 6. Customer cannot access agent queue
    const custQueueRes = await apiRequest('GET', '/tickets/queue', null, custToken);
    assert(custQueueRes.status === 403, 'Customer must be forbidden from accessing agent queue (403)');

    // 7. Agent A can view assigned ticket detail
    console.log('\n[4] Testing ticket detail access...');
    const detailARes = await apiRequest('GET', `/tickets/${ticketId}`, null, agentAToken);
    assert(detailARes.status === 200, 'Agent A should be allowed to view their assigned ticket');

    // 8. Agent B cannot view Agent A's assigned ticket
    const detailBRes = await apiRequest('GET', `/tickets/${ticketId}`, null, agentBToken);
    assert(detailBRes.status === 403, 'Agent B must be forbidden from viewing Agent A ticket');

    // 9. Agent A can respond to assigned ticket
    console.log('\n[5] Testing ticket responses...');
    const respondARes = await apiRequest('POST', `/tickets/${ticketId}/respond`, { message: 'Agent A response' }, agentAToken);
    assert(respondARes.status === 201, 'Agent A should successfully post response to their assigned ticket');

    // 10. Agent B cannot respond to Agent A's ticket
    const respondBRes = await apiRequest('POST', `/tickets/${ticketId}/respond`, { message: 'Agent B response' }, agentBToken);
    assert(respondBRes.status === 403, 'Agent B must be forbidden from responding to Agent A ticket');

    // 11. Agent A can update status from assigned -> in_progress
    console.log('\n[6] Testing status transitions...');
    const statusInProgressRes = await apiRequest('PATCH', `/tickets/${ticketId}/status`, { status: 'in_progress' }, agentAToken);
    assert(statusInProgressRes.status === 200, 'Agent A can update status from assigned to in_progress');

    // Check assignment after transition
    const check1 = await apiRequest('GET', `/tickets/${ticketId}`, null, agentAToken);
    assert(Number(check1.body.assigned_agent_id) === Number(agentAId) && check1.body.status === 'in_progress', 'Ticket remains assigned to Agent A');

    // 12. Agent A cannot perform invalid status transitions (in_progress -> assigned or in_progress -> closed)
    const invalidTransRes = await apiRequest('PATCH', `/tickets/${ticketId}/status`, { status: 'assigned' }, agentAToken);
    assert(invalidTransRes.status === 400, 'Transition in_progress -> assigned should fail (400)');

    const invalidTransClosedRes = await apiRequest('PATCH', `/tickets/${ticketId}/status`, { status: 'closed' }, agentAToken);
    assert(invalidTransClosedRes.status === 400, 'Agent cannot transition in_progress -> closed directly (400)');

    // 13. Agent A can update status from in_progress -> resolved
    const statusResolvedRes = await apiRequest('PATCH', `/tickets/${ticketId}/status`, { status: 'resolved' }, agentAToken);
    assert(statusResolvedRes.status === 200, 'Agent A can transition status from in_progress to resolved');

    // Check assignment after resolution
    const check2 = await apiRequest('GET', `/tickets/${ticketId}`, null, agentAToken);
    assert(Number(check2.body.assigned_agent_id) === Number(agentAId) && check2.body.status === 'resolved', 'Ticket remains assigned to Agent A after resolution');

    console.log('\n✅ ALL PHASE 5 AGENT QUEUE & STATUS WORKFLOW TESTS PASSED SUCCESSFULLY!');
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
