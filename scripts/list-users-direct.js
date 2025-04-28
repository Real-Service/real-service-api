import pg from 'pg';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Create a connection to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function listUsers() {
  try {
    console.log('Listing all users in the Neon database...');
    console.log('Connection string (redacted):', 
      process.env.DATABASE_URL.replace(/(postgres:\/\/[^:]+):([^@]+)@(.+)/, 'postgres://$1:****@$3'));
    
    // Query all users
    const result = await pool.query(`
      SELECT id, username, email, "userType", "fullName", 
             LENGTH(password) as password_length, 
             SUBSTRING(password, 1, 10) as password_start,
             SUBSTRING(password FROM 1 FOR 5) as password_prefix,
             "createdAt", "updatedAt"
      FROM users
      ORDER BY id
    `);
    
    console.log(`\nFound ${result.rows.length} users in the database:`);
    
    // Display user details
    result.rows.forEach(user => {
      console.log(`\nID: ${user.id}`);
      console.log(`Username: ${user.username}`);
      console.log(`Email: ${user.email}`);
      console.log(`Type: ${user.userType}`);
      console.log(`Full Name: ${user.fullName || '<not set>'}`);
      console.log(`Password Length: ${user.password_length}`);
      console.log(`Password Starts With: ${user.password_start}...`);
      console.log(`Password Format: ${user.password_prefix === '$2b$1' ? 'bcrypt' : 'scrypt'}`);
      console.log(`Created: ${user.createdAt}`);
      console.log(`Updated: ${user.updatedAt}`);
    });
    
    // Get landlord profiles count
    const landlordCount = await pool.query(`
      SELECT COUNT(*) FROM landlord_profiles
    `);
    
    // Get contractor profiles count
    const contractorCount = await pool.query(`
      SELECT COUNT(*) FROM contractor_profiles
    `);
    
    console.log(`\nProfile counts:`);
    console.log(`- Landlord profiles: ${landlordCount.rows[0].count}`);
    console.log(`- Contractor profiles: ${contractorCount.rows[0].count}`);
    
    // Get contractor profile for user 7
    const contractorProfile = await pool.query(`
      SELECT * FROM contractor_profiles WHERE "userId" = 7
    `);
    
    if (contractorProfile.rows.length > 0) {
      console.log(`\nContractor profile for user 7 (contractor 10):`);
      console.log(JSON.stringify(contractorProfile.rows[0], null, 2));
    } else {
      console.log(`\nNo contractor profile found for user 7 (contractor 10)`);
    }
    
  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    await pool.end();
    console.log('\nDatabase connection closed.');
  }
}

// Run the function
listUsers();