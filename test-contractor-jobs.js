import pg from 'pg';
const { Pool } = pg;

// Create a connection to the specified production database
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function testContractorJobs() {
  try {
    // Test the connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('Database connection successful. Server time:', connectionTest.rows[0].now);
    
    const contractorId = 7; // Contractor 10 has user ID 7
    
    // Get all open jobs
    console.log(`\n=== OPEN JOBS ===`);
    const openJobsResult = await pool.query(`SELECT * FROM jobs WHERE status = 'open'`);
    console.log(`Open jobs count: ${openJobsResult.rowCount}`);
    
    if (openJobsResult.rowCount > 0) {
      console.log('\nFirst 3 open jobs:');
      openJobsResult.rows.slice(0, 3).forEach((job, index) => {
        console.log(`\nJob ${index + 1}:`);
        console.log(JSON.stringify(job, null, 2));
      });
    }
    
    // Get jobs assigned to this contractor
    console.log(`\n=== CONTRACTOR JOBS (for Contractor ID ${contractorId}) ===`);
    const contractorJobsResult = await pool.query(`SELECT * FROM jobs WHERE contractor_id = $1`, [contractorId]);
    console.log(`Jobs assigned to contractor ${contractorId}: ${contractorJobsResult.rowCount}`);
    
    if (contractorJobsResult.rowCount > 0) {
      console.log('\nJobs assigned to this contractor:');
      contractorJobsResult.rows.forEach((job, index) => {
        console.log(`\nJob ${index + 1}:`);
        console.log(JSON.stringify(job, null, 2));
      });
    }
    
    // Get all bids by this contractor
    console.log(`\n=== CONTRACTOR BIDS ===`);
    const bidsResult = await pool.query(`SELECT * FROM bids WHERE contractor_id = $1`, [contractorId]);
    console.log(`Bids by contractor ${contractorId}: ${bidsResult.rowCount}`);
    
    if (bidsResult.rowCount > 0) {
      console.log('\nBids by this contractor:');
      bidsResult.rows.forEach((bid, index) => {
        console.log(`\nBid ${index + 1}:`);
        console.log(JSON.stringify(bid, null, 2));
        
        // Look up job details for this bid
        pool.query(`SELECT title, status FROM jobs WHERE id = $1`, [bid.job_id])
          .then(result => {
            if (result.rows.length > 0) {
              console.log(`Related job: ${result.rows[0].title} (status: ${result.rows[0].status})`);
            }
          });
      });
    }
    
    // Check session table
    console.log(`\n=== SESSION TABLE ===`);
    try {
      const sessionTableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'session'
        ) as exists
      `);
      
      if (sessionTableResult.rows[0].exists) {
        console.log('Session table exists');
        const sessionCount = await pool.query('SELECT COUNT(*) FROM session');
        console.log(`Session count: ${sessionCount.rows[0].count}`);
      } else {
        console.log('Session table does not exist');
      }
    } catch (error) {
      console.log('Error checking session table:', error.message);
    }
    
  } catch (error) {
    console.error('Error testing contractor jobs:', error);
  } finally {
    // Wait a bit before closing the pool to allow the related job queries to complete
    setTimeout(async () => {
      await pool.end();
    }, 1000);
  }
}

testContractorJobs().catch(console.error);