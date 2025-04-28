// Comprehensive test script that verifies the full authentication flow
// including registration, login, and token-based authentication
import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = 'http://localhost:5000';

// Test user for complete flow
const TEST_USER = {
  username: `testuser_${Date.now().toString().slice(-6)}`, // Generate unique username
  email: `test${Date.now().toString().slice(-6)}@example.com`, // Generate unique email
  password: 'TestPassword123!',
  fullName: 'Test Complete Flow User',
  userType: 'contractor',
  phone: '555-123-4567'
};

// Store session data between requests
let authData = {
  cookies: null,
  userId: null,
  authToken: null,
  authTimestamp: null
};

async function testCompleteAuthFlow() {
  console.log('🔄 Testing complete authentication flow...');
  console.log('Test user:', JSON.stringify(TEST_USER, null, 2));
  
  try {
    // Step 1: Register a new user
    console.log('\n📝 Step 1: Register a new user');
    const registerResponse = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_USER)
    });
    
    console.log(`Registration status: ${registerResponse.status} ${registerResponse.statusText}`);
    
    if (registerResponse.ok) {
      const userData = await registerResponse.json();
      console.log('✅ Registration successful!');
      console.log('User data:', userData);
      
      // Store user ID and cookies
      authData.userId = userData.id;
      authData.cookies = registerResponse.headers.get('set-cookie');
      authData.authToken = userData.authToken;
      authData.authTimestamp = userData.authTimestamp;
      
      console.log('Auth data:', JSON.stringify(authData, null, 2));
      
      // Step 2: Verify user is authenticated after registration
      console.log('\n📝 Step 2: Verify user is authenticated after registration');
      const userResponse = await fetch(`${BASE_URL}/api/user`, {
        method: 'GET',
        headers: {
          'Cookie': authData.cookies
        }
      });
      
      console.log(`User verification status: ${userResponse.status} ${userResponse.statusText}`);
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('✅ User verification successful!');
        console.log('User data:', userData);
      } else {
        console.error('❌ User verification failed!');
        console.error('Trying token-based authentication instead...');
        
        // Try with header authentication
        const headerAuthResponse = await fetch(`${BASE_URL}/api/user`, {
          method: 'GET',
          headers: {
            'X-User-ID': authData.userId,
            'X-Auth-Token': authData.authToken,
            'X-Auth-Timestamp': authData.authTimestamp
          }
        });
        
        console.log(`Header auth status: ${headerAuthResponse.status} ${headerAuthResponse.statusText}`);
        
        if (headerAuthResponse.ok) {
          const userData = await headerAuthResponse.json();
          console.log('✅ Token-based authentication successful!');
          console.log('User data:', userData);
        }
      }
      
      // Step 3: Log out
      console.log('\n📝 Step 3: Log out');
      const logoutResponse = await fetch(`${BASE_URL}/api/logout`, {
        method: 'POST',
        headers: {
          'Cookie': authData.cookies
        }
      });
      
      console.log(`Logout status: ${logoutResponse.status} ${logoutResponse.statusText}`);
      
      if (logoutResponse.ok) {
        console.log('✅ Logout successful!');
      } else {
        console.error('❌ Logout failed!');
      }
      
      // Step 4: Login again
      console.log('\n📝 Step 4: Login again');
      const loginResponse = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: TEST_USER.email,
          password: TEST_USER.password
        })
      });
      
      console.log(`Login status: ${loginResponse.status} ${loginResponse.statusText}`);
      
      if (loginResponse.ok) {
        const userData = await loginResponse.json();
        console.log('✅ Login successful!');
        console.log('User data:', userData);
        
        // Update auth data with new token
        authData.cookies = loginResponse.headers.get('set-cookie');
        authData.authToken = userData.authToken;
        authData.authTimestamp = userData.authTimestamp;
        
        // Step 5: Verify token-based authentication
        console.log('\n📝 Step 5: Verify token-based authentication');
        const tokenAuthResponse = await fetch(`${BASE_URL}/api/user`, {
          method: 'GET',
          headers: {
            'X-User-ID': authData.userId,
            'X-Auth-Token': authData.authToken,
            'X-Auth-Timestamp': authData.authTimestamp
          }
        });
        
        console.log(`Token auth status: ${tokenAuthResponse.status} ${tokenAuthResponse.statusText}`);
        
        if (tokenAuthResponse.ok) {
          const userData = await tokenAuthResponse.json();
          console.log('✅ Token-based authentication successful!');
          console.log('User data:', userData);
        } else {
          console.error('❌ Token-based authentication failed!');
        }
      } else {
        console.error('❌ Login failed!');
        if (loginResponse.status === 401) {
          console.error('Reason: Invalid credentials (401 Unauthorized)');
        } else if (loginResponse.status === 400) {
          console.error('Reason: Bad Request (400)');
          const errorData = await loginResponse.text();
          console.error('Error details:', errorData);
        }
      }
      
    } else {
      console.error('❌ Registration failed!');
      const errorData = await registerResponse.text();
      console.error('Error details:', errorData);
    }
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

testCompleteAuthFlow();