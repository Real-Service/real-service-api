import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

// Create a new pool with the connection string
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await bcrypt.hash(password, 10);
  return `${hash}.${salt}`;
}

// Sample user data to import
// Feel free to modify this array with your own user data
const usersToImport = [
  {
    username: 'johnlandlord',
    password: 'password123',
    email: 'john.landlord@example.com',
    fullName: 'John Landlord',
    userType: 'landlord',
    phone: '5551234567'
  },
  {
    username: 'sarahlandlord',
    password: 'password123',
    email: 'sarah.landlord@example.com',
    fullName: 'Sarah Johnson',
    userType: 'landlord',
    phone: '5552345678'
  },
  {
    username: 'mikeplumber',
    password: 'password123',
    email: 'mike.plumber@example.com',
    fullName: 'Mike Wilson',
    userType: 'contractor',
    phone: '5559876543',
    businessName: 'Mike\'s Plumbing Services'
  },
  {
    username: 'electricianbob',
    password: 'password123',
    email: 'bob.electrician@example.com',
    fullName: 'Bob Smith',
    userType: 'contractor',
    phone: '5558765432',
    businessName: 'Smith Electric Co.'
  }
];

async function importUsers() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if service_areas table exists, if not create it
    const checkTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'service_areas'
      )
    `);
    
    if (!checkTableExists.rows[0].exists) {
      console.log('Creating service_areas table...');
      await client.query(`
        CREATE TABLE service_areas (
          id SERIAL PRIMARY KEY,
          contractor_profile_id INTEGER NOT NULL REFERENCES contractor_profiles(id),
          city TEXT NOT NULL,
          state TEXT NOT NULL,
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL,
          radius INTEGER NOT NULL DEFAULT 25,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
      `);
      console.log('service_areas table created successfully');
    }
    
    console.log('Starting user import...');
    
    for (const userData of usersToImport) {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT * FROM users WHERE username = $1 OR email = $2',
        [userData.username, userData.email]
      );
      
      if (existingUser.rows.length > 0) {
        console.log(`User ${userData.username} already exists, skipping...`);
        continue;
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(userData.password);
      
      // Insert the user
      const result = await client.query(
        `INSERT INTO users (username, password, email, full_name, user_type, phone, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id`,
        [
          userData.username,
          hashedPassword,
          userData.email,
          userData.fullName,
          userData.userType,
          userData.phone
        ]
      );
      
      const userId = result.rows[0].id;
      console.log(`Created user ${userData.username} with ID ${userId}`);
      
      // Create profile based on user type
      if (userData.userType === 'landlord') {
        await client.query(
          `INSERT INTO landlord_profiles (user_id, wallet_balance, average_rating, total_ratings)
           VALUES ($1, 0, NULL, 0)`,
          [userId]
        );
        console.log(`Created landlord profile for user ID ${userId}`);
      } else if (userData.userType === 'contractor') {
        // Prepare skills array based on contractor
        let skills = [];
        if (userData.username === 'mikeplumber') {
          skills = ['Plumbing', 'Pipe Repair', 'Water Heater Installation', 'Bathroom Renovation'];
        } else if (userData.username === 'electricianbob') {
          skills = ['Electrical', 'Wiring', 'Lighting', 'Electrical Inspection'];
        }
        
        // Insert contractor profile
        const profileResult = await client.query(
          `INSERT INTO contractor_profiles (
            user_id, wallet_balance, average_rating, total_ratings,
            service_radius, bio, background, business_name, skills
          )
           VALUES ($1, 0, NULL, 0, 25, NULL, NULL, $2, $3)
           RETURNING id`,
          [
            userId, 
            userData.businessName || `${userData.fullName}'s Business`,
            JSON.stringify(skills)
          ]
        );
        
        const profileId = profileResult.rows[0].id;
        console.log(`Created contractor profile for user ID ${userId} with profile ID ${profileId}`);
        
        // Add some service areas for the contractors
        if (userData.username === 'mikeplumber') {
          // Add New York service area
          await client.query(
            `INSERT INTO service_areas (contractor_profile_id, city, state, latitude, longitude, radius)
             VALUES ($1, 'New York', 'NY', 40.7128, -74.0060, 25)`,
            [profileId]
          );
          
          // Add Brooklyn service area
          await client.query(
            `INSERT INTO service_areas (contractor_profile_id, city, state, latitude, longitude, radius)
             VALUES ($1, 'Brooklyn', 'NY', 40.6782, -73.9442, 15)`,
            [profileId]
          );
          
          console.log(`Added service areas for contractor ${userData.username}`);
        } else if (userData.username === 'electricianbob') {
          // Add Boston service area
          await client.query(
            `INSERT INTO service_areas (contractor_profile_id, city, state, latitude, longitude, radius)
             VALUES ($1, 'Boston', 'MA', 42.3601, -71.0589, 20)`,
            [profileId]
          );
          
          // Add Cambridge service area
          await client.query(
            `INSERT INTO service_areas (contractor_profile_id, city, state, latitude, longitude, radius)
             VALUES ($1, 'Cambridge', 'MA', 42.3736, -71.1097, 10)`,
            [profileId]
          );
          
          console.log(`Added service areas for contractor ${userData.username}`);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('User import completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing users:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
importUsers();