import pg from 'pg';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import bcrypt from 'bcrypt';
import { promisify } from 'util';
import crypto from 'crypto';

// Initialize dotenv
dotenv.config();

// Setup crypto
const scryptAsync = promisify(crypto.scrypt);

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test passwords
const TEST_PASSWORDS = [
  'password',
  'password123',
  'Password123',
  '123456',
  'landlord',
  'contractor'
];

async function checkPasswordFormat(user) {
  console.log(`\n====== Password Analysis for User ID ${user.id}: ${user.username} (${user.email}) ======`);
  
  // Check for bcrypt format (starts with $2b$)
  if (user.password.startsWith('$2b$')) {
    console.log('Password is in bcrypt format');
    
    // Try passwords with bcrypt
    for (const testPassword of TEST_PASSWORDS) {
      try {
        const isMatch = await bcrypt.compare(testPassword, user.password);
        if (isMatch) {
          console.log(`✅ MATCH FOUND (bcrypt): Password is "${testPassword}"`);
          return true;
        }
      } catch (err) {
        console.error(`Error comparing bcrypt password: ${err.message}`);
      }
    }
    console.log('❌ No matching password found with bcrypt format');
  } 
  // Check for scrypt format (hash.salt format)
  else if (user.password.includes('.')) {
    console.log('Password is in scrypt format (hash.salt)');
    
    const [hashed, salt] = user.password.split('.');
    console.log(`- Hash part: ${hashed.substring(0, 10)}... (${hashed.length} chars)`);
    console.log(`- Salt part: ${salt} (${salt.length} chars)`);
    
    // Try passwords with scrypt
    for (const testPassword of TEST_PASSWORDS) {
      try {
        const hashedBuf = Buffer.from(hashed, 'hex');
        const suppliedBuf = await scryptAsync(testPassword, salt, 64);
        
        if (hashedBuf.length === suppliedBuf.length) {
          let match = true;
          for (let i = 0; i < hashedBuf.length; i++) {
            if (hashedBuf[i] !== suppliedBuf[i]) {
              match = false;
              break;
            }
          }
          
          if (match) {
            console.log(`✅ MATCH FOUND (scrypt): Password is "${testPassword}"`);
            return true;
          }
        }
      } catch (err) {
        console.error(`Error comparing scrypt password: ${err.message}`);
      }
    }
    console.log('❌ No matching password found with scrypt format');
  } else {
    console.log(`Unknown password format: ${user.password.substring(0, 10)}... (${user.password.length} chars)`);
  }
  
  return false;
}

async function checkAllUsers() {
  try {
    // Get all users
    const userResult = await pool.query('SELECT id, username, email, password, "userType" FROM users ORDER BY id');
    
    console.log(`Found ${userResult.rows.length} users in the database`);
    
    // Check each user's password
    let matchCount = 0;
    
    for (const user of userResult.rows) {
      const found = await checkPasswordFormat(user);
      if (found) {
        matchCount++;
      }
    }
    
    console.log(`\n====== SUMMARY ======`);
    console.log(`Found passwords for ${matchCount} out of ${userResult.rows.length} users`);
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkAllUsers();