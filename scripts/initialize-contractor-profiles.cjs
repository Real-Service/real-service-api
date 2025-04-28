const { Pool } = require('pg');
require('dotenv').config();

// Target DB connection
const targetPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initializeContractorProfiles() {
  console.log('Initializing contractor_profiles table...');
  
  try {
    // Check if table exists
    const { rows: tableExistsResult } = await targetPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contractor_profiles'
      )
    `);
    
    if (tableExistsResult[0].exists) {
      console.log('contractor_profiles table already exists. Dropping it to recreate...');
      await targetPool.query('DROP TABLE IF EXISTS contractor_profiles CASCADE');
    }
    
    // Create the table with all required columns
    console.log('Creating contractor_profiles table with all required columns...');
    await targetPool.query(`
      CREATE TABLE contractor_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        business_name TEXT,
        description TEXT,
        phone_number TEXT,
        website TEXT,
        years_of_experience INTEGER,
        license_number TEXT,
        insurance_provider TEXT,
        insurance_policy_number TEXT,
        has_liability_insurance BOOLEAN DEFAULT FALSE,
        trades TEXT[],
        service_radius NUMERIC,
        wallet_balance NUMERIC DEFAULT 0,
        average_rating NUMERIC,
        total_reviews INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('contractor_profiles table initialized successfully!');
  } catch (error) {
    console.error('Error initializing contractor_profiles table:', error);
  } finally {
    await targetPool.end();
  }
}

initializeContractorProfiles();