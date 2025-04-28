/**
 * Test simple authentication with snake_case column support
 * 
 * This test ensures that we can login using the simplified authentication
 * system that uses snake_case column names for production database compatibility.
 */

import fetch from 'node-fetch';

// We use either environment database URL or fallback to production
const DATABASE_URL = process.env.DATABASE_URL || 
  "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function testSimplifiedAuth() {
  console.log("Testing simplified authentication system...");
  console.log("Using database:", DATABASE_URL.split('@')[1]);
  
  // Test login with username
  await testLogin('contractor10', 'password');
  
  // Test login with email
  await testLogin('contractor10@expressbd.ca', 'password');
  
  // Test login with space in username
  await testLogin('contractor 10', 'password');
}

async function testLogin(email, password) {
  try {
    console.log(`\nTesting login with: ${email}`);
    
    // Send login request - use the URL of our Replit environment
    const response = await fetch('https://realservice.codereport.repl.co/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    // Check response
    if (response.ok) {
      const userData = await response.json();
      console.log("✅ Login successful!");
      console.log("User info:", JSON.stringify({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        user_type: userData.user_type,
        full_name: userData.full_name
      }, null, 2));
    } else {
      const error = await response.json();
      console.log("❌ Login failed:", error.message || "Unknown error");
    }
  } catch (error) {
    console.error("Error testing login:", error.message);
  }
}

// Run the test
testSimplifiedAuth().catch(console.error);