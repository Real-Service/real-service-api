/**
 * Test HTTP login API with production database credentials
 */

import pg from 'pg';
import fetch from 'node-fetch';
const { Pool } = pg;

async function testWebLogin() {
  console.log('Testing web login with production credentials...');
  
  try {
    // Try logging in with production credentials
    const response = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'contractor 10',
        password: 'password',
        email: 'info@expressbd.ca'  // Added email field based on validation error
      })
    });
    
    if (response.ok) {
      const userData = await response.json();
      console.log('✅ Login successful!');
      console.log('User data:', {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        userType: userData.userType
      });
    } else {
      const errorText = await response.text();
      console.error('❌ Login failed with status:', response.status);
      console.error('Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Error during web login test:', error);
  }
}

// Run the test
testWebLogin();