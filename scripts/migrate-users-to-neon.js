import pg from 'pg';
import dotenv from 'dotenv';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

dotenv.config();

// Set up crypto helpers for password hashing
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

// Create a test user if needed
async function insertTestUser(pool) {
  console.log("Checking if test user exists...");
  
  try {
    // Check if user exists
    const userCheck = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      ["test@example.com"]
    );
    
    if (userCheck.rows.length === 0) {
      console.log("Creating test user...");
      const hashedPassword = await hashPassword("password123");
      
      await pool.query(`
        INSERT INTO users (
          username, email, password, "fullName", "userType", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        "testuser", 
        "test@example.com", 
        hashedPassword, 
        "Test User", 
        "contractor", 
        new Date(), 
        new Date()
      ]);
      
      console.log("Test user created successfully!");
    } else {
      console.log("Test user already exists!");
    }
  } catch (error) {
    console.error("Error with test user:", error.message);
  }
}

// Create session table
async function createSessionTable(pool) {
  try {
    console.log("Creating session table if it doesn't exist...");
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      )
    `);
    
    console.log("Session table is ready!");
  } catch (error) {
    console.error("Error creating session table:", error.message);
  }
}

async function migrateUsers() {
  console.log("Connecting to Neon database...");
  
  // Create TCP/SSL pg.Pool for guaranteed direct connection
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Test the connection
    const dbTest = await pool.query('SELECT NOW() as now');
    console.log(`Connected to database at: ${dbTest.rows[0].now}`);
    
    // Create session table
    await createSessionTable(pool);
    
    // Insert test user
    await insertTestUser(pool);
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await pool.end();
  }
}

migrateUsers().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});