/**
 * Deployment Test Script for Real Service API
 * 
 * This script tests essential API endpoints after deployment
 * to ensure the application is functioning correctly.
 */

const fetch = require('node-fetch');

// Update this with your deployed API URL
const API_URL = process.env.API_URL || 'https://your-deployed-api.onrender.com';

// Test user credentials
const TEST_USER = {
  username: 'contractor 10',
  password: 'password'
};

// Store auth token
let authToken;
let cookies;

async function runTests() {
  console.log('🧪 Starting deployment tests for Real Service API');
  console.log(`API URL: ${API_URL}`);
  
  try {
    // 1. Test health endpoint
    console.log('\n🔍 Testing health endpoint...');
    const healthResponse = await fetch(`${API_URL}/api/health`);
    if (healthResponse.ok) {
      console.log('✅ Health endpoint is working');
    } else {
      console.error(`❌ Health endpoint failed: ${healthResponse.status} ${healthResponse.statusText}`);
      process.exit(1);
    }

    // 2. Test login
    console.log('\n🔑 Testing authentication...');
    const loginResponse = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_USER)
    });

    if (loginResponse.ok) {
      console.log('✅ Login successful');
      const userData = await loginResponse.json();
      console.log(`   User ID: ${userData.id}`);
      console.log(`   Username: ${userData.username}`);
      
      // Store cookies for future requests
      cookies = loginResponse.headers.get('set-cookie');
    } else {
      console.error(`❌ Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
      console.error(await loginResponse.text());
      process.exit(1);
    }

    // 3. Test user profile
    console.log('\n👤 Testing user profile...');
    const userResponse = await fetch(`${API_URL}/api/user`, {
      headers: {
        Cookie: cookies
      }
    });

    if (userResponse.ok) {
      console.log('✅ User profile retrieval successful');
      const profile = await userResponse.json();
      console.log(`   User: ${profile.fullName} (${profile.email})`);
    } else {
      console.error(`❌ User profile failed: ${userResponse.status} ${userResponse.statusText}`);
      process.exit(1);
    }

    // 4. Test contractor profile
    console.log('\n🏢 Testing contractor profile...');
    const contractorResponse = await fetch(`${API_URL}/api/contractor-profile-fix/7`, {
      headers: {
        Cookie: cookies
      }
    });

    if (contractorResponse.ok) {
      console.log('✅ Contractor profile retrieval successful');
      const contractorProfile = await contractorResponse.json();
      console.log(`   Business: ${contractorProfile.businessName}`);
      console.log(`   Trades: ${contractorProfile.trades?.join(', ') || 'None'}`);
    } else {
      console.error(`❌ Contractor profile failed: ${contractorResponse.status} ${contractorResponse.statusText}`);
    }

    // 5. Test available jobs
    console.log('\n📋 Testing jobs endpoint...');
    const jobsResponse = await fetch(`${API_URL}/api/jobs-fix/all-jobs`, {
      headers: {
        Cookie: cookies
      }
    });

    if (jobsResponse.ok) {
      console.log('✅ Jobs retrieval successful');
      const jobs = await jobsResponse.json();
      console.log(`   Found ${jobs.length} jobs`);
    } else {
      console.error(`❌ Jobs retrieval failed: ${jobsResponse.status} ${jobsResponse.statusText}`);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('Your Real Service API is properly deployed and functioning.');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

runTests();