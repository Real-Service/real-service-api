import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

// Enable Websocket for Neon connection
neonConfig.webSocketConstructor = ws;

const PRODUCTION_DB_URL = "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function listUsers() {
  console.log('Connecting to production database...');
  const pool = new Pool({ connectionString: PRODUCTION_DB_URL });
  
  try {
    // Test connection
    const testResult = await pool.query('SELECT NOW() as time');
    console.log('Connected to database at', testResult.rows[0].time);
    
    // List all users
    console.log('\nListing all users:');
    const usersResult = await pool.query(`
      SELECT id, username, email, user_type, full_name, created_at 
      FROM users 
      ORDER BY id
      LIMIT 20
    `);
    
    if (usersResult.rows.length === 0) {
      console.log('No users found in the database.');
    } else {
      console.log('Found', usersResult.rows.length, 'users:');
      usersResult.rows.forEach(user => {
        console.log(`[${user.id}] ${user.email} (${user.user_type}) - Name: ${user.full_name || user.username}`);
      });
      
      // Show a sample credential for testing
      const sampleUser = usersResult.rows[0];
      console.log('\nSample user for testing:');
      console.log(`Email: ${sampleUser.email}`);
      console.log('Password: password123 (most likely)');
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
}

listUsers();