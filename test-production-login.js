/**
 * Test login functionality for all migrated users
 * This script tests the login endpoint with each user's credentials
 */

import axios from 'axios';

async function testProductionLogin() {
  try {
    console.log('Testing login for all migrated users in production database...\n');
    
    // List of users to test
    const users = [
      { email: 'testuser', password: 'password123' },
      { email: 'contractor', password: 'password123' },
      { email: 'landlord', password: 'password123' },
      { email: 'contractor10', password: 'password' },
      { email: 'landlord1', password: 'password123' },
      { email: 'landlord2', password: 'password123' },
      { email: 'contractor1', password: 'password123' },
      { email: 'contractor7', password: 'password123' }
    ];
    
    // API endpoint to test - using the actual Replit URL
    const loginUrl = 'https://workspace.simeonjohnson4.repl.co/api/login';
    
    let successCount = 0;
    
    // Test each user login
    for (const user of users) {
      try {
        console.log(`Testing login for user: ${user.email}`);
        
        const response = await axios.post(loginUrl, {
          email: user.email,
          password: user.password
        });
        
        if (response.status === 200 && response.data.id) {
          console.log(`✅ Login successful for ${user.email} (ID: ${response.data.id}, Type: ${response.data.userType})`);
          successCount++;
        } else {
          console.log(`❌ Unexpected response for ${user.email}:`, response.status, response.data);
        }
      } catch (error) {
        console.log(`❌ Login failed for ${user.email}: ${error.response?.status} ${error.response?.data?.message || error.message}`);
      }
      
      console.log('---');
    }
    
    console.log(`\nResults: ${successCount}/${users.length} users logged in successfully`);
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testProductionLogin();