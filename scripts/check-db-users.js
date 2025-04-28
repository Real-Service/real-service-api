/**
 * Check users in the database
 * 
 * This script checks if users exist in the database and lists them
 */

// Import required modules
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Create a database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkDatabaseUsers() {
  try {
    console.log('Connecting to database...');
    
    // Test connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('Database connection successful. Server time:', connectionTest.rows[0].now);
    
    // Count users
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`Total users in database: ${countResult.rows[0].count}`);
    
    // List users
    if (countResult.rows[0].count > 0) {
      const usersResult = await pool.query('SELECT id, username, email, "userType" FROM users LIMIT 10');
      console.log('\nUsers in database:');
      for (const user of usersResult.rows) {
        console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Type: ${user.userType}`);
      }
    } else {
      console.log('No users found in the database.');
    }
    
    // Check session table
    try {
      const sessionCount = await pool.query('SELECT COUNT(*) FROM session');
      console.log(`\nSession table exists with ${sessionCount.rows[0].count} rows`);
    } catch (err) {
      console.error('Error checking session table:', err.message);
    }
    
  } catch (err) {
    console.error('Error checking database:', err);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the check
checkDatabaseUsers();