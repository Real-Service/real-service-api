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

// Function to hash password using scrypt
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${derivedKey.toString('hex')}.${salt}`;
}

async function createUsers() {
  try {
    console.log('Creating additional users in production database...');
    
    const users = [
      {
        email: 'contractor@example.com',
        username: 'contractor',
        password: await hashPassword('password123'),
        user_type: 'contractor',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'landlord@example.com',
        username: 'landlord',
        password: await hashPassword('password123'),
        user_type: 'landlord',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'expressbd@example.com',
        username: 'contractor10',
        password: await hashPassword('password'),
        user_type: 'contractor',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    let createdCount = 0;
    
    for (const user of users) {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [user.username, user.email]
      );
      
      if (existingUser.rows.length > 0) {
        console.log(`User ${user.username} already exists in production database. Skipping.`);
        continue;
      }
      
      // Insert user
      const result = await pool.query(`
        INSERT INTO users (email, username, password, user_type, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, user_type
      `, [
        user.email,
        user.username,
        user.password,
        user.user_type,
        user.created_at,
        user.updated_at
      ]);
      
      console.log(`\n✅ Created user: ${result.rows[0].username} (${result.rows[0].email}), Type: ${result.rows[0].user_type}`);
      createdCount++;
    }
    
    console.log(`\n✅ Successfully created ${createdCount} additional users in production database.`);
    
    // List all users
    const allUsers = await pool.query('SELECT id, username, email, user_type FROM users ORDER BY id');
    
    console.log('\n🎯 Users in production database:');
    allUsers.rows.forEach(user => {
      console.log(`- ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Type: ${user.user_type}, Password: "password123" (or "password" for contractor10)`);
    });
    
  } catch (error) {
    console.error('Error creating users:', error);
  } finally {
    await pool.end();
  }
}

createUsers();