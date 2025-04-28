import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function fixColumnNames() {
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
    
    // Check users table for column naming issues
    console.log("Checking users table columns...");
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND table_schema = 'public'
    `);
    
    const userColumns = columnsCheck.rows.map(row => row.column_name);
    console.log("Current user columns:", userColumns);
    
    // Check if fullName column exists (camelCase) - if not, create it
    if (!userColumns.includes('fullName') && userColumns.includes('full_name')) {
      console.log("Renaming full_name to fullName...");
      await pool.query(`ALTER TABLE users RENAME COLUMN "full_name" TO "fullName"`);
    } else if (!userColumns.includes('fullName') && !userColumns.includes('full_name')) {
      console.log("Adding fullName column...");
      await pool.query(`ALTER TABLE users ADD COLUMN "fullName" varchar(255)`);
    }
    
    // Check if userType column exists (camelCase) - if not, create it
    if (!userColumns.includes('userType') && userColumns.includes('user_type')) {
      console.log("Renaming user_type to userType...");
      await pool.query(`ALTER TABLE users RENAME COLUMN "user_type" TO "userType"`);
    } else if (!userColumns.includes('userType') && !userColumns.includes('user_type')) {
      console.log("Adding userType column...");
      await pool.query(`ALTER TABLE users ADD COLUMN "userType" varchar(50) NOT NULL DEFAULT 'user'`);
    }
    
    // Check if profilePicture column exists (camelCase) - if not, create it
    if (!userColumns.includes('profilePicture') && userColumns.includes('profile_picture')) {
      console.log("Renaming profile_picture to profilePicture...");
      await pool.query(`ALTER TABLE users RENAME COLUMN "profile_picture" TO "profilePicture"`);
    } else if (!userColumns.includes('profilePicture') && !userColumns.includes('profile_picture')) {
      console.log("Adding profilePicture column...");
      await pool.query(`ALTER TABLE users ADD COLUMN "profilePicture" text`);
    }
    
    // Check if createdAt column exists (camelCase) - if not, create it
    if (!userColumns.includes('createdAt') && userColumns.includes('created_at')) {
      console.log("Renaming created_at to createdAt...");
      await pool.query(`ALTER TABLE users RENAME COLUMN "created_at" TO "createdAt"`);
    } else if (!userColumns.includes('createdAt') && !userColumns.includes('created_at')) {
      console.log("Adding createdAt column...");
      await pool.query(`ALTER TABLE users ADD COLUMN "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP`);
    }
    
    // Check if updatedAt column exists (camelCase) - if not, create it
    if (!userColumns.includes('updatedAt') && userColumns.includes('updated_at')) {
      console.log("Renaming updated_at to updatedAt...");
      await pool.query(`ALTER TABLE users RENAME COLUMN "updated_at" TO "updatedAt"`);
    } else if (!userColumns.includes('updatedAt') && !userColumns.includes('updated_at')) {
      console.log("Adding updatedAt column...");
      await pool.query(`ALTER TABLE users ADD COLUMN "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP`);
    }
    
    // Now fix other tables that might have JSON column issues
    
    // Fix contractor_profiles JSON columns
    console.log("Fixing contractor_profiles JSON columns...");
    try {
      await pool.query(`
        ALTER TABLE contractor_profiles 
        ALTER COLUMN "serviceArea" TYPE jsonb USING '{}' :: jsonb,
        ALTER COLUMN "skills" TYPE jsonb USING '[]' :: jsonb,
        ALTER COLUMN "availability" TYPE jsonb USING '{}' :: jsonb,
        ALTER COLUMN "serviceAreas" TYPE jsonb USING '[]' :: jsonb,
        ALTER COLUMN "serviceZipCodes" TYPE jsonb USING '[]' :: jsonb,
        ALTER COLUMN "trades" TYPE jsonb USING '[]' :: jsonb,
        ALTER COLUMN "paymentMethods" TYPE jsonb USING '[]' :: jsonb,
        ALTER COLUMN "languages" TYPE jsonb USING '[]' :: jsonb,
        ALTER COLUMN "portfolio" TYPE jsonb USING '[]' :: jsonb
      `);
    } catch (error) {
      console.log("Error fixing contractor_profiles columns:", error.message);
    }
    
    // Fix jobs JSON columns
    console.log("Fixing jobs JSON columns...");
    try {
      await pool.query(`
        ALTER TABLE jobs 
        ALTER COLUMN "location" TYPE jsonb USING '{}' :: jsonb,
        ALTER COLUMN "images" TYPE jsonb USING '[]' :: jsonb,
        ALTER COLUMN "categoryTags" TYPE jsonb USING '[]' :: jsonb
      `);
    } catch (error) {
      console.log("Error fixing jobs columns:", error.message);
    }
    
    console.log("All column fixes applied!");
  } catch (error) {
    console.error("Error fixing columns:", error);
  } finally {
    await pool.end();
  }
}

fixColumnNames().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});