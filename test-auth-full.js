/**
 * Comprehensive test for all authentication methods
 * This script tests all authentication methods to ensure they work with the new authDb implementation
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000';

async function testAllAuthenticationMethods() {
  console.log('----- TESTING ALL AUTHENTICATION METHODS -----');
  try {
    // 1. Test auto-login endpoint
    console.log('\n1. Testing auto-login endpoint:');
    const autoLoginResponse = await axios.get(`${API_URL}/api/auto-login`);
    console.log('Auto-login response:', autoLoginResponse.data);
    console.log('Status:', autoLoginResponse.status);
    
    // 2. Test contractor10-login endpoint
    console.log('\n2. Testing contractor10-login endpoint:');
    const contractor10Response = await axios.get(`${API_URL}/api/contractor10-login`);
    console.log('Contractor 10 login response:', contractor10Response.data);
    console.log('Status:', contractor10Response.status);
    const userId = contractor10Response.data.user.id;
    
    // 3. Test X-User-ID header authentication
    console.log('\n3. Testing X-User-ID header authentication:');
    const headerAuthResponse = await axios.get(`${API_URL}/api/user`, {
      headers: {
        'X-User-ID': userId
      }
    });
    console.log('X-User-ID auth response:', headerAuthResponse.data);
    console.log('Status:', headerAuthResponse.status);
    
    // 4. Test query parameter authentication
    console.log('\n4. Testing query parameter authentication:');
    const queryAuthResponse = await axios.get(`${API_URL}/api/user?user_id=${userId}`);
    console.log('Query parameter auth response:', queryAuthResponse.data);
    console.log('Status:', queryAuthResponse.status);
    
    console.log('\nAll authentication methods tested successfully!');
    
  } catch (error) {
    console.error('Error during authentication tests:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testAllAuthenticationMethods();