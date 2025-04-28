import pg from 'pg';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkUser() {
  try {
    const result = await pool.query('SELECT id, username, email, "userType" FROM users WHERE id = 7');
    if (result.rows.length > 0) {
      console.log('User ID 7 found:', result.rows[0]);
    } else {
      console.log('User ID 7 not found in database');
      
      // Let's check for a user with username = 'contractor 10'
      const usernameResult = await pool.query('SELECT id, username, email, "userType" FROM users WHERE username = $1', ['contractor 10']);
      if (usernameResult.rows.length > 0) {
        console.log('Found user with username contractor 10:', usernameResult.rows[0]);
      } else {
        console.log('No user found with username contractor 10');
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkUser();