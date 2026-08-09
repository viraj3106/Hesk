const app = require('./server');
const http = require('http');

const PORT = 3007;
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
  console.log('--- STARTING PHASE 4 THREAD & DETAIL TESTS ---');
  const rand = Math.floor(Math.random() * 100000);
  const emailA = `custA_${rand}@test.com`;
  const emailB = `custB_${rand}@test.com`;

  try {
    // Signup two customers
    const custASignup = await apiRequest('POST', '/auth/signup', { name: 'Customer A', email: emailA, password: 'Password123!', role: 'customer' });
    const custBSignup = await apiRequest('POST', '/auth/signup', { name: 'Customer B', email: emailB, password: 'Password123!', role: 'customer' });
    
    const tokenA = custASignup.body.token;
    const tokenB = custBSignup.body.token;

    // Create a ticket for Customer A
    const ticketRes = await apiRequest('POST', '/tickets', {
      title: 'Slow billing issue',
      category: 'Billing & Payments',
      priority: 'low',
      description: 'My invoice is not generated yet.'
    }, tokenA);
    const ticketId = ticketRes.body.id;

    // 1. Customer A can view their own ticket
    console.log('\n[1] Testing ticket detail fetching...');
    const detailARes = await apiRequest('GET', `/tickets/${ticketId}`, null, tokenA);
    assert(detailARes.status === 200 && detailARes.body.id === ticketId, 'Customer A should fetch their own ticket details');
    assert(Array.isArray(detailARes.body.responses), 'Responses array should be present');

    // 2. Customer B cannot view Customer A's ticket
    const detailBRes = await apiRequest('GET', `/tickets/${ticketId}`, null, tokenB);
    assert(detailBRes.status === 403, 'Customer B must be forbidden from viewing Customer A ticket');

    // 3. Post a response on ticket
    console.log('\n[2] Testing posting response...');
    const postRespRes = await apiRequest('POST', `/tickets/${ticketId}/respond`, {
      message: 'Please resolve this quickly, thank you!'
    }, tokenA);
    assert(postRespRes.status === 201, 'Customer A should successfully reply to their ticket');

    // 4. Retrieve details and check response thread
    console.log('\n[3] Testing thread list updates...');
    const threadRes = await apiRequest('GET', `/tickets/${ticketId}`, null, tokenA);
    assert(threadRes.body.responses.length === 1, 'Ticket thread should contain exactly 1 response');
    assert(threadRes.body.responses[0].message === 'Please resolve this quickly, thank you!', 'Response message should match');
    assert(threadRes.body.responses[0].email === emailA, 'Response sender email should match Customer A');
    assert(threadRes.body.responses[0].role === 'customer', 'Response sender role should be customer');

    console.log('\n✅ ALL PHASE 4 THREAD & DETAIL TESTS PASSED SUCCESSFULLY!');
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
