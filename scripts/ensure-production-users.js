/**
 * Ensure production users in Neon database
 * 
 * This script ensures that user data is available in the Neon database
 * for use with the production version of the app. It:
 * 1. Checks for existing users
 * 2. Creates test users if none exist
 * 3. Verifies database connection and accessibility
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

// Load environment variables
dotenv.config();

// Set up crypto helpers for password hashing
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function ensureProductionUsers() {
  // Create a database connection using standard pg Pool for production compatibility
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to Neon database via regular PostgreSQL connection...');
    
    // Test connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('Database connection successful. Server time:', connectionTest.rows[0].now);
    
    // Check for existing users
    const existingUsersResult = await pool.query('SELECT * FROM users LIMIT 10');
    const existingUsers = existingUsersResult.rows;
    
    console.log(`Found ${existingUsers.length} existing users in database`);
    
    if (existingUsers.length === 0) {
      console.log('No users found. Creating test users...');
      
      // Create landlord test user
      const landlordPassword = await hashPassword('password123');
      const landlordUserResult = await pool.query(
        `INSERT INTO users (username, password, email, "fullName", "userType", phone, "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        ['testlandlord', landlordPassword, 'landlord@example.com', 'Test Landlord', 'landlord', '555-123-4567', new Date(), new Date()]
      );
      
      const landlordUser = landlordUserResult.rows[0];
      console.log(`Created landlord user: ${landlordUser.username} (${landlordUser.email})`);
      
      // Create landlord profile
      await pool.query(
        `INSERT INTO landlord_profiles ("userId", bio, "walletBalance", "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5)`,
        [landlordUser.id, 'Test landlord profile', 1000, new Date(), new Date()]
      );
      
      console.log(`Created landlord profile for user ${landlordUser.id}`);
      
      // Create contractor test user
      const contractorPassword = await hashPassword('password123');
      const contractorUserResult = await pool.query(
        `INSERT INTO users (username, password, email, "fullName", "userType", phone, "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        ['testcontractor', contractorPassword, 'contractor@example.com', 'Test Contractor', 'contractor', '555-987-6543', new Date(), new Date()]
      );
      
      const contractorUser = contractorUserResult.rows[0];
      console.log(`Created contractor user: ${contractorUser.username} (${contractorUser.email})`);
      
      // Create contractor profile with proper JSON stringification
      const serviceArea = JSON.stringify({
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        coordinates: { lat: 40.7128, lng: -74.0060 }
      });
      
      const trades = JSON.stringify(['plumbing', 'electrical', 'general']);
      
      const availability = JSON.stringify({
        monday: { available: true, startTime: '09:00', endTime: '17:00' },
        tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
        wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
        thursday: { available: true, startTime: '09:00', endTime: '17:00' },
        friday: { available: true, startTime: '09:00', endTime: '17:00' }
      });
      
      await pool.query(
        `INSERT INTO contractor_profiles (
          "userId", bio, "businessName", website, "yearsInBusiness", 
          "employeeCount", "serviceRadius", "serviceArea", trades, 
          availability, "walletBalance", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          contractorUser.id, 'Test contractor profile', 'Test Contractor Services',
          'https://testcontractor.example.com', 5, 10, 25, 
          serviceArea, trades, availability, 
          1000, new Date(), new Date()
        ]
      );
      
      console.log(`Created contractor profile for user ${contractorUser.id}`);
      
      console.log('\nTest users created successfully:');
      console.log('Landlord: landlord@example.com / password123');
      console.log('Contractor: contractor@example.com / password123');
    } else {
      console.log('Users already exist in database. Displaying available test users:');
      
      // Output some existing users for testing
      for (let i = 0; i < Math.min(existingUsers.length, 3); i++) {
        const user = existingUsers[i];
        console.log(`\nUser ${i+1}:`);
        console.log(`Email: ${user.email}`);
        console.log(`Username: ${user.username}`);
        console.log(`User Type: ${user.userType}`);
        console.log('Note: Use the actual password for this user to log in');
      }
    }
    
    // Verify the session table exists
    try {
      await pool.query('SELECT 1 FROM session LIMIT 1');
      console.log('✅ Session table exists and is accessible');
    } catch (error) {
      console.log('⚠️ Session table not found. Creating session table...');
      
      try {
        // Create the session table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS "session" (
            "sid" varchar NOT NULL COLLATE "default",
            "sess" json NOT NULL,
            "expire" timestamp(6) NOT NULL,
            CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
          )
        `);
        console.log('✅ Session table created successfully');
      } catch (createError) {
        console.error('❌ Failed to create session table:', createError);
      }
    }
    
    console.log('\nUser migration and verification completed successfully!');
    
  } catch (error) {
    console.error('Error in user migration process:', error);
  } finally {
    // Close the database connection
    await pool.end();
    process.exit(0);
  }
}

// Run the migration and creation process
ensureProductionUsers();