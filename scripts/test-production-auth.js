/**
 * Test production authentication with direct database connection
 * 
 * This script attempts to authenticate a user directly against the database
 * using a production-compatible connection method.
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

// Load environment variables
dotenv.config();

// Set up crypto helpers for password verification
const scrypt = promisify(crypto.scrypt);

async function comparePasswords(supplied, stored) {
  try {
    // Check if stored password has the expected format
    if (!stored || !stored.includes('.')) {
      console.log('❌ Stored password is not in the expected format');
      return false;
    }
    
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = await scrypt(supplied, salt, 64);
    
    // Convert suppliedBuf to Buffer if it's not already
    const suppliedBuffer = Buffer.isBuffer(suppliedBuf) ? suppliedBuf : Buffer.from(suppliedBuf);
    
    return crypto.timingSafeEqual(hashedBuf, suppliedBuffer);
  } catch (error) {
    console.error('Password comparison error:', error.message);
    
    // Let's log additional debug information
    if (stored) {
      console.log(`Stored password hash length: ${stored.split('.')[0].length}`);
    }
    
    return false;
  }
}

async function testProductionAuth(username, password) {
  // Create a database connection using standard pg Pool for production compatibility
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log(`Testing authentication for user: ${username}`);
    
    // Get user by username
    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`User ${username} not found in database`);
      return false;
    }
    
    const user = userResult.rows[0];
    
    // Log password format (safely)
    if (user.password) {
      console.log('Password format check:');
      console.log(`- Contains dot separator: ${user.password.includes('.')}`);
      console.log(`- Password parts: ${user.password.split('.').length}`);
      if (user.password.includes('.')) {
        const [hash, salt] = user.password.split('.');
        console.log(`- Hash part length: ${hash.length}`);
        console.log(`- Salt part length: ${salt.length}`);
      }
    }
    
    // Check password
    const passwordValid = await comparePasswords(password, user.password);
    
    if (passwordValid) {
      console.log('✅ Authentication successful!');
      console.log('User details:');
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Full Name: ${user.fullName}`);
      console.log(`User Type: ${user.userType}`);
      
      // Get profile information based on user type
      if (user.userType === 'landlord') {
        const profileResult = await pool.query(
          'SELECT * FROM landlord_profiles WHERE "userId" = $1',
          [user.id]
        );
        
        if (profileResult.rows.length > 0) {
          console.log('\nLandlord Profile:');
          console.log(`Bio: ${profileResult.rows[0].bio}`);
          console.log(`Wallet Balance: $${profileResult.rows[0].walletBalance}`);
        }
      } else if (user.userType === 'contractor') {
        const profileResult = await pool.query(
          'SELECT * FROM contractor_profiles WHERE "userId" = $1',
          [user.id]
        );
        
        if (profileResult.rows.length > 0) {
          const profile = profileResult.rows[0];
          console.log('\nContractor Profile:');
          console.log(`Business Name: ${profile.businessName}`);
          console.log(`Bio: ${profile.bio}`);
          console.log(`Years in Business: ${profile.yearsInBusiness}`);
          console.log(`Wallet Balance: $${profile.walletBalance}`);
        }
      }
      
      return true;
    } else {
      console.log('❌ Authentication failed: Incorrect password');
      return false;
    }
    
  } catch (error) {
    console.error('Error testing authentication:', error);
    return false;
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const username = args[0] || 'landlord1';
const password = args[1] || 'password123';

// Run the test
testProductionAuth(username, password)
  .then(result => {
    console.log(`\nAuthentication test ${result ? 'passed' : 'failed'}`);
    if (!result) {
      console.log('\nTip: If you know the correct password, run this script with:');
      console.log(`node scripts/test-production-auth.js ${username} YOUR_PASSWORD`);
    }
    process.exit(result ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running authentication test:', error);
    process.exit(1);
  });