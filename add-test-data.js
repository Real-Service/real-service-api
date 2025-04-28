import pg from 'pg';
const { Pool } = pg;

// Create a connection to the specified production database
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function addTestData() {
  try {
    // Test the connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('Database connection successful. Server time:', connectionTest.rows[0].now);
    
    // Add 4 open jobs
    console.log('\nAdding 4 open jobs...');
    
    const openJobsData = [
      {
        title: 'Kitchen Renovation',
        description: 'Complete kitchen renovation including countertops, cabinets, and appliance installation.',
        landlord_id: 6, // Use a valid landlord ID from your database
        status: 'open',
        pricing_type: 'fixed',
        budget: 8500.00,
        location: JSON.stringify({ city: 'Toronto', state: 'Ontario', postalCode: 'M5V 2A8', coordinates: { lat: 43.6532, lng: -79.3832 } }),
        category_tags: JSON.stringify(['plumbing', 'electrical', 'carpentry']),
        images: JSON.stringify([]),
        start_date: new Date('2025-05-15'),
        start_time: '09:00 AM',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Bathroom Remodel',
        description: 'Renovate master bathroom with new shower, toilet, and vanity.',
        landlord_id: 6,
        status: 'open',
        pricing_type: 'fixed',
        budget: 4200.00,
        location: JSON.stringify({ city: 'Toronto', state: 'Ontario', postalCode: 'M4W 1A1', coordinates: { lat: 43.6715, lng: -79.3878 } }),
        category_tags: JSON.stringify(['plumbing', 'tiling']),
        images: JSON.stringify([]),
        start_date: new Date('2025-05-20'),
        start_time: '08:00 AM',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Fence Installation',
        description: 'Install 100 feet of wooden privacy fence around the backyard.',
        landlord_id: 6,
        status: 'open',
        pricing_type: 'fixed',
        budget: 3200.00,
        location: JSON.stringify({ city: 'Toronto', state: 'Ontario', postalCode: 'M6G 3A8', coordinates: { lat: 43.6654, lng: -79.4214 } }),
        category_tags: JSON.stringify(['carpentry', 'landscape']),
        images: JSON.stringify([]),
        start_date: new Date('2025-05-25'),
        start_time: '10:00 AM',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Roof Repair',
        description: 'Fix leaking roof and replace damaged shingles.',
        landlord_id: 6,
        status: 'open',
        pricing_type: 'open_bid', // Changed from 'hourly' to 'open_bid' based on enum values
        budget: 1800.00,
        location: JSON.stringify({ city: 'Toronto', state: 'Ontario', postalCode: 'M5T 1R4', coordinates: { lat: 43.6537, lng: -79.4001 } }),
        category_tags: JSON.stringify(['roofing']),
        images: JSON.stringify([]),
        start_date: new Date('2025-06-01'),
        start_time: '09:00 AM',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    for (const jobData of openJobsData) {
      const result = await pool.query(`
        INSERT INTO jobs (
          title, description, landlord_id, status, pricing_type, budget,
          location, category_tags, images, start_date, start_time,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING id
      `, [
        jobData.title, jobData.description, jobData.landlord_id,
        jobData.status, jobData.pricing_type, jobData.budget,
        jobData.location, jobData.category_tags, jobData.images,
        jobData.start_date, jobData.start_time,
        jobData.created_at, jobData.updated_at
      ]);
      
      console.log(`Created open job with ID: ${result.rows[0].id}`);
    }
    
    // Get the IDs of the open jobs we just created
    const openJobsResult = await pool.query(`
      SELECT id FROM jobs WHERE status = 'open' ORDER BY id DESC LIMIT 4
    `);
    
    const openJobIds = openJobsResult.rows.map(row => row.id);
    console.log('\nOpen job IDs:', openJobIds);
    
    // Create 2 jobs with different statuses for contractor 10
    console.log('\nAdding 2 additional jobs assigned to contractor 10...');
    
    const contractorJobsData = [
      {
        title: 'Drywall Repair',
        description: 'Repair damaged drywall in living room and repaint.',
        landlord_id: 6,
        contractor_id: 7, // Contractor 10 has ID 7
        status: 'in_progress',
        pricing_type: 'fixed',
        budget: 800.00,
        location: JSON.stringify({ city: 'Toronto', state: 'Ontario', postalCode: 'M5V 2N4', coordinates: { lat: 43.6425, lng: -79.3892 } }),
        category_tags: JSON.stringify(['drywall', 'painting']),
        images: JSON.stringify([]),
        start_date: new Date('2025-04-28'),
        start_time: '10:00 AM',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Deck Staining',
        description: 'Sand and stain deck with premium weatherproof stain.',
        landlord_id: 6,
        contractor_id: 7, // Contractor 10 has ID 7
        status: 'completed',
        pricing_type: 'fixed',
        budget: 1200.00,
        location: JSON.stringify({ city: 'Toronto', state: 'Ontario', postalCode: 'M4K 1P7', coordinates: { lat: 43.6765, lng: -79.3521 } }),
        category_tags: JSON.stringify(['deck', 'painting']),
        images: JSON.stringify([]),
        start_date: new Date('2025-04-15'),
        start_time: '08:00 AM',
        created_at: new Date('2025-04-15'),
        updated_at: new Date('2025-04-20')
      }
    ];
    
    for (const jobData of contractorJobsData) {
      const result = await pool.query(`
        INSERT INTO jobs (
          title, description, landlord_id, contractor_id, status, pricing_type, budget,
          location, category_tags, images, start_date, start_time,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING id
      `, [
        jobData.title, jobData.description, jobData.landlord_id, jobData.contractor_id,
        jobData.status, jobData.pricing_type, jobData.budget,
        jobData.location, jobData.category_tags, jobData.images,
        jobData.start_date, jobData.start_time,
        jobData.created_at, jobData.updated_at
      ]);
      
      console.log(`Created job with ID: ${result.rows[0].id} and status: ${jobData.status}`);
    }
    
    // Add 3 bids for contractor 10 (with pending, accepted, and rejected statuses)
    console.log('\nAdding 3 bids for contractor 10...');
    
    if (openJobIds.length >= 3) {
      const bidData = [
        {
          job_id: openJobIds[0],
          contractor_id: 7, // Contractor 10 has ID 7
          amount: 8200.00,
          proposal: "I can complete this kitchen renovation with premium materials and experienced crew. Have done 20+ similar projects.",
          time_estimate: "3 weeks",
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          job_id: openJobIds[1],
          contractor_id: 7, // Contractor 10 has ID 7
          amount: 4000.00,
          proposal: "Specialized in bathroom remodeling. Can start immediately with quick 10-day turnaround.",
          time_estimate: "10 days",
          status: 'accepted',
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          updated_at: new Date() 
        },
        {
          job_id: openJobIds[2],
          contractor_id: 7, // Contractor 10 has ID 7
          amount: 3500.00,
          proposal: "Can install premium cedar fence with lifetime warranty.",
          time_estimate: "4 days",
          status: 'rejected',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          updated_at: new Date()
        }
      ];
      
      for (const bid of bidData) {
        const result = await pool.query(`
          INSERT INTO bids (
            job_id, contractor_id, amount, proposal, time_estimate, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          ) RETURNING id
        `, [
          bid.job_id, bid.contractor_id, bid.amount, bid.proposal, 
          bid.time_estimate, bid.status, bid.created_at, bid.updated_at
        ]);
        
        console.log(`Created bid with ID: ${result.rows[0].id} for job ID: ${bid.job_id} with status: ${bid.status}`);
      }
    } else {
      console.log('Not enough open jobs to create bids. Please check that job creation was successful.');
    }
    
    console.log('\nTest data creation complete!');
    
  } catch (error) {
    console.error('Error adding test data:', error);
  } finally {
    await pool.end();
  }
}

addTestData().catch(console.error);