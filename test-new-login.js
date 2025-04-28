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

async function testLogin(username, password) {
  try {
    console.log(`Testing login for user: ${username}`);
    
    // First, check if user exists in the database
    const userResult = await pool.query('SELECT id, username, email, "userType" FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      console.log(`User '${username}' not found in database`);
      return false;
    }
    
    const user = userResult.rows[0];
    console.log(`Found user in DB: ID=${user.id}, Type=${user.userType}, Email=${user.email}`);
    
    // Now try the actual login via API
    const response = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: username, password }), // API expects 'email' field, not 'username'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('User data from API:', result);
      return true;
    } else {
      console.log('❌ Login failed:', result.message || 'Unknown error');
      return false;
    }
  } catch (err) {
    console.error('Error testing login:', err);
    return false;
  }
}

async function testMultipleUsers() {
  const testUsers = [
    { username: 'landlord1', password: 'password' },
    { username: 'landlord2', password: 'password' },
    { username: 'contractor7', password: 'password' },
    { username: 'contractor 10', password: 'password' }
  ];
  
  const results = [];
  
  for (const user of testUsers) {
    console.log(`\n---------------------------------------`);
    const success = await testLogin(user.username, user.password);
    results.push({ username: user.username, success });
  }
  
  console.log('\n\n=== SUMMARY ===');
  results.forEach(result => {
    console.log(`${result.username}: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  });
  
  await pool.end();
}

// Run the tests
testMultipleUsers();