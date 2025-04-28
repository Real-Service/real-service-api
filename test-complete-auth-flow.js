import pg from 'pg';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { promisify } from 'util';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Initialize dotenv
dotenv.config();

const scryptAsync = promisify(crypto.scrypt);

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Password hashing function (scrypt format)
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

// Password comparison function for both bcrypt and scrypt
async function comparePasswords(plaintext, stored) {
  // Check if it's a bcrypt hash (starts with $2b$)
  if (stored.startsWith('$2b$')) {
    return bcrypt.compare(plaintext, stored);
  }
  
  // Otherwise, assume it's a scrypt hash (hash.salt format)
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(plaintext, salt, 64);
  
  // Compare buffers using timingSafeEqual
  if (hashedBuf.length === suppliedBuf.length) {
    return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
  }
  
  return false;
}

async function testCompleteAuthFlow() {
  try {
    console.log('Testing complete authentication flow with known users:');
    
    // Define users to test with known passwords
    const usersToTest = [
      { username: 'contractor 10', password: 'password' },
      { username: 'testuser586577', password: 'password123' },
      { username: 'testuser605623', password: 'password123' },
      { username: 'testuser818072', password: 'password123' },
      { username: 'testlandlord', password: 'password123' },
      { username: 'testuser', password: 'password123' },
      { username: 'testuser903684', password: 'password123' }
    ];
    
    for (const user of usersToTest) {
      console.log(`\n----- Testing user: ${user.username} -----`);
      
      // 1. Verify user exists in database
      const userQuery = await pool.query(
        'SELECT id, username, email, password, "userType" FROM users WHERE username = $1',
        [user.username]
      );
      
      if (userQuery.rows.length === 0) {
        console.log(`❌ User not found in database: ${user.username}`);
        continue;
      }
      
      const dbUser = userQuery.rows[0];
      console.log(`✅ Found user in database: ID=${dbUser.id}, Type=${dbUser.userType}, Email=${dbUser.email}`);
      
      // 2. Verify password matches using our comparison function
      const passwordMatch = await comparePasswords(user.password, dbUser.password);
      console.log(`${passwordMatch ? '✅' : '❌'} Password match using our comparison function: ${passwordMatch}`);
      
      // 3. Test login API
      try {
        const loginResponse = await fetch('http://localhost:5000/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: user.username, password: user.password }),
        });
        
        if (loginResponse.ok) {
          const userData = await loginResponse.json();
          console.log('✅ API login successful!');
          console.log('User data from API:', userData);
        } else {
          const errorData = await loginResponse.json();
          console.log('❌ API login failed:', errorData);
        }
      } catch (error) {
        console.error('Error during API login:', error.message);
      }
      
      // 4. Test direct login API
      try {
        const directLoginResponse = await fetch('http://localhost:5000/api/direct-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: user.username, password: user.password }),
        });
        
        if (directLoginResponse.ok) {
          const userData = await directLoginResponse.json();
          console.log('✅ Direct login successful!');
          console.log('User data from direct login API:', userData);
        } else {
          const errorData = await directLoginResponse.json();
          console.log('❌ Direct login failed:', errorData);
        }
      } catch (error) {
        console.error('Error during direct login:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
    console.log('\nTest completed');
  }
}

// Run the test
testCompleteAuthFlow();