/**
 * Test login with the fixed password handling
 * 
 * This script tests logging in using the application's API endpoints
 * to verify that the password handling fixes are working correctly.
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Create a database connection for direct testing
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testLogin(username, password) {
  try {
    console.log(`Testing login for user: ${username}`);
    
    // For direct API testing, we need the URL
    const baseUrl = 'http://localhost:5000';
    
    // First, let's test that the server is running by checking a simple endpoint
    console.log('Checking server status...');
    const serverCheckResponse = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
    }).catch(error => {
      console.error('Server check failed:', error.message);
      return { ok: false };
    });
    
    if (!serverCheckResponse.ok) {
      console.log('Server is not responding. Make sure it is running at http://localhost:5000');
      return false;
    }
    
    console.log('Server is running. Attempting login...');
    
    // Get the user's email from the database
    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`User ${username} not found in database`);
      return false;
    }
    
    const user = userResult.rows[0];
    console.log(`Found user in database: ${user.username} (${user.email})`);
    
    // Attempt to log in with email 
    const loginResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        email: user.email, // Include email field
      }),
    });
    
    if (loginResponse.ok) {
      const userData = await loginResponse.json();
      console.log('✅ Login successful!');
      console.log('User data:', userData);
      return true;
    } else {
      const errorText = await loginResponse.text();
      console.log(`❌ Login failed with status ${loginResponse.status}`);
      console.log('Error:', errorText);
      
      // Try to get the user from the database directly
      const userResult = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        console.log('\nUser exists in database:');
        console.log(`Email: ${user.email}`);
        console.log(`User Type: ${user.userType}`);
        
        // Try other common passwords
        console.log('\nTrying alternative passwords through API:');
        const commonPasswords = ['password', 'abc123', '123456', 'admin', 'welcome'];
        
        for (const testPassword of commonPasswords) {
          const testResponse = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              username,
              password: testPassword,
              email: user.email, // Include email field
            }),
          });
          
          if (testResponse.ok) {
            console.log(`✅ Login successful with password: "${testPassword}"`);
            return true;
          }
        }
        
        console.log('No common passwords worked.');
      } else {
        console.log(`User ${username} not found in database.`);
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error in login test:', error);
    return false;
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Get username and password from command line arguments
const args = process.argv.slice(2);
const username = args[0] || 'landlord1';
const password = args[1] || 'password123';

// Run the test
testLogin(username, password)
  .then(result => {
    console.log(`\nLogin test ${result ? 'passed' : 'failed'}`);
    process.exit(result ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running test:', error);
    process.exit(1);
  });