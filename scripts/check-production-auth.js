/**
 * Production Auth System Check
 * 
 * This script verifies the production database connection and authentication system
 * by checking:
 * 1. Session table is correctly set up
 * 2. All required users exist with the correct usernames, emails, and types
 * 3. Password hashing is correctly implemented for both formats
 */

import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';
import bcrypt from 'bcrypt';

// Convert scrypt to Promise-based function
const scryptAsync = promisify(crypto.scrypt);

// Create pool for production database
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// Password verification functions for different hash formats
async function compareScryptPasswords(supplied, stored) {
  try {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    
    // Handle different hash lengths
    const hashByteLength = hashedBuf.length;
    const suppliedBuf = await scryptAsync(supplied, salt, hashByteLength);
    
    return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing scrypt passwords:', error.message);
    return false;
  }
}

async function compareBcryptPasswords(supplied, stored) {
  try {
    return await bcrypt.compare(supplied, stored);
  } catch (error) {
    console.error('Error comparing bcrypt passwords:', error.message);
    return false;
  }
}

async function comparePasswords(supplied, stored) {
  // Check if it's a bcrypt format password (starts with $2b$)
  if (stored.startsWith('$2b$')) {
    console.log('Using bcrypt comparison for password');
    return await compareBcryptPasswords(supplied, stored);
  }
  
  // Otherwise, process as our scrypt format
  if (!stored || !stored.includes('.')) {
    console.log('Invalid password format - not scrypt or bcrypt');
    return false;
  }
  
  console.log('Using scrypt comparison for password');
  return await compareScryptPasswords(supplied, stored);
}

async function checkProductionAuth() {
  console.log('🔍 Running Production Authentication System Check\n');
  
  try {
    // Test 1: Check database connection
    console.log('✅ Test 1: Database Connection');
    const dbCheckResult = await pool.query('SELECT NOW() as time');
    console.log(`Connected to database at ${dbCheckResult.rows[0].time}\n`);
    
    // Test 2: Check if session table exists
    console.log('✅ Test 2: Session Table');
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'session'
      )
    `);
    
    if (tableCheckResult.rows[0].exists) {
      console.log('Session table exists in database');
      
      // Check session table structure
      const sessionColumns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'session'
      `);
      
      console.log('Session table structure:');
      sessionColumns.rows.forEach(col => {
        console.log(`- ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('⚠️ Session table does not exist - session persistence will not work');
    }
    console.log();
    
    // Test 3: Check user table
    console.log('✅ Test 3: User Table');
    const userColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    console.log('User table structure:');
    userColumns.rows.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type})`);
    });
    
    // Check for key fields needed for auth - using camelCase for production DB
    const requiredColumns = ['id', 'username', 'email', 'password', 'userType'];
    const missingColumns = requiredColumns.filter(
      col => !userColumns.rows.find(c => c.column_name === col)
    );
    
    if (missingColumns.length > 0) {
      console.log(`⚠️ Missing required columns in users table: ${missingColumns.join(', ')}`);
    } else {
      console.log('✅ All required user columns exist');
    }
    console.log();
    
    // Test 4: Check migrated users exist
    console.log('✅ Test 4: User Existence');
    const usersToCheck = [
      'testuser', 'contractor 10', 'landlord1', 'landlord2', 
      'contractor1', 'contractor7', 'contractor 7'
    ];
    
    let allUsersFound = true;
    for (const username of usersToCheck) {
      const userResult = await pool.query(
        'SELECT id, username, email, "userType" FROM users WHERE username = $1',
        [username]
      );
      
      if (userResult.rows.length === 0) {
        console.log(`⚠️ User ${username} not found in database`);
        allUsersFound = false;
      } else {
        const user = userResult.rows[0];
        console.log(`✅ Found user: ${user.username} (${user.email}), Type: ${user.userType}`);
      }
    }
    
    if (allUsersFound) {
      console.log('✅ All required users found in database');
    } else {
      console.log('⚠️ Some users are missing');
    }
    console.log();
    
    // Test 5: Password authentication
    console.log('✅ Test 5: Password Authentication');
    const testCredentials = [
      { username: 'testuser', password: 'password123' },
      { username: 'contractor 10', password: 'password' }
    ];
    
    for (const cred of testCredentials) {
      const userResult = await pool.query(
        'SELECT id, username, password FROM users WHERE username = $1',
        [cred.username]
      );
      
      if (userResult.rows.length === 0) {
        console.log(`⚠️ User ${cred.username} not found for password test`);
        continue;
      }
      
      const user = userResult.rows[0];
      const storedHash = user.password;
      
      console.log(`Testing password for ${cred.username}`);
      console.log(`Password format: ${storedHash.startsWith('$2b$') ? 'bcrypt' : 'scrypt'}`);
      
      const passwordValid = await comparePasswords(cred.password, storedHash);
      
      if (passwordValid) {
        console.log(`✅ Password valid for ${cred.username}`);
      } else {
        console.log(`❌ Password invalid for ${cred.username}`);
      }
    }
    
    console.log('\n🎯 Authentication System Check Complete\n');
    
  } catch (error) {
    console.error('Error during authentication check:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkProductionAuth();