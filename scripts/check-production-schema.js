import pg from 'pg';

// Production database URL
const PROD_DATABASE_URL = 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Create pool for production database
const pool = new pg.Pool({
  connectionString: PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkProductionSchema() {
  try {
    console.log('Checking schema in production database...');
    
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

checkProductionSchema();