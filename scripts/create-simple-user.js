// A simpler script to create one test user directly
import pg from 'pg';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Convert callback-based scrypt to Promise-based
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function createTestUser() {
  console.log('Creating test user...');
  
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Check if user exists
    const checkResult = await pool.query(
      "SELECT id FROM users WHERE username = 'testuser'");
    
    if (checkResult.rows.length > 0) {
      console.log('Test user already exists with ID:', checkResult.rows[0].id);
      return checkResult.rows[0].id;
    }
    
    // Create user
    const hashedPassword = await hashPassword('password123');
    
    const result = await pool.query(`
      INSERT INTO users 
      (username, email, password, full_name, user_type, created_at, updated_at) 
      VALUES 
      ('testuser', 'test@example.com', $1, 'Test User', 'contractor', NOW(), NOW())
      RETURNING id
    `, [hashedPassword]);
    
    const userId = result.rows[0].id;
    console.log('Created test user with ID:', userId);
    
    // Create contractor profile
    await pool.query(`
      INSERT INTO contractor_profiles
      (user_id, bio, business_name, hourly_rate)
      VALUES
      ($1, 'Test contractor bio', 'Test Contractor Business', 75)
    `, [userId]);
    
    console.log('Created contractor profile for user ID:', userId);
    return userId;
  } catch (error) {
    console.error('Error creating test user:', error);
    return null;
  } finally {
    await pool.end();
  }
}

// Run the script
createTestUser().then(userId => {
  if (userId) {
    console.log('✅ Test user created or already exists.');
    console.log('\n📝 Login credentials:');
    console.log('- Email: test@example.com');
    console.log('- Password: password123');
    console.log('\n📚 Usage Instructions:');
    console.log('- Use these credentials on the /auth page to log in');
    console.log('- For API testing, POST to /api/login with { "email": "test@example.com", "password": "password123" }');
  } else {
    console.error('❌ Failed to create test user!');
  }
});
