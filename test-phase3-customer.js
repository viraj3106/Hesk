const app = require('./server');
const http = require('http');

const PORT = 3006;
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
  console.log('--- STARTING PHASE 3 CUSTOMER TICKETS TESTS ---');
  const rand = Math.floor(Math.random() * 100000);
  const emailA = `custA_${rand}@test.com`;
  const emailB = `custB_${rand}@test.com`;

  try {
    // Signup two customers
    const custASignup = await apiRequest('POST', '/auth/signup', { name: 'Customer A', email: emailA, password: 'Password123!', role: 'customer' });
    const custBSignup = await apiRequest('POST', '/auth/signup', { name: 'Customer B', email: emailB, password: 'Password123!', role: 'customer' });
    
    const tokenA = custASignup.body.token;
    const tokenB = custBSignup.body.token;

    // 1. Create ticket (invalid priority)
    console.log('\n[1] Testing ticket validation...');
    const invalidPriorityRes = await apiRequest('POST', '/tickets', {
      title: 'Broken page',
      category: 'Technical Support',
      priority: 'super-high',
      description: 'The page crashes on load'
    }, tokenA);
    assert(invalidPriorityRes.status === 400, 'Ticket creation should fail with 400 when priority is invalid');

    // 2. Create ticket (missing description)
    const missingDescRes = await apiRequest('POST', '/tickets', {
      title: 'Broken page',
      category: 'Technical Support',
      priority: 'high'
    }, tokenA);
    assert(missingDescRes.status === 400, 'Ticket creation should fail with 400 when description is missing');

    // 3. Valid ticket creation
    console.log('\n[2] Testing valid ticket creation...');
    const validTicketRes = await apiRequest('POST', '/tickets', {
      title: 'Login issue',
      category: 'Technical Support',
      priority: 'medium',
      description: 'Cannot login with my new email'
    }, tokenA);
    assert(validTicketRes.status === 201 && validTicketRes.body.id, 'Ticket should be created successfully (201)');

    // 4. View own tickets
    console.log('\n[3] Testing retrieving own tickets...');
    const ticketsARes = await apiRequest('GET', '/tickets/my', null, tokenA);
    assert(ticketsARes.status === 200 && ticketsARes.body.length === 1, 'Customer A should see exactly 1 ticket');
    assert(ticketsARes.body[0].title === 'Login issue', 'Customer A ticket should match details');

    const ticketsBRes = await apiRequest('GET', '/tickets/my', null, tokenB);
    assert(ticketsBRes.status === 200 && ticketsBRes.body.length === 0, 'Customer B should see 0 tickets');

    console.log('\n✅ ALL PHASE 3 CUSTOMER FEATURES TESTS PASSED SUCCESSFULLY!');
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
