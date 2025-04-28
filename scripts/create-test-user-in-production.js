import pg from 'pg';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

// Production database URL
const PROD_DATABASE_URL = 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Create pool for production database
const pool = new pg.Pool({
  connectionString: PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Convert scrypt to Promise-based function
const scryptAsync = promisify(scrypt);

// Function to hash password using scrypt (same as in your successful authentication)
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${derivedKey.toString('hex')}.${salt}`;
}

async function createTestUser() {
  try {
    console.log('Creating test user in production database...');
    
    // Define test user credentials
    const testUser = {
      email: 'test@example.com',
      username: 'testuser',
      password: await hashPassword('password123'),
      user_type: 'contractor',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [testUser.username, testUser.email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log(`User ${testUser.username} already exists in production database. Skipping.`);
      return;
    }
    
    // Insert test user
    const result = await pool.query(`
      INSERT INTO users (email, username, password, user_type, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email
    `, [
      testUser.email,
      testUser.username,
      testUser.password,
      testUser.user_type,
      testUser.created_at,
      testUser.updated_at
    ]);
    
    console.log(`\n✅ Successfully created test user in production database:`);
    console.log(`- ID: ${result.rows[0].id}`);
    console.log(`- Username: ${result.rows[0].username}`);
    console.log(`- Email: ${result.rows[0].email}`);
    console.log(`- Password: "password123" (hashed in database)`);
    
    console.log('\n🎯 You can now use these credentials to login to your production app:');
    console.log('Username: testuser');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await pool.end();
  }
}

createTestUser();