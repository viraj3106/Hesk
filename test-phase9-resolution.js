// test-phase9-resolution.js
const BASE_URL = 'http://localhost:8080';

// Helper to generate unique emails
const randomEmail = (role) => `${role}_${Math.random().toString(36).substring(2, 10)}@test.com`;

let customerAToken, customerBToken, agentToken, adminToken;
let customerAId, customerBId, agentId, adminId;
let ticketId;

let assertionsPassed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  assertionsPassed++;
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('--- STARTING PHASE 9 TICKET RESOLUTION TESTS ---');

  // 1. Sign up Customer A
  const emailA = randomEmail('customer');
  const resSignupA = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Customer A', email: emailA, password: 'Password123!', role: 'customer' })
  });
  const dataA = await resSignupA.json();
  assert(resSignupA.status === 201, 'Customer A signed up successfully');
  customerAToken = dataA.token;
  customerAId = dataA.user.id;

  // 2. Sign up Customer B
  const emailB = randomEmail('customer');
  const resSignupB = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Customer B', email: emailB, password: 'Password123!', role: 'customer' })
  });
  const dataB = await resSignupB.json();
  assert(resSignupB.status === 201, 'Customer B signed up successfully');
  customerBToken = dataB.token;
  customerBId = dataB.user.id;

  // 3. Sign up Agent
  const emailAgent = randomEmail('agent');
  const resSignupAgent = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Agent X', email: emailAgent, password: 'Password123!', role: 'agent' })
  });
  const dataAgent = await resSignupAgent.json();
  assert(resSignupAgent.status === 201, 'Agent signed up successfully');
  agentToken = dataAgent.token;
  agentId = dataAgent.user.id;

  // 4. Log in Admin
  const resLoginAdmin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@helpdesk.com', password: 'Admin123!' })
  });
  const dataAdmin = await resLoginAdmin.json();
  assert(resLoginAdmin.status === 200, 'Admin logged in successfully');
  adminToken = dataAdmin.token;
  adminId = dataAdmin.user.id;

  // 5. Customer A Creates Ticket
  const resCreateTicket = await fetch(`${BASE_URL}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerAToken}`
    },
    body: JSON.stringify({
      title: 'Broken Authentication',
      category: 'Security',
      priority: 'high',
      description: 'The login page fails intermittently with a 500 error.'
    })
  });
  const ticketData = await resCreateTicket.json();
  assert(resCreateTicket.status === 201, 'Customer A created ticket');
  ticketId = ticketData.id;

  // 6. Admin assigns Agent to the ticket
  const resAssign = await fetch(`${BASE_URL}/tickets/${ticketId}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ agent_id: agentId })
  });
  assert(resAssign.status === 200, 'Admin assigned ticket to Agent');

  // 7. Agent starts work (changes status to in_progress)
  const resWork = await fetch(`${BASE_URL}/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentToken}`
    },
    body: JSON.stringify({ status: 'in_progress' })
  });
  assert(resWork.status === 200, 'Agent transitioned ticket to in_progress');

  // 8. Agent resolves ticket
  const resResolve = await fetch(`${BASE_URL}/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentToken}`
    },
    body: JSON.stringify({ status: 'resolved' })
  });
  assert(resResolve.status === 200, 'Agent transitioned ticket to resolved');

  // 9. Customer B (unauthorized) tries to close Customer A's ticket
  const resCloseB = await fetch(`${BASE_URL}/tickets/${ticketId}/close`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerBToken}`
    }
  });
  assert(resCloseB.status === 403, 'Customer B cannot close Customer A ticket (403 Forbidden)');

  // 10. Customer B (unauthorized) tries to reopen Customer A's ticket
  const resReopenB = await fetch(`${BASE_URL}/tickets/${ticketId}/reopen`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerBToken}`
    },
    body: JSON.stringify({ reason: 'Still broken' })
  });
  assert(resReopenB.status === 403, 'Customer B cannot reopen Customer A ticket (403 Forbidden)');

  // 11. Customer A attempts to reopen without a reason
  const resReopenNoReason = await fetch(`${BASE_URL}/tickets/${ticketId}/reopen`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerAToken}`
    },
    body: JSON.stringify({ reason: '' })
  });
  assert(resReopenNoReason.status === 400, 'Reopen fails with bad request (400) when reason is empty');

  // 12. Customer A accepts resolution (closes the ticket)
  const resCloseA = await fetch(`${BASE_URL}/tickets/${ticketId}/close`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerAToken}`
    }
  });
  const closeData = await resCloseA.json();
  assert(resCloseA.status === 200, 'Customer A accepted resolution and closed ticket');
  assert(closeData.status === 'closed', 'Ticket status is closed');

  // 13. Customer A reopens the closed ticket with a valid reason
  const reopenReason = 'The issue is still occurring after testing.';
  const resReopenA = await fetch(`${BASE_URL}/tickets/${ticketId}/reopen`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerAToken}`
    },
    body: JSON.stringify({ reason: reopenReason })
  });
  const reopenData = await resReopenA.json();
  assert(resReopenA.status === 200, 'Customer A reopened the closed ticket');
  assert(reopenData.status === 'in_progress', 'Reopened status is back to in_progress');

  // 14. Verify reopen reason is in the ticket thread/responses
  const resDetails = await fetch(`${BASE_URL}/tickets/${ticketId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerAToken}`
    }
  });
  const detailData = await resDetails.json();
  const reopenMsg = detailData.responses.find(r => r.message.startsWith('Reopened:'));
  assert(!!reopenMsg, 'Reopen reason appears in thread responses');
  assert(reopenMsg.message === `Reopened: ${reopenReason}`, 'Reopen message matches user reason');

  // 15. Verify invalid status transitions are rejected (e.g. open -> closed)
  const resInvalidCreate = await fetch(`${BASE_URL}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerAToken}`
    },
    body: JSON.stringify({
      title: 'Test Transition',
      category: 'Support',
      priority: 'low',
      description: 'Test invalid transition'
    })
  });
  const tempTicket = await resInvalidCreate.json();
  const tempTicketId = tempTicket.id;

  const resInvalidTransition = await fetch(`${BASE_URL}/tickets/${tempTicketId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'closed' })
  });
  assert(resInvalidTransition.status === 400, 'Invalid transition (open -> closed) rejected with 400');

  console.log('\n--- ALL TESTS COMPLETED SUCCESSFULLY ---');
  console.log(`Assertions Passed: ${assertionsPassed}`);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test suite failed with exception:', err);
  process.exit(1);
});
