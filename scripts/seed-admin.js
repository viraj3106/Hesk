require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

const adminEmail = 'admin@helpdesk.com';
const adminName = 'System Admin';
// Use ADMIN_PASSWORD from env or fallback to a development default
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

async function seedAdmin() {
  console.log(`Checking if admin user (${adminEmail}) exists...`);
  try {
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existing) {
      console.log('Admin user already exists. Seeding skipped.');
      process.exit(0);
    }

    console.log('Admin user does not exist. Creating admin...');
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(adminPassword, salt);

    const { error: insertError } = await supabase
      .from('users')
      .insert([
        {
          name: adminName,
          email: adminEmail,
          password_hash: passwordHash,
          role: 'admin'
        }
      ]);

    if (insertError) {
      throw insertError;
    }

    console.log('Admin user seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin user:', err.message);
    process.exit(1);
  }
}

seedAdmin();
