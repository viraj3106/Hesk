const app = require('./server');
const http = require('http');

const PORT = 3005;
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
  console.log('--- STARTING PHASE 2 AUTHENTICATION TESTS ---');
  // Generate random email suffix to ensure clean runs
  const rand = Math.floor(Math.random() * 100000);
  const custEmail = `customer_${rand}@test.com`;
  const agentEmail = `agent_${rand}@test.com`;
  const dupEmail = `dup_${rand}@test.com`;

  try {
    // 1. Customer signup validation (missing name)
    console.log('\n[1] Testing signup validation...');
    const signupNoName = await apiRequest('POST', '/auth/signup', { email: custEmail, password: 'Password123!', role: 'customer' });
    assert(signupNoName.status === 400, 'Signup should fail with 400 when name is missing');

    // 2. Customer signup validation (short password)
    const signupShortPass = await apiRequest('POST', '/auth/signup', { name: 'Test User', email: custEmail, password: '123', role: 'customer' });
    assert(signupShortPass.status === 400, 'Signup should fail with 400 when password is < 6 characters');

    // 3. Customer signup validation (admin role signup)
    const signupAdmin = await apiRequest('POST', '/auth/signup', { name: 'Fake Admin', email: custEmail, password: 'Password123!', role: 'admin' });
    assert(signupAdmin.status === 400, 'Signup should fail with 400 when attempting to register as admin');

    // 4. Valid Customer Signup
    console.log('\n[2] Testing valid signup...');
    const signupSuccess = await apiRequest('POST', '/auth/signup', { name: 'Customer A', email: custEmail, password: 'Password123!', role: 'customer' });
    assert(signupSuccess.status === 201 && signupSuccess.body.token, 'Customer should sign up successfully (201) and receive JWT');
    const custToken = signupSuccess.body.token;

    // 5. Valid Agent Signup
    const signupAgentSuccess = await apiRequest('POST', '/auth/signup', { name: 'Agent A', email: agentEmail, password: 'Password123!', role: 'agent' });
    assert(signupAgentSuccess.status === 201 && signupAgentSuccess.body.token, 'Agent should sign up successfully (201)');

    // 6. Duplicate email signup check
    console.log('\n[3] Testing duplicate email signup...');
    await apiRequest('POST', '/auth/signup', { name: 'Dup 1', email: dupEmail, password: 'Password123!', role: 'customer' });
    const signupDup = await apiRequest('POST', '/auth/signup', { name: 'Dup 2', email: dupEmail, password: 'Password123!', role: 'customer' });
    assert(signupDup.status === 409, 'Duplicate signup should fail with 409 Conflict');

    // 7. Valid Customer Login
    console.log('\n[4] Testing logins...');
    const loginSuccess = await apiRequest('POST', '/auth/login', { email: custEmail, password: 'Password123!' });
    assert(loginSuccess.status === 200 && loginSuccess.body.token && loginSuccess.body.user.role === 'customer', 'Customer login should succeed (200) and return user details without password_hash');
    assert(!loginSuccess.body.user.password_hash, 'Returned user info must not contain password_hash');

    // 8. Admin Login
    const adminLogin = await apiRequest('POST', '/auth/login', { email: 'admin@helpdesk.com', password: 'Admin123!' });
    assert(adminLogin.status === 200 && adminLogin.body.user.role === 'admin', 'Default admin should be able to log in');

    // 9. Invalid Login (wrong password)
    const loginWrongPass = await apiRequest('POST', '/auth/login', { email: custEmail, password: 'WrongPassword' });
    assert(loginWrongPass.status === 401, 'Login with wrong password should fail with 401');

    console.log('\n✅ ALL PHASE 2 AUTHENTICATION TESTS PASSED SUCCESSFULLY!');
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
