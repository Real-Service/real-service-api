import pg from 'pg';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Create a connection to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkNeonConnection() {
  try {
    console.log('Testing connection to Neon PostgreSQL...');
    console.log('Connection string (redacted):', 
      process.env.DATABASE_URL.replace(/(postgres:\/\/[^:]+):([^@]+)@(.+)/, 'postgres://$1:****@$3'));
    
    // Check server time
    const timeResult = await pool.query('SELECT NOW() AS server_time');
    console.log('✅ Connected to Neon PostgreSQL. Server time:', timeResult.rows[0].server_time);
    
    // Check tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`\nFound ${tablesResult.rows.length} tables in the database:`);
    console.log(tablesResult.rows.map(row => row.table_name).join(', '));
    
    // Check if specific tables exist with their record counts
    const tables = ['users', 'landlord_profiles', 'contractor_profiles', 'jobs', 'bids'];
    
    console.log('\nTable record counts:');
    for (const table of tables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`- ${table}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`- ${table}: Error counting records - ${error.message}`);
      }
    }
    
    // Check session table specifically
    try {
      const sessionTableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'session'
        )
      `);
      
      if (sessionTableExists.rows[0].exists) {
        const sessionCount = await pool.query('SELECT COUNT(*) FROM session');
        console.log(`- session: ${sessionCount.rows[0].count} records`);
        
        // Show a sample record
        if (sessionCount.rows[0].count > 0) {
          const sessionSample = await pool.query('SELECT * FROM session LIMIT 1');
          console.log('\nSample session record (first few characters of sid and sess):');
          const sample = sessionSample.rows[0];
          console.log(`- sid: ${sample.sid.substring(0, 30)}...`);
          console.log(`- sess: ${sample.sess.substring(0, 50)}...`);
          console.log(`- expire: ${sample.expire}`);
        }
      } else {
        console.log('- session: Table does not exist');
      }
    } catch (error) {
      console.log(`- session: Error checking session table - ${error.message}`);
    }
    
    // Try to create a test table to check write permissions
    try {
      console.log('\nTesting write permissions...');
      await pool.query('CREATE TABLE IF NOT EXISTS neon_test (id SERIAL PRIMARY KEY, test_data TEXT, created_at TIMESTAMP DEFAULT NOW())');
      await pool.query("INSERT INTO neon_test (test_data) VALUES ('connection test')");
      const testResult = await pool.query('SELECT * FROM neon_test ORDER BY created_at DESC LIMIT 1');
      console.log('✅ Successfully wrote to and read from test table.');
      console.log('Last test record:', testResult.rows[0]);
    } catch (error) {
      console.log('❌ Error testing write permissions:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  } finally {
    await pool.end();
    console.log('\nTest completed. Database connection closed.');
  }
}

// Run the test
checkNeonConnection();