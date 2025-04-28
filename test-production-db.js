import pg from 'pg';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

const { Pool } = pg;

// Create a connection to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testProductionDb() {
  try {
    console.log('Testing connection to production database...');
    console.log('Connection string (partially redacted):', 
      process.env.DATABASE_URL.replace(/(postgres:\/\/[^:]+):([^@]+)@(.+)/, 'postgres://$1:****@$3'));
    
    // Test database connection
    console.log('\n1. Testing basic connection');
    const connResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful. Current server time:', connResult.rows[0].current_time);
    
    // Count rows in users table
    console.log('\n2. Counting users in database');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`Found ${userCount.rows[0].count} users in the database`);
    
    // Get first 5 user records
    console.log('\n3. Fetching first 5 users');
    const usersResult = await pool.query('SELECT id, username, email, "userType" FROM users ORDER BY id LIMIT 5');
    
    if (usersResult.rows.length === 0) {
      console.log('❌ No users found in the database');
    } else {
      console.log('✅ Found users in the database:');
      usersResult.rows.forEach(user => {
        console.log(`   ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Type: ${user.userType}`);
      });
    }
    
    // Check session table
    console.log('\n4. Checking session table');
    const sessionTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'session'
      )
    `);
    
    if (sessionTableExists.rows[0].exists) {
      console.log('✅ Session table exists');
      
      // Count session records
      const sessionCount = await pool.query('SELECT COUNT(*) FROM session');
      console.log(`   Found ${sessionCount.rows[0].count} session records`);
    } else {
      console.log('❌ Session table does not exist in the database');
    }
    
    // List all tables
    console.log('\n5. Listing all tables in the database');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`Found ${tablesResult.rows.length} tables in the database:`);
    console.log(tablesResult.rows.map(row => row.table_name).join(', '));
    
    // Count records in some important tables
    console.log('\n6. Counting records in key tables');
    const tables = ['users', 'landlord_profiles', 'contractor_profiles', 'jobs', 'bids'];
    
    for (const table of tables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ${table}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`   ${table}: Error counting records - ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Database test failed:', error);
  } finally {
    // Close the connection pool
    await pool.end();
    console.log('\nDatabase connection closed');
  }
}

// Run the test
testProductionDb();