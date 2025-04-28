import pg from 'pg';
const { Pool } = pg;

// Create a connection to the specified production database
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkEnums() {
  try {
    // Test the connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('Database connection successful. Server time:', connectionTest.rows[0].now);
    
    // Check the job_status enum values
    console.log('\nChecking job_status enum values:');
    const jobStatusResult = await pool.query(`
      SELECT enum_range(NULL::job_status) AS enum_values
    `);
    console.log('job_status values:', jobStatusResult.rows[0].enum_values);
    
    // Check the job_pricing_type enum values
    console.log('\nChecking job_pricing_type enum values:');
    const jobPricingTypeResult = await pool.query(`
      SELECT enum_range(NULL::job_pricing_type) AS enum_values
    `);
    console.log('job_pricing_type values:', jobPricingTypeResult.rows[0].enum_values);
    
    // Check the bid_status enum values
    console.log('\nChecking bid_status enum values:');
    const bidStatusResult = await pool.query(`
      SELECT enum_range(NULL::bid_status) AS enum_values
    `);
    console.log('bid_status values:', bidStatusResult.rows[0].enum_values);
    
  } catch (error) {
    console.error('Error checking enums:', error);
  } finally {
    await pool.end();
  }
}

checkEnums().catch(console.error);