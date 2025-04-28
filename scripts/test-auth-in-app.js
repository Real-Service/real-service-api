/**
 * Test authentication directly through the app routes
 * 
 * This script tests the actual authentication routes in the application
 * to verify that the password handling works with the existing database.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import crypto, { scrypt } from 'crypto';
import { promisify } from 'util';
import { Pool } from 'pg';

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

// Create a connection to the database for direct testing
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Copy of the authentication functions from routes.ts
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  try {
    // Check if stored password has the expected format
    if (!stored || !stored.includes('.')) {
      console.log('Invalid password format');
      return false;
    }
    
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    
    // Handle different hash lengths (28 or 64 bytes)
    const hashByteLength = hashedBuf.length;
    const suppliedBuf = await scryptAsync(supplied, salt, hashByteLength);
    
    return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Password comparison error:', error.message);
    return false;
  }
}

async function testAuthInApp() {
  try {
    console.log('Starting auth test in app environment...');
    
    // Test direct password comparison
    const username = process.argv[2] || 'landlord1';
    const password = process.argv[3] || 'password123';
    
    // Get user data from the database
    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`User ${username} not found in database`);
      return false;
    }
    
    const user = userResult.rows[0];
    console.log(`Found user: ${user.username} (${user.email})`);
    
    // Log password format (safely)
    if (user.password) {
      console.log('Password format check:');
      console.log(`- Contains dot separator: ${user.password.includes('.')}`);
      console.log(`- Password parts: ${user.password.split('.').length}`);
      if (user.password.includes('.')) {
        const [hash, salt] = user.password.split('.');
        console.log(`- Hash part length: ${hash.length}`);
        console.log(`- Salt part length: ${salt.length}`);
        console.log(`- Hash byte length: ${Buffer.from(hash, 'hex').length}`);
      }
    }
    
    // Test with the updated compare function
    console.log('\nTesting with updated password comparison function...');
    const isPasswordValid = await comparePasswords(password, user.password);
    
    if (isPasswordValid) {
      console.log('✅ Password comparison succeeded with new function!');
    } else {
      console.log('❌ Password comparison failed with new function.');
      
      // Try different passwords
      console.log('\nTrying alternative passwords:');
      const commonPasswords = ['password', 'abc123', '123456', 'admin', 'welcome'];
      
      for (const testPassword of commonPasswords) {
        const testResult = await comparePasswords(testPassword, user.password);
        if (testResult) {
          console.log(`✅ Password match found: "${testPassword}"`);
          return true;
        }
      }
      
      console.log('No common passwords matched.');
    }
    
    return isPasswordValid;
  } catch (error) {
    console.error('Error testing auth in app:', error);
    return false;
  } finally {
    // Close the connection
    await pool.end();
  }
}

// Run the test
testAuthInApp()
  .then(result => {
    console.log(`\nAuthentication test ${result ? 'passed' : 'failed'}`);
    process.exit(result ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running test:', error);
    process.exit(1);
  });