/**
 * Test script for login using snake_case column names
 * Tests all login methods:
 * 1. Using username (contractor10)
 * 2. Using email (contractor10@expressbd.ca)
 * 3. Using shorthand (contractor 10)
 */

async function testSnakeCaseLogin() {
  console.log('Testing snake_case login routes with various credentials...');
  
  // Test credentials for each method
  const testCases = [
    { 
      description: 'Login with username', 
      credentials: { email: 'contractor10', password: 'password' } 
    },
    { 
      description: 'Login with email', 
      credentials: { email: 'contractor10@expressbd.ca', password: 'password' } 
    },
    { 
      description: 'Login with shorthand name', 
      credentials: { email: 'contractor 10', password: 'password' } 
    }
  ];
  
  // Use fetch to connect to the endpoint
  for (const testCase of testCases) {
    console.log(`\n${testCase.description}:`);
    
    try {
      const response = await fetch('http://localhost:5000/api/snake-case-auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(testCase.credentials)
      });
      
      const status = response.status;
      console.log(`Status code: ${status}`);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('Login successful!');
        console.log('User data:', JSON.stringify(userData, null, 2));
      } else {
        const errorData = await response.json();
        console.error('Login failed:', errorData);
      }
    } catch (error) {
      console.error('Error testing login:', error.message);
    }
  }
  
  console.log('\nLogin tests complete!');
}

// Run the test
testSnakeCaseLogin().catch(console.error);