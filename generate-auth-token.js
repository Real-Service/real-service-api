import pg from 'pg';
const { Pool } = pg;

// Create a connection to the specified production database
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function generateAuthToken() {
  try {
    // Test the connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('Database connection successful. Server time:', connectionTest.rows[0].now);
    
    const userId = 7; // Contractor 10 has user ID 7
    
    // Verify user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (userResult.rowCount === 0) {
      console.error(`User with ID ${userId} doesn't exist in the database!`);
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`\nFound user:`, user);
    
    // Generate auth token in the format used by the application
    const timestamp = Date.now();
    const authToken = `user-${userId}-${timestamp}`;
    
    console.log(`\n=== AUTHENTICATION INFO ===`);
    console.log(`User ID: ${userId}`);
    console.log(`Auth Token: ${authToken}`);
    console.log(`Auth Timestamp: ${timestamp}`);
    console.log(`\nUse these credentials in the Authentication header or X-Auth-Token header.`);
    console.log(`\nTo log in using URL parameters, use: ?userId=${userId}&authToken=${authToken}&timestamp=${timestamp}`);
    console.log(`\nTo log in using curl:`);
    console.log(`curl -X GET "http://localhost:5000/api/user" -H "X-User-ID: ${userId}" -H "X-Auth-Token: ${authToken}" -H "X-Auth-Timestamp: ${timestamp}"`);
    
  } catch (error) {
    console.error('Error generating auth token:', error);
  } finally {
    await pool.end();
  }
}

generateAuthToken().catch(console.error);