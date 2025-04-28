const { Pool } = require('pg');
require('dotenv').config();

// Target DB connection
const targetPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testMigration() {
  console.log('Testing migration results...');
  
  try {
    // Check users
    const { rows: users } = await targetPool.query('SELECT COUNT(*) FROM users');
    console.log(`Users count: ${users[0].count}`);
    
    // Check contractor profiles
    const { rows: contractors } = await targetPool.query('SELECT COUNT(*) FROM contractor_profiles');
    console.log(`Contractor profiles count: ${contractors[0].count}`);
    
    // Check jobs
    const { rows: jobs } = await targetPool.query('SELECT COUNT(*) FROM jobs');
    console.log(`Jobs count: ${jobs[0].count}`);
    
    // Check bids
    const { rows: bids } = await targetPool.query('SELECT COUNT(*) FROM bids');
    console.log(`Bids count: ${bids[0].count}`);
    
    // Check other tables
    const additionalTables = [
      'chat_rooms',
      'chat_participants',
      'messages',
      'reviews',
      'transactions',
      'landlord_profiles',
      'quotes',
      'quote_line_items',
      'invoices',
      'invoice_line_items',
      'waitlist_entries'
    ];
    
    for (const tableName of additionalTables) {
      try {
        const { rows: exists } = await targetPool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
          )
        `);
        
        if (exists[0].exists) {
          const { rows: count } = await targetPool.query(`SELECT COUNT(*) FROM ${tableName}`);
          console.log(`${tableName} count: ${count[0].count}`);
        } else {
          console.log(`${tableName} table doesn't exist in target database`);
        }
      } catch (error) {
        console.log(`Error checking table ${tableName}: ${error.message}`);
      }
    }
    
    // Test a sample user
    const { rows: sampleUser } = await targetPool.query('SELECT username, email, type FROM users LIMIT 1');
    if (sampleUser.length > 0) {
      console.log('Sample user:');
      console.log(sampleUser[0]);
    }
    
    // Test a sample job
    const { rows: sampleJob } = await targetPool.query('SELECT id, title, status FROM jobs LIMIT 1');
    if (sampleJob.length > 0) {
      console.log('Sample job:');
      console.log(sampleJob[0]);
      
      // Test if bids for this job exist
      const { rows: jobBids } = await targetPool.query('SELECT id, status, amount FROM bids WHERE job_id = $1', [sampleJob[0].id]);
      console.log(`Bids for job ${sampleJob[0].id}: ${jobBids.length}`);
      if (jobBids.length > 0) {
        console.log('Sample bid:');
        console.log(jobBids[0]);
      }
    }
    
    console.log('Migration test completed successfully!');
  } catch (error) {
    console.error('Error testing migration:', error);
  } finally {
    await targetPool.end();
  }
}

testMigration();