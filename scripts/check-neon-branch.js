import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a connection to the database
const { Pool } = pg;

async function checkNeonBranch() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Checking Neon database connection information:');
    console.log('Connection String (partially redacted):', process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@'));
    
    // Extract branch info from connection URL
    const url = new URL(process.env.DATABASE_URL);
    const hostname = url.hostname;
    console.log('Hostname:', hostname);
    
    // If hostname contains "pooler", it's a production connection
    if (hostname.includes('pooler')) {
      console.log('Connection Type: Pooler endpoint (likely production)');
    } else {
      console.log('Connection Type: Direct endpoint (likely development)');
    }
    
    // Count users
    const userResult = await pool.query('SELECT COUNT(*) FROM users');
    console.log('Total users in database:', userResult.rows[0].count);
    
    // If no users, show alert
    if (parseInt(userResult.rows[0].count) === 0) {
      console.log('\n🚨 WARNING: Your database has 0 users. This confirms you are likely connected to the production branch.');
      console.log('You need to migrate users from development to production or create new users in production.');
    } else {
      console.log('\n✅ Found users in the database. Listing first 5:');
      const sampleUsers = await pool.query('SELECT id, email, username, "userType" FROM users ORDER BY id LIMIT 5');
      sampleUsers.rows.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Type: ${user.userType}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await pool.end();
  }
}

checkNeonBranch();