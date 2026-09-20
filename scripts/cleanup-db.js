require('dotenv').config();
const mysql = require('mysql2/promise');

const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'resolvedesk'
};

async function cleanup() {
  console.log('Cleaning up MySQL database...');
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig);

    await connection.query('DELETE FROM password_reset_tokens WHERE id > 0');
    console.log('✓ Cleared password reset tokens');

    await connection.query('DELETE FROM responses WHERE id > 0');
    console.log('✓ Cleared responses');

    await connection.query('DELETE FROM ticket_status_history WHERE id > 0');
    console.log('✓ Cleared ticket status history');

    await connection.query('DELETE FROM tickets WHERE id > 0');
    console.log('✓ Cleared tickets');

    await connection.query('DELETE FROM users WHERE email != "admin@helpdesk.com"');
    console.log('✓ Cleared non-admin users');

    console.log('Cleanup completed successfully in MySQL!');
  } catch (err) {
    console.error('Cleanup encountered error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

cleanup();
