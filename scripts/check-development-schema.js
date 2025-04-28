import pg from 'pg';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Development database URL
const DEV_DATABASE_URL = process.env.DATABASE_URL;

// Create pool for development database
const pool = new pg.Pool({
  connectionString: DEV_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkDevelopmentSchema() {
  try {
    console.log('Checking schema in development database...');
    
    // Check for users table structure
    const usersSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nUsers table schema:');
    usersSchema.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });
    
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await pool.end();
  }
}

checkDevelopmentSchema();