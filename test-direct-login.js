import pg from 'pg';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Initialize dotenv
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testDirectLogin() {
  try {
    // Get information about user 7 (contractor 10)
    const userResult = await pool.query('SELECT id, username, email, password, "userType" FROM users WHERE id = 7');
    
    if (userResult.rows.length === 0) {
      console.log('User with ID 7 not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('User found:');
    console.log(`ID: ${user.id}`);
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Password format: ${user.password.substring(0, 10)}... (${user.password.length} characters)`);
    
    // Print detailed password analysis
    if (user.password.startsWith('$2b$')) {
      console.log('Password appears to be in bcrypt format (starts with $2b$)');
    } else if (user.password.includes('.')) {
      const [hash, salt] = user.password.split('.');
      console.log(`Password appears to be in scrypt format (hash.salt)`);
      console.log(`Hash part: ${hash.substring(0, 10)}... (${hash.length} chars)`);
      console.log(`Salt part: ${salt} (${salt.length} chars)`);
    } else {
      console.log('Password is in an unknown format');
    }
    
    // Define a set of passwords to try
    const passwordsToTry = [
      'password123',
      'password',
      'Password123',
      'password1',
      '123456',
      'admin',
      'welcome',
      'contractor',
      'express',
      user.username,  // Try using the username as password
      user.email      // Try using the email as password
    ];
    
    // Try the direct login endpoint for each password
    console.log('\nTrying different passwords...');
    for (const password of passwordsToTry) {
      const response = await fetch('http://localhost:5000/api/direct-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.username, password }), // API expects 'email' field for both username or email
      });
      
      if (response.ok) {
        console.log(`✅ SUCCESS: Password '${password}' works!`);
        const data = await response.json();
        console.log('Login response:', data);
        break;
      } else {
        console.log(`❌ FAILED: Password '${password}' does not work`);
      }
    }
    
    // Clean up and close the pool
    await pool.end();
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testDirectLogin();