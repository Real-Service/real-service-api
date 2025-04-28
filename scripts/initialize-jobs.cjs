const { Pool } = require('pg');
require('dotenv').config();

// Target DB connection
const targetPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initializeJobs() {
  console.log('Initializing jobs table...');
  
  try {
    // Check if table exists
    const { rows: tableExistsResult } = await targetPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
      )
    `);
    
    if (tableExistsResult[0].exists) {
      console.log('jobs table already exists. Dropping it to recreate...');
      await targetPool.query('DROP TABLE IF EXISTS bids CASCADE');
      await targetPool.query('DROP TABLE IF EXISTS jobs CASCADE');
    }
    
    // Create the table with all required columns
    console.log('Creating jobs table with all required columns...');
    await targetPool.query(`
      CREATE TABLE jobs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        landlord_id INTEGER NOT NULL REFERENCES users(id),
        contractor_id INTEGER REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'open',
        pricing_type TEXT,
        budget NUMERIC,
        location JSONB,
        category_tags TEXT[],
        is_urgent BOOLEAN DEFAULT FALSE,
        deadline TIMESTAMP,
        images TEXT[],
        start_date TIMESTAMP,
        completion_date TIMESTAMP,
        progress INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('Creating bids table with all required columns...');
    await targetPool.query(`
      CREATE TABLE bids (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id),
        contractor_id INTEGER NOT NULL REFERENCES users(id),
        amount NUMERIC NOT NULL,
        proposal TEXT,
        time_estimate TEXT,
        proposed_start_date TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('jobs and bids tables initialized successfully!');
  } catch (error) {
    console.error('Error initializing jobs table:', error);
  } finally {
    await targetPool.end();
  }
}

initializeJobs();