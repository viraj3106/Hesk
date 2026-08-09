const app = require('./server');
const http = require('http');
const fs = require('fs');
const { Client } = require('pg');

const PORT = 3016;
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
  console.log('--- STARTING SECURE 6-DIGIT OTP PASSWORD RESET TESTS ---');
  const rand = Math.floor(Math.random() * 100000);
  const email = `otp_reset_${rand}@test.com`;
  const oldPassword = 'OldPassword123!';
  const newPassword = 'NewPassword123!';

  // DB client for checking hashes & manipulating timestamps/attempts
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

    // Setup: Signup a test user
    console.log('\n[Setup] Registering test user...');
    const signupRes = await apiRequest('POST', '/auth/signup', {
      name: 'OTP Reset User',
      email: email,
      password: oldPassword,
      role: 'customer'
    });
    assert(signupRes.status === 201 && signupRes.body.token, 'Test user signup should succeed');
    const userId = signupRes.body.user.id;

    if (fs.existsSync('reset_token_dev.json')) {
      fs.unlinkSync('reset_token_dev.json');
    }

    // 1. Forgot password request with valid email
    console.log('\n[1] Forgot password request with valid email...');
    const forgotRes = await apiRequest('POST', '/auth/forgot-password', { email });
    assert(forgotRes.status === 200, 'Request should return 200');
    assert(forgotRes.body.success === true, 'Response should contain success: true');
    assert(forgotRes.body.message.includes('verification code'), 'Response message should mention verification code');

    // 2. Unknown email returns same generic response
    console.log('\n[2] Requesting reset for unknown email...');
    const unknownRes = await apiRequest('POST', '/auth/forgot-password', {
      email: `unknown_${rand}@test.com`
    });
    assert(unknownRes.status === 200, 'Request should return 200');
    assert(unknownRes.body.success === true, 'Response should contain success: true');
    assert(unknownRes.body.message === forgotRes.body.message, 'Unknown email response should match valid email response');

    // 3 & 4. OTP generated and is 6 digits
    console.log('\n[3 & 4] Verifying generated OTP format...');
    assert(fs.existsSync('reset_token_dev.json'), 'Dev token file should be written for testing');
    const devData = JSON.parse(fs.readFileSync('reset_token_dev.json', 'utf8'));
    const otp = devData.otp;
    assert(otp && otp.length === 6 && /^\d+$/.test(otp), 'OTP must be exactly 6 numeric digits');

    // 5. OTP is stored hashed, not plaintext
    console.log('\n[5] Verifying OTP is stored hashed in database...');
    const dbTokenRow = await dbClient.query('SELECT * FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
    assert(dbTokenRow.rows.length === 1, 'OTP record should exist in the database');
    const storedRecord = dbTokenRow.rows[0];
    assert(storedRecord.otp_hash !== otp, 'Stored OTP hash must not match plaintext OTP');
    
    const crypto = require('crypto');
    const expectedHash = crypto.createHash('sha256').update(otp).digest('hex');
    assert(storedRecord.otp_hash === expectedHash, 'Stored hash must match the SHA-256 hash of the generated OTP');

    // 7. Incorrect OTP fails
    console.log('\n[7] Testing Incorrect OTP...');
    const badOtpRes = await apiRequest('POST', '/auth/verify-otp', {
      email,
      otp: '999999' // wrong OTP
    });
    assert(badOtpRes.status === 400, 'Incorrect OTP verification should return 400');
    assert(badOtpRes.body.error.includes('attempts remaining'), 'Error message should indicate remaining attempts');

    // 10. Too many attempts are rejected
    console.log('\n[10] Testing Too many attempts are rejected...');
    // We already did 1 bad attempt. Let's trigger 4 more bad attempts to reach 5
    for (let i = 0; i < 4; i++) {
      await apiRequest('POST', '/auth/verify-otp', { email, otp: '999999' });
    }
    const maxAttemptRes = await apiRequest('POST', '/auth/verify-otp', { email, otp: '999999' });
    assert(maxAttemptRes.status === 400, 'Verification should fail after max attempts');
    assert(maxAttemptRes.body.error.includes('Too many attempts'), 'Error should indicate too many attempts');

    // Regenerate new OTP for subsequent tests
    console.log('\n[Regenerating new OTP for subsequent tests]');
    await apiRequest('POST', '/auth/forgot-password', { email });
    const devData2 = JSON.parse(fs.readFileSync('reset_token_dev.json', 'utf8'));
    const validOtp = devData2.otp;

    // 8. Expired OTP fails
    console.log('\n[8] Testing Expired OTP...');
    // Artificially set expires_at to 1 minute ago in the DB
    await dbClient.query("UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1", [userId]);
    const expiredRes = await apiRequest('POST', '/auth/verify-otp', {
      email,
      otp: validOtp
    });
    assert(expiredRes.status === 400, 'Expired OTP should be rejected');

    // Regenerate once more
    await apiRequest('POST', '/auth/forgot-password', { email });
    const devData3 = JSON.parse(fs.readFileSync('reset_token_dev.json', 'utf8'));
    const freshOtp = devData3.otp;

    // 6 & 11. Correct OTP succeeds and produces reset authorization token
    console.log('\n[6 & 11] Verification produces resetToken...');
    const verifyRes = await apiRequest('POST', '/auth/verify-otp', {
      email,
      otp: freshOtp
    });
    assert(verifyRes.status === 200 && verifyRes.body.resetToken, 'Correct OTP should verify successfully and return resetToken');
    const resetToken = verifyRes.body.resetToken;

    // 9. Used OTP cannot be reused
    console.log('\n[9] Used OTP cannot be reused...');
    // Attempting to verify the same OTP again should fail because it was marked verified (or is latest active)
    const reuseVerify = await apiRequest('POST', '/auth/verify-otp', {
      email,
      otp: freshOtp
    });
    assert(reuseVerify.status === 400, 'Re-verifying verified OTP should fail');

    // 13 & 14. Password reset validation: old fails, new works, new password hashed with bcrypt
    console.log('\n[12, 13, 14] Testing password reset execution...');
    const resetRes = await apiRequest('POST', '/auth/reset-password', {
      resetToken,
      newPassword: newPassword
    });
    assert(resetRes.status === 200, 'Password reset should succeed');

    const dbUserRow = await dbClient.query('SELECT * FROM users WHERE id = $1', [userId]);
    assert(dbUserRow.rows[0].password_hash !== newPassword, 'Password must be hashed in the database');
    assert(dbUserRow.rows[0].password_hash.startsWith('$2'), 'Password hash must be a bcrypt hash');

    const oldLogin = await apiRequest('POST', '/auth/login', {
      email,
      password: oldPassword
    });
    assert(oldLogin.status === 401, 'Old password should no longer work');

    const newLogin = await apiRequest('POST', '/auth/login', {
      email,
      password: newPassword
    });
    assert(newLogin.status === 200 && newLogin.body.token, 'New password should work for login');

    // 15. Reset authorization cannot be reused
    console.log('\n[15] Reset authorization token cannot be reused...');
    const reuseReset = await apiRequest('POST', '/auth/reset-password', {
      resetToken,
      newPassword: 'SomeOtherPassword123'
    });
    assert(reuseReset.status === 400, 'Reusing the resetToken should fail');

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
