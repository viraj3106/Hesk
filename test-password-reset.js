const app = require('./server');
const http = require('http');
const fs = require('fs');
const { Client } = require('pg');

const PORT = 3015;
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
  console.log('--- STARTING SECURE PASSWORD RESET WORKFLOW TESTS ---');
  const rand = Math.floor(Math.random() * 100000);
  const email = `secure_reset_${rand}@test.com`;
  const oldPassword = 'OldPassword123!';
  const newPassword = 'NewPassword123!';

  // DB client for managing test state (expired/reused tokens)
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

    // 1. Setup user
    console.log('\n[1] Registering test user...');
    const signupRes = await apiRequest('POST', '/auth/signup', {
      name: 'Secure Reset User',
      email: email,
      password: oldPassword,
      role: 'customer'
    });
    assert(signupRes.status === 201 && signupRes.body.token, 'Test user signup should succeed');
    const userId = signupRes.body.user.id;

    // Remove any leftover dev token file
    if (fs.existsSync('reset_token_dev.json')) {
      fs.unlinkSync('reset_token_dev.json');
    }

    // 2. Request forgot-password with unknown email
    console.log('\n[2] Requesting reset for unknown email...');
    const unknownRes = await apiRequest('POST', '/auth/forgot-password', {
      email: `unknown_${rand}@test.com`
    });
    // Endpoint must NOT reveal whether an email exists and must return generic success
    assert(unknownRes.status === 200, 'Unknown email should return 200 generic success');
    assert(unknownRes.body.success === true, 'Unknown email response should indicate success');
    assert(!fs.existsSync('reset_token_dev.json'), 'No dev token file should be written for unknown email');

    // 3. Request forgot-password with valid email
    console.log('\n[3] Requesting reset for valid email...');
    const validRes = await apiRequest('POST', '/auth/forgot-password', {
      email: email
    });
    assert(validRes.status === 200, 'Valid email should return 200 generic success');
    assert(validRes.body.success === true, 'Valid email response should indicate success');
    
    // Read generated token from dev token file
    assert(fs.existsSync('reset_token_dev.json'), 'Dev token file should be written for local testing');
    const devTokenData = JSON.parse(fs.readFileSync('reset_token_dev.json', 'utf8'));
    const token = devTokenData.token;
    assert(token && token.length === 64, 'Reset token should be a secure 32-byte (64 hex characters) token');

    // Verify token hash is stored in database
    const crypto = require('crypto');
    const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
    const dbTokenCheck = await dbClient.query('SELECT * FROM password_reset_tokens WHERE token_hash = $1', [expectedHash]);
    assert(dbTokenCheck.rows.length === 1, 'Token hash should exist in Supabase database');
    assert(dbTokenCheck.rows[0].used === false, 'Token should initially be marked as unused');

    // 4. Invalid token rejected
    console.log('\n[4] Reset with invalid token...');
    const invalidReset = await apiRequest('POST', '/auth/reset-password', {
      token: 'some-fake-token-that-does-not-exist',
      newPassword: newPassword
    });
    assert(invalidReset.status === 400, 'Reset with invalid token should fail with 400');

    // 5. Expired token rejected
    console.log('\n[5] Reset with expired token...');
    const expiredToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
    const expiredTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
    await dbClient.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used) VALUES ($1, $2, $3, false)',
      [userId, expiredHash, expiredTime]
    );
    const expiredReset = await apiRequest('POST', '/auth/reset-password', {
      token: expiredToken,
      newPassword: newPassword
    });
    assert(expiredReset.status === 400, 'Reset with expired token should fail with 400');

    // 6. Valid reset
    console.log('\n[6] Reset with valid token...');
    const validReset = await apiRequest('POST', '/auth/reset-password', {
      token: token,
      newPassword: newPassword
    });
    assert(validReset.status === 200, 'Reset with valid token should succeed with 200');

    // 7. Token cannot be reused
    console.log('\n[7] Attempting to reuse the token...');
    const reuseReset = await apiRequest('POST', '/auth/reset-password', {
      token: token,
      newPassword: 'AnotherPassword123!'
    });
    assert(reuseReset.status === 400, 'Reset with reused token should fail with 400');

    // 8. New password works, old password fails
    console.log('\n[8] Verifying passwords...');
    const oldLogin = await apiRequest('POST', '/auth/login', {
      email: email,
      password: oldPassword
    });
    assert(oldLogin.status === 401, 'Login with old password should fail (401)');

    const newLogin = await apiRequest('POST', '/auth/login', {
      email: email,
      password: newPassword
    });
    assert(newLogin.status === 200 && newLogin.body.token, 'Login with new password should succeed');

    console.log(`\n✅ ALL PASSWORD RESET WORKFLOW TESTS PASSED SUCCESSFULLY! (${assertionCount} assertions passed)`);
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
