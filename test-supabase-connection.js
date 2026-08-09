const supabase = require('./database');

async function testConnection() {
  console.log('Testing connection to Supabase...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Error connecting to Supabase:', error.message);
      process.exit(1);
    } else {
      console.log('Supabase connected successfully');
      process.exit(0);
    }
  } catch (err) {
    console.error('Exception during connection test:', err.message);
    process.exit(1);
  }
}

testConnection();
