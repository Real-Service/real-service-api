import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { promisify } from 'util';
import bcrypt from 'bcrypt';

// Initialize dotenv
dotenv.config();

// Setup crypto for scrypt password hashing
const scryptAsync = promisify(crypto.scrypt);

// Create a connection to the database
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

// Function to create a test user
async function createTestUser(email, username, fullName, password, userType, phone = null) {
  console.log(`Creating user: ${username} (${email})`);
  
  // Check if user already exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );
  
  if (existingUser.rows.length > 0) {
    console.log(`User ${username} already exists with ID ${existingUser.rows[0].id}. Skipping.`);
    return existingUser.rows[0].id;
  }
  
  // Hash the password using scrypt
  const hashedPassword = await hashPassword(password);
  
  // Insert the user
  const result = await pool.query(
    'INSERT INTO users (username, email, password, "userType", "fullName", phone, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id',
    [username, email, hashedPassword, userType, fullName, phone]
  );
  
  console.log(`Created user ${username} with ID ${result.rows[0].id}`);
  return result.rows[0].id;
}

// Function to create a contractor profile
async function createContractorProfile(userId, businessName, bio, skills = []) {
  console.log(`Creating contractor profile for user ID ${userId}`);
  
  // Check if profile already exists
  const existingProfile = await pool.query(
    'SELECT id FROM contractor_profiles WHERE "userId" = $1',
    [userId]
  );
  
  if (existingProfile.rows.length > 0) {
    console.log(`Contractor profile already exists for user ${userId}. Skipping.`);
    return;
  }
  
  // Insert the contractor profile
  await pool.query(
    'INSERT INTO contractor_profiles ("userId", "businessName", bio, skills, "serviceRadius", "walletBalance", "totalRatings") VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [userId, businessName, bio, JSON.stringify(skills), 25, 0, 0]
  );
  
  console.log(`Created contractor profile for user ID ${userId}`);
}

// Function to create a landlord profile
async function createLandlordProfile(userId, propertyCount = 1) {
  console.log(`Creating landlord profile for user ID ${userId}`);
  
  // Check if profile already exists
  const existingProfile = await pool.query(
    'SELECT id FROM landlord_profiles WHERE "userId" = $1',
    [userId]
  );
  
  if (existingProfile.rows.length > 0) {
    console.log(`Landlord profile already exists for user ${userId}. Skipping.`);
    return;
  }
  
  // Create properties JSON object
  const properties = {
    count: propertyCount,
    locations: [
      { address: "123 Main St", city: "Halifax", state: "NS", zipCode: "B3H 1A1" }
    ]
  };
  
  // Insert the landlord profile
  await pool.query(
    'INSERT INTO landlord_profiles ("userId", "properties", "bio", "walletBalance", "averageRating", "totalRatings") VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, JSON.stringify(properties), "Property owner with multiple rental units", 0, null, 0]
  );
  
  console.log(`Created landlord profile for user ID ${userId}`);
}

// Main migration function
async function migrateUsers() {
  try {
    console.log('Starting user migration to Neon database...');
    
    // Create test landlords
    const landlord1Id = await createTestUser('landlord1@example.com', 'landlord1', 'John Landlord', 'password123', 'landlord', '5551234567');
    const landlord2Id = await createTestUser('landlord2@example.com', 'landlord2', 'Jane Landlord', 'password123', 'landlord', '5559876543');
    const testLandlordId = await createTestUser('landlord@example.com', 'testlandlord', 'Test Landlord', 'password123', 'landlord');
    
    // Create landlord profiles
    await createLandlordProfile(landlord1Id, 3);
    await createLandlordProfile(landlord2Id, 2);
    await createLandlordProfile(testLandlordId, 1);
    
    // Create test contractors
    const contractor1Id = await createTestUser('contractor1@example.com', 'contractor1', 'Bob Builder', 'password123', 'contractor', '5551112222');
    const contractor2Id = await createTestUser('contractor2@example.com', 'contractor2', 'Mike Mechanic', 'password123', 'contractor', '5552223333');
    const contractor3Id = await createTestUser('contractor3@example.com', 'contractor3', 'Ellie Electrician', 'password123', 'contractor', '5553334444');
    const contractor7Id = await createTestUser('contractor7@expressbd.ca', 'contractor7', 'David Plumber', 'password123', 'contractor', '5556667777');
    const contractor10Id = await createTestUser('info@expressbd.ca', 'contractor 10', 'Simeon Johnson', 'password', 'contractor', '9029971913');
    
    // Create contractor profiles with skills
    await createContractorProfile(contractor1Id, 'Bob\'s Building', 'Experienced general contractor specializing in residential construction.', ['Carpentry', 'Roofing', 'General Contracting']);
    await createContractorProfile(contractor2Id, 'Mike\'s Mechanical', 'Expert in HVAC and plumbing systems.', ['HVAC', 'Plumbing', 'Mechanical']);
    await createContractorProfile(contractor3Id, 'Ellie\'s Electric', 'Licensed electrician for residential and commercial projects.', ['Electrical', 'Lighting', 'Wiring']);
    await createContractorProfile(contractor7Id, 'David\'s Plumbing', 'Professional plumbing services for all your needs.', ['Plumbing', 'Bathrooms', 'Kitchens']);
    await createContractorProfile(contractor10Id, 'Express Building Developments', 'Express Building Developments is a trusted leader in residential and commercial construction, known for delivering high-quality projects on time and within budget. With a commitment to craftsmanship, innovation, and client satisfaction, we specialize in new builds, renovations, and property development across Nova Scotia. Backed by years of industry experience, our team brings precision, reliability, and a passion for excellence to every project.', ['Carpentry', 'Drywall', 'Flooring', 'Painting']);
    
    // Create additional test users
    const testUser1Id = await createTestUser('testuser586577@example.com', 'testuser586577', 'Test User', 'password123', 'contractor', '1234567890');
    const testUser2Id = await createTestUser('testuser605623@example.com', 'testuser605623', 'Test User', 'password123', 'contractor', '1234567890');
    const testUser3Id = await createTestUser('testuser818072@example.com', 'testuser818072', 'Test User', 'password123', 'contractor', '1234567890');
    const testUser4Id = await createTestUser('test@example.com', 'testuser', 'Test User', 'password123', 'contractor');
    const testUser5Id = await createTestUser('testuser903684@example.com', 'testuser903684', 'Test User', 'password123', 'contractor', '1234567890');
    
    // Create profiles for additional test users
    await createContractorProfile(testUser1Id, 'Test Business 1', 'Test contractor business');
    await createContractorProfile(testUser2Id, 'Test Business 2', 'Test contractor business');
    await createContractorProfile(testUser3Id, 'Test Business 3', 'Test contractor business');
    await createContractorProfile(testUser4Id, 'Test Business 4', 'Test contractor business');
    await createContractorProfile(testUser5Id, 'Test Business 5', 'Test contractor business');
    
    console.log('✅ User migration completed successfully!');
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

// Execute the migration
migrateUsers();