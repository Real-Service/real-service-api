import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
  try {
    // Count users
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`Total users: ${userCount.rows[0].count}`);
    
    // List first 5 users
    const users = await pool.query('SELECT id, username, email, "userType" FROM users LIMIT 5');
    console.log('First 5 users:');
    users.rows.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Type: ${user.userType}`);
    });
    
    // Check session table
    try {
      const sessionCount = await pool.query('SELECT COUNT(*) FROM session');
      console.log(`\nSessions: ${sessionCount.rows[0].count}`);
    } catch (err) {
      console.error('Error checking session table:', err.message);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkUsers();