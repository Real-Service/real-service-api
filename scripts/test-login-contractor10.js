/**
 * Test authentication for contractor 10
 */

import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';
const { Pool } = pg;

// Define which user to test
const TEST_USERNAME = 'contractor 10';
const TEST_PASSWORD = 'password'; // From PRODUCTION_LOGIN_CREDENTIALS.md

// Promisify scrypt function
const scryptAsync = promisify(crypto.scrypt);

// Create production pool with correct settings
const productionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Compare passwords using scrypt format
 */
async function compareScryptPasswords(supplied, stored) {
  try {
    // Format is hash.salt in hex
    const [hashed, salt] = stored.split('.');
    const hashedBuf = Buffer.from(hashed, 'hex');
    const suppliedBuf = await scryptAsync(supplied, salt, 64);
    return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing scrypt passwords:', error);
    return false;
  }
}

/**
 * Compare passwords using bcrypt format
 */
async function compareBcryptPasswords(supplied, stored) {
  try {
    // Use dynamic import for bcrypt (CommonJS module)
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(supplied, stored);
  } catch (error) {
    console.error('Error comparing bcrypt passwords:', error);
    return false;
  }
}

/**
 * Compare password with database hash, using correct method
 */
async function comparePasswords(supplied, stored) {
  // If password starts with $2b, it's bcrypt
  if (stored.startsWith('$2')) {
    return compareBcryptPasswords(supplied, stored);
  }
  // Otherwise assume scrypt format
  return compareScryptPasswords(supplied, stored);
}

async function testDirectLogin() {
  console.log(`Testing direct login for ${TEST_USERNAME}...`);

  try {
    // Get user from database
    const result = await productionPool.query(
      'SELECT * FROM users WHERE username = $1',
      [TEST_USERNAME]
    );

    if (result.rows.length === 0) {
      console.error(`User ${TEST_USERNAME} not found`);
      await productionPool.end();
      return;
    }

    const user = result.rows[0];
    console.log(`Found user ${user.username} (ID: ${user.id})`);
    
    // Check password format (just for info, don't log the actual hash)
    console.log(`Password format: ${user.password.startsWith('$2') ? 'bcrypt' : 'scrypt'}`);
    
    // Compare password
    const passwordCorrect = await comparePasswords(TEST_PASSWORD, user.password);
    
    if (passwordCorrect) {
      console.log('✅ Password is correct! Authentication successful.');
    } else {
      console.log('❌ Password is incorrect. Authentication failed.');
    }

    // Get profile info if auth successful
    if (passwordCorrect) {
      if (user.usertype === 'contractor') {
        const profileResult = await productionPool.query(
          'SELECT * FROM contractor_profiles WHERE "userId" = $1',
          [user.id]
        );
        
        if (profileResult.rows.length > 0) {
          console.log('✅ Found contractor profile');
          console.log(`Business name: ${profileResult.rows[0].businessname || 'Not set'}`);
        } else {
          console.log('❌ No contractor profile found');
        }
      } else if (user.usertype === 'landlord') {
        const profileResult = await productionPool.query(
          'SELECT * FROM landlord_profiles WHERE "userId" = $1',
          [user.id]
        );
        
        if (profileResult.rows.length > 0) {
          console.log('✅ Found landlord profile');
        } else {
          console.log('❌ No landlord profile found');
        }
      }
    }

    // Close database connection
    await productionPool.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

// Run the test
testDirectLogin();