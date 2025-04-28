import pg from 'pg';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Create a connection to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Function to create a job
async function createJob(title, description, budget, categoryTags, status, landlordId, location) {
  console.log(`Creating job: ${title}`);
  
  const result = await pool.query(
    `INSERT INTO jobs (
      title, description, budget, "categoryTags", status, "landlordId", location,
      "createdAt", "updatedAt", "startDate", "endDate"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW() + interval '1 day', NOW() + interval '7 days') 
    RETURNING id`,
    [title, description, budget, categoryTags, status, landlordId, location]
  );
  
  console.log(`Created job ${title} with ID ${result.rows[0].id}`);
  return result.rows[0].id;
}

// Function to create a bid
async function createBid(jobId, contractorId, amount, proposal, timeEstimate, status = 'pending') {
  console.log(`Creating bid for job ${jobId} by contractor ${contractorId}`);
  
  const result = await pool.query(
    `INSERT INTO bids (
      "jobId", "contractorId", amount, proposal, "timeEstimate", status, 
      "proposedStartDate", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW() + interval '2 days', NOW(), NOW()) 
    RETURNING id`,
    [jobId, contractorId, amount, proposal, timeEstimate, status]
  );
  
  console.log(`Created bid for job ${jobId} with ID ${result.rows[0].id}`);
  return result.rows[0].id;
}

// Main function to create jobs and bids
async function createJobsAndBids() {
  try {
    console.log('Starting job and bid creation...');
    
    // Get user IDs
    const usersResult = await pool.query(
      'SELECT id, username, "userType" FROM users ORDER BY id'
    );
    
    const landlords = usersResult.rows.filter(user => user.userType === 'landlord');
    const contractors = usersResult.rows.filter(user => user.userType === 'contractor');
    
    if (landlords.length === 0 || contractors.length === 0) {
      console.error('No landlords or contractors found. Run migrate-users.js first.');
      return;
    }
    
    console.log(`Found ${landlords.length} landlords and ${contractors.length} contractors`);
    
    // Create jobs
    const job1Id = await createJob(
      'Kitchen Faucet Replacement',
      'Need a plumber to replace the kitchen faucet in my rental property. The current one is leaking and needs to be replaced with a new model.',
      200,
      ['Plumbing', 'Kitchen'],
      'open',
      landlords[0].id,
      { city: 'Halifax', state: 'NS', coordinates: { lat: 44.6488, lng: -63.5752 } }
    );
    
    const job2Id = await createJob(
      'Ceiling Fan Installation',
      'Looking for an electrician to install a new ceiling fan in the living room of my property. The wiring is already in place from a previous light fixture.',
      150,
      ['Electrical', 'Installation'],
      'open',
      landlords[0].id,
      { city: 'Halifax', state: 'NS', coordinates: { lat: 44.6488, lng: -63.5752 } }
    );
    
    const job3Id = await createJob(
      'Bathroom Remodel',
      'Complete renovation of a small bathroom including new tiles, toilet, sink, and shower. Need an experienced contractor who can handle all aspects of the remodel.',
      6500,
      ['Bathroom', 'Renovation', 'Plumbing', 'Tiling'],
      'in_progress',
      landlords[1].id,
      { city: 'Dartmouth', state: 'NS', coordinates: { lat: 44.6667, lng: -63.5667 } }
    );
    
    const job4Id = await createJob(
      'Paint Living Room and Dining Room',
      'Need a painter to repaint the living room and dining room of my rental property. Walls are in good condition and just need a fresh coat of paint.',
      800,
      ['Painting', 'Interior'],
      'open',
      landlords[1].id,
      { city: 'Bedford', state: 'NS', coordinates: { lat: 44.7167, lng: -63.6833 } }
    );
    
    const job5Id = await createJob(
      'Replace Deck Boards',
      'Several boards on the back deck are rotting and need to be replaced. Looking for a carpenter to replace the damaged boards and stain the entire deck.',
      1200,
      ['Carpentry', 'Deck', 'Exterior'],
      'open',
      landlords[2].id,
      { city: 'Halifax', state: 'NS', coordinates: { lat: 44.6488, lng: -63.5752 } }
    );
    
    const job6Id = await createJob(
      'Roof Leak Repair',
      'There is a leak in the roof near the chimney that needs to be fixed. Water is coming in during heavy rain.',
      700,
      ['Roofing', 'Repair', 'Leak'],
      'open',
      landlords[2].id,
      { city: 'Halifax', state: 'NS', coordinates: { lat: 44.6488, lng: -63.5752 } }
    );
    
    // Create bids for contractor 10 (the known working user)
    const contractor10 = contractors.find(c => c.username === 'contractor 10');
    
    if (contractor10) {
      // Pending bids
      await createBid(
        job1Id, 
        contractor10.id, 
        275, 
        "I have experience with kitchen faucet replacements and can ensure a quality installation. I'll bring all the necessary tools and make sure there are no leaks.",
        '4 hours'
      );
      
      await createBid(
        job2Id, 
        contractor10.id, 
        180, 
        "I have installed dozens of ceiling fans and can ensure it's securely mounted and properly wired. I'll make sure the fan is balanced and operates quietly.",
        '2-3 hours'
      );
      
      // Accepted bid
      await createBid(
        job3Id, 
        contractor10.id, 
        7200, 
        "I can complete your bathroom remodel with high-quality workmanship. I have extensive experience in bathroom renovations and will ensure all plumbing and tiling is done correctly.",
        '2 weeks',
        'accepted'
      );
      
      // Rejected bid
      await createBid(
        job6Id, 
        contractor10.id, 
        750, 
        "I can repair your roof leak with quality materials to ensure it doesn't happen again. I'll inspect the entire roof and chimney area and address any potential future issues.",
        '1 day',
        'rejected'
      );

      // Add a couple more bids to job1
      await createBid(
        job1Id, 
        contractor10.id, 
        250, 
        "Additional bid with slightly different price",
        '1-2 days'
      );
      
      await createBid(
        job1Id, 
        contractor10.id, 
        150, 
        "Lower bid to be more competitive",
        '1-2 days'
      );
    } else {
      console.log('Warning: Contractor 10 not found, skipping their bids');
    }
    
    // Create some bids from other contractors
    if (contractors.length > 1) {
      for (let i = 0; i < Math.min(3, contractors.length); i++) {
        if (contractors[i].username !== 'contractor 10') {
          await createBid(
            job1Id,
            contractors[i].id,
            200 + (i * 25),
            `I can do this job quickly and efficiently. I have the right tools and experience for faucet replacement.`,
            '3-4 hours'
          );
          
          await createBid(
            job2Id,
            contractors[i].id,
            150 + (i * 20),
            `I specialize in electrical installations including ceiling fans. I can complete this work to code and ensure it's safely installed.`,
            '2 hours'
          );
        }
      }
    }
    
    console.log('✅ Jobs and bids created successfully!');
    
  } catch (error) {
    console.error('Error creating jobs and bids:', error);
  } finally {
    await pool.end();
  }
}

// Execute the function
createJobsAndBids();