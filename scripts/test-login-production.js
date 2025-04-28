/**
 * Script to test login functionality in production
 * Tests both contractor and landlord accounts
 */

import fetch from 'node-fetch';

// Users to test
const users = [
  { username: 'contractor 10', password: 'password', type: 'contractor' },
  { username: 'testuser', password: 'password123', type: 'contractor' },
  { username: 'landlord1', password: 'password123', type: 'landlord' }
];

async function testLogin(username, password) {
  try {
    // Make the login request
    console.log(`Attempting to login as: ${username}`);
    const response = await fetch('https://real-service.chrisjames.repl.co/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
      const userData = await response.json();
      console.log(`✅ Login successful for ${username} (${userData.userType})`);
      console.log(`User ID: ${userData.id}`);
      console.log(`Email: ${userData.email}`);
      console.log(`Full Name: ${userData.fullName}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ Login failed for ${username}: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error during login for ${username}: ${error.message}`);
    return false;
  }
}

async function testAllUsers() {
  console.log('TESTING PRODUCTION LOGIN FUNCTIONALITY');
  console.log('=====================================');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const user of users) {
    console.log(`\nTesting ${user.type} user: ${user.username}`);
    const success = await testLogin(user.username, user.password);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\n=====================================');
  console.log(`RESULTS: ${successCount} successful logins, ${failCount} failed logins`);
  
  if (failCount === 0) {
    console.log('✅ All login tests passed successfully!');
  } else {
    console.log('❌ Some login tests failed. Check the logs above for details.');
  }
}

testAllUsers();