// Script to create a test user for login testing
import pg from 'pg';
import dotenv from 'dotenv';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

// Convert callback-based scrypt to Promise-based
const scryptAsync = promisify(scrypt);

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: false 
  }
});

// Function to hash a password securely
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

// Define test users
const testUsers = [
  {
    username: 'testcontractor',
    email: 'contractor@example.com',
    password: 'password123', // This will be hashed
    fullName: 'Test Contractor',
    userType: 'contractor',
    phone: '555-987-6543'
  }
];

async function createTestUsers() {
  console.log('🔄 Creating test users...');
  
  try {
    // Check if users already exist
    const existingUsers = await pool.query(`
      SELECT username FROM users 
      WHERE username = ANY($1)
    `, [testUsers.map(u => u.username)]);
    
    if (existingUsers.rows.length > 0) {
      console.log('⚠️ Some test users already exist:');
      existingUsers.rows.forEach(row => {
        console.log(`- ${row.username}`);
      });
    }
    
    // Create each test user if they don't exist
    for (const userData of testUsers) {
      const existingUser = existingUsers.rows.find(u => u.username === userData.username);
      
      if (existingUser) {
        console.log(`⏩ Skipping existing user: ${userData.username}`);
        continue;
      }
      
      const hashedPassword = await hashPassword(userData.password);
      
      // Insert the new user
      const result = await pool.query(`
        INSERT INTO users (
          username, email, password, full_name, user_type, phone,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 
          NOW(), NOW()
        ) RETURNING id, username
      `, [
        userData.username,
        userData.email,
        hashedPassword,
        userData.fullName,
        userData.userType,
        userData.phone
      ]);
      
      const newUser = result.rows[0];
      console.log(`✅ Created test user: ${newUser.username} (ID: ${newUser.id})`);
      
      // Create profile based on user type
      if (userData.userType === 'landlord') {
        await pool.query(`
          INSERT INTO landlord_profiles (
            user_id, bio
          ) VALUES (
            $1, $2
          )
        `, [
          newUser.id,
          `${userData.fullName}'s landlord profile`
        ]);
        console.log(`✅ Created landlord profile for user: ${newUser.username}`);
      } else if (userData.userType === 'contractor') {
        await pool.query(`
          INSERT INTO contractor_profiles (
            user_id, bio, business_name, hourly_rate
          ) VALUES (
            $1, $2, $3, $4
          )
        `, [
          newUser.id,
          'Professional contractor providing quality services',
          `${userData.fullName}'s Services`,
          85.00
        ]);
        console.log(`✅ Created contractor profile for user: ${newUser.username}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    return false;
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

// Run the script
createTestUsers()
  .then(success => {
    if (success) {
      console.log('✅ Test users created successfully!');
      console.log('\n📝 Login credentials:');
      testUsers.forEach(user => {
        console.log(`- ${user.userType}: ${user.username} / ${user.password}`);
      });
      process.exit(0);
    } else {
      console.error('❌ Failed to create test users!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Unhandled error:', err);
    process.exit(1);
  });