import pg from 'pg';
const { Pool } = pg;

// Create a connection to the specified production database
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function testJobs() {
  try {
    // Test the connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('Database connection successful. Server time:', connectionTest.rows[0].now);
    
    // Check database schema to find all tables
    console.log('\n=== DATABASE TABLES ===');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\nTables in database:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Check if jobs table exists and its schema
    const jobsTableExists = tablesResult.rows.some(row => row.table_name === 'jobs');
    
    if (jobsTableExists) {
      console.log('\n=== JOBS TABLE SCHEMA ===');
      const jobsColumnsResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'jobs'
        ORDER BY ordinal_position
      `);
      
      console.log('\nColumns in jobs table:');
      jobsColumnsResult.rows.forEach(row => {
        console.log(`- ${row.column_name} (${row.data_type})`);
      });
      
      // Count jobs by status
      const jobsCountResult = await pool.query('SELECT status, COUNT(*) FROM jobs GROUP BY status');
      
      console.log('\n=== JOBS COUNT BY STATUS ===');
      if (jobsCountResult.rowCount > 0) {
        jobsCountResult.rows.forEach(row => {
          console.log(`- ${row.status || 'NULL'}: ${row.count}`);
        });
      } else {
        console.log('No jobs found in the database.');
      }
      
      // Check open jobs
      const openJobsResult = await pool.query('SELECT * FROM jobs WHERE status = $1', ['open']);
      console.log('\nOpen jobs count:', openJobsResult.rowCount);
      
      if (openJobsResult.rowCount > 0) {
        console.log('\nFirst 3 open jobs:');
        openJobsResult.rows.slice(0, 3).forEach((job, index) => {
          console.log(`\nJob ${index + 1}:`);
          console.log(JSON.stringify(job, null, 2));
        });
      }
    } else {
      console.log('\nJOBS TABLE DOES NOT EXIST!');
    }
    
    // Check if bids table exists
    const bidsTableExists = tablesResult.rows.some(row => row.table_name === 'bids');
    
    if (bidsTableExists) {
      console.log('\n=== BIDS TABLE SCHEMA ===');
      const bidsColumnsResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'bids'
        ORDER BY ordinal_position
      `);
      
      console.log('\nColumns in bids table:');
      bidsColumnsResult.rows.forEach(row => {
        console.log(`- ${row.column_name} (${row.data_type})`);
      });
      
      // Query for bids made by contractor 10
      const bidsResult = await pool.query('SELECT * FROM bids WHERE contractor_id = $1', [10]);
      console.log('\nBids from contractor 10:', bidsResult.rowCount);
      
      if (bidsResult.rowCount > 0) {
        console.log('\nBids from contractor 10:');
        bidsResult.rows.forEach((bid, index) => {
          console.log(`\nBid ${index + 1}:`);
          console.log(JSON.stringify(bid, null, 2));
        });
      }
    } else {
      console.log('\nBIDS TABLE DOES NOT EXIST!');
    }
    
  } catch (error) {
    console.error('Error testing jobs:', error);
  } finally {
    await pool.end();
  }
}

testJobs().catch(console.error);