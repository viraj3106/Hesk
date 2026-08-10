require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

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

async function cleanup() {
  console.log('Cleaning up database...');
  try {
    // 1. Delete password reset tokens
    const { error: err1 } = await supabase.from('password_reset_tokens').delete().neq('id', 0);
    if (err1) console.log('Error deleting password_reset_tokens:', err1.message);

    // 2. Delete responses
    const { error: err2 } = await supabase.from('responses').delete().neq('id', 0);
    if (err2) console.log('Error deleting responses:', err2.message);

    // 3. Delete tickets
    const { error: err3 } = await supabase.from('tickets').delete().neq('id', 0);
    if (err3) console.log('Error deleting tickets:', err3.message);

    // 4. Delete users except admin@helpdesk.com
    const { error: err4 } = await supabase.from('users').delete().neq('email', 'admin@helpdesk.com');
    if (err4) console.log('Error deleting users:', err4.message);

    console.log('Cleanup completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Cleanup encountered exception:', err.message);
    process.exit(1);
  }
}

cleanup();
