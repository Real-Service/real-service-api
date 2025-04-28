import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

// Create a new pool with the connection string
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function importBids() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting bid import...');
    
    // Get contractor IDs
    const contractorResult = await client.query(`
      SELECT u.id
      FROM users u
      JOIN contractor_profiles cp ON u.id = cp.user_id
      WHERE u.user_type = 'contractor'
    `);
    
    if (contractorResult.rows.length === 0) {
      console.log('No contractors found in the database. Cannot import bids.');
      return;
    }
    
    const contractorIds = contractorResult.rows.map(row => row.id);
    console.log(`Found ${contractorIds.length} contractors: ${contractorIds.join(', ')}`);
    
    // Get job IDs
    const jobResult = await client.query(`
      SELECT id
      FROM jobs
      WHERE status = 'open'
    `);
    
    if (jobResult.rows.length === 0) {
      console.log('No open jobs found in the database. Cannot import bids.');
      return;
    }
    
    const jobIds = jobResult.rows.map(row => row.id);
    console.log(`Found ${jobIds.length} open jobs: ${jobIds.join(', ')}`);
    
    // Sample bid data
    const bidsToCreate = [
      {
        contractorId: 13, // mikeplumber
        jobId: 8, // Fix leaking bathroom faucet
        amount: 125,
        timeEstimate: "2 hours",
        proposal: "I can fix this quickly with minimal disruption. I'm experienced with all types of faucet repairs and replacements.",
        proposedStartDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
        status: 'pending'
      },
      {
        contractorId: 14, // electricianbob
        jobId: 9, // Install ceiling fan in bedroom
        amount: 160,
        timeEstimate: "1.5 hours",
        proposal: "I'm a licensed electrician with extensive experience installing ceiling fans. I can ensure it's properly balanced and wired safely.",
        proposedStartDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
        status: 'pending'
      },
      {
        contractorId: 13, // mikeplumber
        jobId: 10, // Fix broken kitchen cabinet hinges
        amount: 145,
        timeEstimate: "3 hours",
        proposal: "I can replace the hinges and realign all cabinet doors. I'll bring a variety of hinges to match your existing ones.",
        proposedStartDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        status: 'pending'
      },
      {
        contractorId: 14, // electricianbob
        jobId: 11, // Rewire living room outlets
        amount: 265,
        timeEstimate: "4 hours",
        proposal: "I'll inspect the entire circuit, rewire the outlets, and ensure everything meets current electrical code requirements.",
        proposedStartDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        status: 'pending'
      }
    ];
    
    // Import each bid
    for (const bid of bidsToCreate) {
      // Check if bid already exists
      const existingBidResult = await client.query(
        'SELECT id FROM bids WHERE contractor_id = $1 AND job_id = $2',
        [bid.contractorId, bid.jobId]
      );
      
      if (existingBidResult.rows.length > 0) {
        console.log(`Bid already exists for contractor ${bid.contractorId} on job ${bid.jobId}, skipping...`);
        continue;
      }
      
      // Insert bid
      const result = await client.query(
        `INSERT INTO bids (
          contractor_id, job_id, amount, time_estimate, proposal, proposed_start_date, status,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id`,
        [
          bid.contractorId,
          bid.jobId,
          bid.amount,
          bid.timeEstimate,
          bid.proposal,
          bid.proposedStartDate,
          bid.status
        ]
      );
      
      const bidId = result.rows[0].id;
      console.log(`Created bid for job ${bid.jobId} by contractor ${bid.contractorId} with ID ${bidId}`);
    }
    
    await client.query('COMMIT');
    console.log('Bid import completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing bids:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
importBids();