import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkNeonData() {
  try {
    console.log("Connecting to Neon database...");
    
    // Create TCP/SSL pg.Pool for guaranteed direct connection
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Test the connection
    const dbTest = await pool.query('SELECT NOW() as now');
    console.log(`Connected to database at: ${dbTest.rows[0].now}`);
    
    // Check users table
    console.log("\n=== USERS TABLE DATA ===");
    const usersResult = await pool.query('SELECT id, username, email, "fullName", "userType", phone FROM users');
    console.log(`Found ${usersResult.rows.length} users`);
    usersResult.rows.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, FullName: ${user.fullName}, UserType: ${user.userType}`);
    });
    
    // Check column names first for tables
    console.log("\n=== CHECKING COLUMN NAMES ===");
    const columnCheck = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND 
            table_name IN ('jobs', 'bids', 'contractor_profiles')
      ORDER BY table_name, column_name
    `);
    
    console.log("Column names found:");
    columnCheck.rows.forEach(column => {
      console.log(`Table: ${column.table_name}, Column: ${column.column_name}`);
    });
    
    // Check jobs table using correct column names
    console.log("\n=== JOBS TABLE DATA ===");
    const jobsResult = await pool.query('SELECT id, title, description, landlord_id, status FROM jobs');
    console.log(`Found ${jobsResult.rows.length} jobs`);
    jobsResult.rows.forEach(job => {
      console.log(`ID: ${job.id}, Title: ${job.title}, Status: ${job.status}, LandlordId: ${job.landlord_id}`);
    });
    
    // Check bids table using correct column names
    console.log("\n=== BIDS TABLE DATA ===");
    const bidsResult = await pool.query('SELECT id, job_id, contractor_id, amount, status FROM bids');
    console.log(`Found ${bidsResult.rows.length} bids`);
    bidsResult.rows.forEach(bid => {
      console.log(`ID: ${bid.id}, JobId: ${bid.job_id}, ContractorId: ${bid.contractor_id}, Amount: ${bid.amount}, Status: ${bid.status}`);
    });
    
    // Check contractor_profiles table using correct column names
    console.log("\n=== CONTRACTOR PROFILES TABLE DATA ===");
    const contractorProfilesResult = await pool.query('SELECT id, user_id, business_name, city, state FROM contractor_profiles');
    console.log(`Found ${contractorProfilesResult.rows.length} contractor profiles`);
    contractorProfilesResult.rows.forEach(profile => {
      console.log(`ID: ${profile.id}, UserId: ${profile.user_id}, BusinessName: ${profile.business_name}, City: ${profile.city}, State: ${profile.state}`);
    });
    
    // Check current database structure
    console.log("\n=== DATABASE STRUCTURE ===");
    const tableResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`Found ${tableResult.rows.length} tables`);
    tableResult.rows.forEach(table => {
      console.log(`Table: ${table.table_name}`);
    });
    
    pool.end();
  } catch (error) {
    console.error("Error checking Neon data:", error);
    process.exit(1);
  }
}

checkNeonData().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});