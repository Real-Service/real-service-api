import pg from 'pg';
import dotenv from 'dotenv';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

// Initialize dotenv
dotenv.config();

const scryptAsync = promisify(scrypt);
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test password hashing and comparison
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  try {
    console.log(`Password stored: ${stored}`);
    const [hashed, salt] = stored.split(".");
    console.log(`Hashed part: ${hashed.substring(0, 20)}... (length: ${hashed.length})`);
    console.log(`Salt part: ${salt} (length: ${salt.length})`);
    
    const hashedBuf = Buffer.from(hashed, "hex");
    console.log(`Hashed buffer length: ${hashedBuf.length}`);
    
    const suppliedBuf = (await scryptAsync(supplied, salt, 64));
    console.log(`Supplied buffer length: ${suppliedBuf.length}`);
    
    if (hashedBuf.length !== suppliedBuf.length) {
      console.log(`Buffer length mismatch: ${hashedBuf.length} vs ${suppliedBuf.length}`);
      
      // Try alternate approach for 28-character hash format
      if (hashed.length === 28) {
        console.log("Detected 28-character hash format, using alternate approach");
        // Convert the 28-character hash to base64 format
        const rawPasswordBuf = await scryptAsync(supplied, salt, 16);
        const rawPasswordHash = rawPasswordBuf.toString('base64');
        return rawPasswordHash === hashed;
      }
      
      return false;
    }
    
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (err) {
    console.error(`Error in comparePasswords: ${err.message}`);
    return false;
  }
}

async function testCredentials(username, password) {
  try {
    // Look up user
    console.log(`Looking up user with username: ${username}`);
    const userResult = await pool.query('SELECT id, username, password, "userType" FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      console.log(`User '${username}' not found in database`);
      return false;
    }
    
    const user = userResult.rows[0];
    console.log(`Found user: ID=${user.id}, Type=${user.userType}`);
    
    // Check password format
    const passwordParts = user.password.split('.');
    console.log(`Password format: ${passwordParts.length} parts, length=${user.password.length}`);
    
    // Test password comparison
    try {
      const match = await comparePasswords(password, user.password);
      console.log(`Password comparison result: ${match ? 'MATCH' : 'NO MATCH'}`);
      return match;
    } catch (err) {
      console.error('Error comparing passwords:', err);
      return false;
    }
  } catch (err) {
    console.error('Error in test credentials:', err);
    return false;
  }
}

async function testLoginFlow() {
  try {
    console.log("Testing login flow with known credentials...");
    
    // Test known users from different user types
    const testUsers = [
      { username: 'landlord1', password: 'password123', type: 'landlord' },
      { username: 'landlord2', password: 'password123', type: 'landlord' },
      { username: 'contractor7', password: 'password123', type: 'contractor' },
      { username: 'contractor 10', password: 'password123', type: 'contractor' }
    ];
    
    for (const user of testUsers) {
      console.log(`\nTesting login for ${user.type} user: ${user.username}`);
      const result = await testCredentials(user.username, user.password);
      console.log(`Authentication result for ${user.username}: ${result ? 'SUCCESS' : 'FAILED'}`);
    }
    
  } catch (err) {
    console.error('Error testing login flow:', err);
  } finally {
    await pool.end();
  }
}

testLoginFlow();