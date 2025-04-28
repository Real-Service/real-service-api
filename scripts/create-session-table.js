/**
 * This script creates the session table for connect-pg-simple
 * It should be run before deploying to production
 */

// Load environment variables
import 'dotenv/config';
import pg from 'pg';

// Use the 'pg' package for direct PostgreSQL access
const { Pool } = pg;

// Get database connection string from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL in .env file or environment');
  process.exit(1);
}

console.log('Connecting to database...');

// Create a new connection pool with SSL support
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function createSessionTable() {
  try {
    console.log('🔍 Checking if session table already exists...');
    
    // First check if the session table already exists
    try {
      const existsResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'session'
        );
      `);
      
      if (existsResult.rows[0].exists) {
        console.log('✅ Session table already exists');
        console.log('🔍 Verifying session table structure...');
        
        // Verify the table has the required fields
        const columnsResult = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'session';
        `);
        
        const columns = columnsResult.rows.map(row => row.column_name);
        const requiredColumns = ['sid', 'sess', 'expire'];
        const missingColumns = requiredColumns.filter(col => !columns.includes(col));
        
        if (missingColumns.length === 0) {
          console.log('✅ Session table has all required columns');
          return true;
        } else {
          console.warn(`⚠️ Session table is missing columns: ${missingColumns.join(', ')}`);
          console.log('Dropping existing table to recreate with correct structure...');
          await pool.query('DROP TABLE IF EXISTS session');
        }
      }
    } catch (err) {
      console.log('Session table does not exist, will create it');
    }
    
    // Create the session table with the correct schema
    console.log('🛠 Creating session table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);
    
    console.log('✅ Session table created successfully');
    
    // Create index on expire field
    console.log('🛠 Creating expiry index...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
    
    console.log('✅ Session table index created successfully');
    
    // Verify session table exists
    const testResult = await pool.query('SELECT COUNT(*) FROM session');
    console.log(`✅ Session table verified - current count: ${testResult.rows[0].count}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error creating session table:', error.message);
    return false;
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the script as an immediately invoked async function
(async () => {
  try {
    const success = await createSessionTable();
    if (success) {
      console.log('✅ Session table setup complete!');
      console.log('Your application should now correctly persist sessions in production.');
    } else {
      console.error('❌ Failed to setup session table');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
})();