require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'resolvedesk'
};

const adminEmail = 'admin@helpdesk.com';
const adminName = 'System Admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

async function seedAdmin() {
  console.log(`Connecting to MySQL and checking if admin user (${adminEmail}) exists...`);
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig);
    const [rows] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]);

    if (rows && rows.length > 0) {
      console.log('Admin user already exists. Seeding skipped.');
      return;
    }

    console.log('Admin user does not exist. Creating admin in MySQL...');
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(adminPassword, salt);

    await connection.query(
      'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [adminName, adminEmail, passwordHash, 'admin']
    );

    console.log('Admin user seeded successfully in MySQL!');
  } catch (err) {
    console.error('Error seeding admin user in MySQL:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

seedAdmin();
