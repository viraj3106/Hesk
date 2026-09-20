require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const mysql = require('mysql2/promise');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  multipleStatements: true
};

const databaseName = process.env.MYSQL_DATABASE || 'resolvedesk';

async function migrate() {
  console.log('=== ResolveDesk: Supabase to MySQL Migration ===\n');
  let connection;
  try {
    console.log(`Connecting to MySQL Server at ${mysqlConfig.host}:${mysqlConfig.port} as ${mysqlConfig.user}...`);
    connection = await mysql.createConnection(mysqlConfig);
    console.log('✓ Connected to MySQL server successfully.');

    // Ensure database exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.changeUser({ database: databaseName });
    console.log(`✓ Using database: ${databaseName}`);

    // Create tables if not exist
    console.log('Creating tables if not exists...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS tickets (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          customer_id BIGINT NOT NULL,
          assigned_agent_id BIGINT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          category VARCHAR(100) NOT NULL,
          priority VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'open',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          resolved_at DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS responses (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          ticket_id BIGINT NOT NULL,
          sender_id BIGINT NOT NULL,
          message TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT NOT NULL,
          otp_hash VARCHAR(255) NOT NULL,
          reset_token_hash VARCHAR(255) NULL,
          expires_at DATETIME NOT NULL,
          reset_expires_at DATETIME NULL,
          attempts INT DEFAULT 0,
          verified BOOLEAN DEFAULT FALSE,
          used BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS ticket_status_history (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          ticket_id BIGINT NOT NULL,
          old_status VARCHAR(50) NULL,
          new_status VARCHAR(50) NOT NULL,
          changed_by BIGINT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ Database schema verified.\n');

    // 1. Migrate Users
    console.log('1. Fetching users from Supabase...');
    const { data: users, error: usersErr } = await supabase.from('users').select('*');
    if (usersErr) throw usersErr;

    if (users && users.length > 0) {
      for (const u of users) {
        const createdAt = u.created_at ? new Date(u.created_at) : new Date();
        await connection.query(
          `INSERT INTO users (id, name, email, password_hash, role, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role=VALUES(role);`,
          [u.id, u.name, u.email, u.password_hash, u.role, createdAt]
        );
      }
      console.log(`✓ Migrated ${users.length} users.`);
    } else {
      console.log('- No users found in Supabase.');
    }

    // 2. Migrate Tickets
    console.log('\n2. Fetching tickets from Supabase...');
    const { data: tickets, error: ticketsErr } = await supabase.from('tickets').select('*');
    if (ticketsErr) throw ticketsErr;

    if (tickets && tickets.length > 0) {
      for (const t of tickets) {
        const createdAt = t.created_at ? new Date(t.created_at) : new Date();
        const updatedAt = t.updated_at ? new Date(t.updated_at) : new Date();
        const resolvedAt = t.resolved_at ? new Date(t.resolved_at) : null;
        await connection.query(
          `INSERT INTO tickets (id, customer_id, assigned_agent_id, title, description, category, priority, status, created_at, updated_at, resolved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE customer_id=VALUES(customer_id), assigned_agent_id=VALUES(assigned_agent_id),
           title=VALUES(title), description=VALUES(description), category=VALUES(category), priority=VALUES(priority),
           status=VALUES(status), updated_at=VALUES(updated_at), resolved_at=VALUES(resolved_at);`,
          [t.id, t.customer_id, t.assigned_agent_id || null, t.title, t.description, t.category, t.priority, t.status, createdAt, updatedAt, resolvedAt]
        );
      }
      console.log(`✓ Migrated ${tickets.length} tickets.`);
    } else {
      console.log('- No tickets found in Supabase.');
    }

    // 3. Migrate Responses
    console.log('\n3. Fetching responses from Supabase...');
    const { data: responses, error: respErr } = await supabase.from('responses').select('*');
    if (!respErr && responses && responses.length > 0) {
      for (const r of responses) {
        const createdAt = r.created_at ? new Date(r.created_at) : new Date();
        await connection.query(
          `INSERT INTO responses (id, ticket_id, sender_id, message, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE message=VALUES(message);`,
          [r.id, r.ticket_id, r.sender_id || r.user_id, r.message, createdAt]
        );
      }
      console.log(`✓ Migrated ${responses.length} responses.`);
    } else {
      console.log('- No responses found or table empty.');
    }

    // 4. Migrate Password Reset Tokens
    console.log('\n4. Fetching password reset tokens from Supabase...');
    const { data: tokens, error: tokensErr } = await supabase.from('password_reset_tokens').select('*');
    if (!tokensErr && tokens && tokens.length > 0) {
      for (const tok of tokens) {
        const createdAt = tok.created_at ? new Date(tok.created_at) : new Date();
        const expiresAt = tok.expires_at ? new Date(tok.expires_at) : new Date();
        const resetExpiresAt = tok.reset_expires_at ? new Date(tok.reset_expires_at) : null;
        await connection.query(
          `INSERT INTO password_reset_tokens (id, user_id, otp_hash, reset_token_hash, expires_at, reset_expires_at, attempts, verified, used, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE used=VALUES(used), verified=VALUES(verified);`,
          [tok.id, tok.user_id, tok.otp_hash, tok.reset_token_hash || null, expiresAt, resetExpiresAt, tok.attempts || 0, tok.verified || false, tok.used || false, createdAt]
        );
      }
      console.log(`✓ Migrated ${tokens.length} password reset tokens.`);
    } else {
      console.log('- No password reset tokens found.');
    }

    // 5. Migrate Ticket Status History
    console.log('\n5. Fetching ticket status history from Supabase...');
    const { data: history, error: histErr } = await supabase.from('ticket_status_history').select('*');
    if (!histErr && history && history.length > 0) {
      for (const h of history) {
        const createdAt = h.created_at ? new Date(h.created_at) : new Date();
        await connection.query(
          `INSERT INTO ticket_status_history (id, ticket_id, old_status, new_status, changed_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE new_status=VALUES(new_status);`,
          [h.id, h.ticket_id, h.old_status || null, h.new_status, h.changed_by || null, createdAt]
        );
      }
      console.log(`✓ Migrated ${history.length} status history entries.`);
    } else {
      console.log('- No status history entries found.');
    }

    console.log('\n=============================================');
    console.log('✓ SUCCESS: Supabase to MySQL migration complete!');
    console.log('=============================================\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
