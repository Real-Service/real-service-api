/**
 * Script to check jobs and bids in the Neon production database
 * This script directly queries the database to check for jobs and bids
 */

import pg from 'pg';
const { Pool } = pg;

// Use the production database URL - the same one used in your application
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

async function checkJobsAndBids() {
  try {
    console.log('Connecting to Neon production database...');
    
    // Check if jobs table exists
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Database tables:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Check job count
    const jobsResult = await pool.query('SELECT COUNT(*) FROM jobs');
    console.log(`\nTotal jobs in database: ${jobsResult.rows[0].count}`);
    
    // Get a sample of jobs
    const jobsSample = await pool.query('SELECT * FROM jobs LIMIT 3');
    console.log('\nSample jobs:');
    jobsSample.rows.forEach(job => {
      console.log(`- Job #${job.id}: ${job.title} (Status: ${job.status})`);
      console.log(`  Created by landlord: ${job.landlord_id}`);
      console.log(`  Budget: ${job.budget}`);
      console.log('  -----------------------');
    });
    
    // Check bid count
    const bidsResult = await pool.query('SELECT COUNT(*) FROM bids');
    console.log(`\nTotal bids in database: ${bidsResult.rows[0].count}`);
    
    // Get a sample of bids
    const bidsSample = await pool.query('SELECT * FROM bids LIMIT 3');
    console.log('\nSample bids:');
    bidsSample.rows.forEach(bid => {
      console.log(`- Bid #${bid.id}: For job #${bid.job_id}`);
      console.log(`  By contractor: ${bid.contractor_id}`);
      console.log(`  Amount: ${bid.amount}`);
      console.log(`  Status: ${bid.status}`);
      console.log('  -----------------------');
    });
    
    // Check specifically for contractor 10 (user ID 7)
    const contractor10Bids = await pool.query('SELECT * FROM bids WHERE contractor_id = 7');
    console.log(`\nBids for contractor ID 7 (contractor 10): ${contractor10Bids.rowCount}`);
    contractor10Bids.rows.forEach(bid => {
      console.log(`- Bid #${bid.id}: For job #${bid.job_id}`);
      console.log(`  Amount: ${bid.amount}`);
      console.log(`  Status: ${bid.status}`);
      console.log('  -----------------------');
    });
    
    // Check open jobs
    const openJobs = await pool.query('SELECT * FROM jobs WHERE status = \'open\'');
    console.log(`\nOpen jobs available: ${openJobs.rowCount}`);
    openJobs.rows.forEach(job => {
      console.log(`- Job #${job.id}: ${job.title}`);
      console.log(`  Budget: ${job.budget}`);
      console.log('  -----------------------');
    });
    
    // Check the field mapping for jobs table
    if (jobsSample.rows.length > 0) {
      console.log('\nJob field mapping (actual database column names):');
      const sampleJob = jobsSample.rows[0];
      Object.keys(sampleJob).forEach(key => {
        console.log(`- ${key}: ${typeof sampleJob[key]}`);
      });
    }
    
    // Check the field mapping for bids table
    if (bidsSample.rows.length > 0) {
      console.log('\nBid field mapping (actual database column names):');
      const sampleBid = bidsSample.rows[0];
      Object.keys(sampleBid).forEach(key => {
        console.log(`- ${key}: ${typeof sampleBid[key]}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking jobs and bids:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkJobsAndBids().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});