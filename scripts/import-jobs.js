import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

// Create a new pool with the connection string
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// Sample job data to import
const jobsToImport = [
  {
    title: 'Fix leaking bathroom faucet',
    description: 'The bathroom faucet is constantly dripping, wasting water and causing stains in the sink. Need someone to repair or replace it.',
    budget: 150,
    status: 'open',
    pricingType: 'fixed',
    startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    location: {
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      latitude: 40.7128,
      longitude: -74.0060
    },
    images: [],
    categoryTags: ['plumbing', 'repair', 'bathroom'],
    isUrgent: false,
    deadline: '3 days'
  },
  {
    title: 'Install ceiling fan in bedroom',
    description: 'Need a ceiling fan installed in the master bedroom. The wiring is already in place, just need the fan to be mounted and connected.',
    budget: 180,
    status: 'open',
    pricingType: 'fixed',
    startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    location: {
      address: '456 Park Ave',
      city: 'Boston',
      state: 'MA',
      zipCode: '02108',
      latitude: 42.3601,
      longitude: -71.0589
    },
    images: [],
    categoryTags: ['electrical', 'installation', 'ceiling fan'],
    isUrgent: false,
    deadline: '1 week'
  },
  {
    title: 'Fix broken kitchen cabinet hinges',
    description: 'Several kitchen cabinets have broken hinges causing doors to hang incorrectly. Need someone to replace the hinges and realign the doors.',
    budget: 130,
    status: 'open',
    pricingType: 'fixed',
    startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    location: {
      address: '789 Broadway',
      city: 'Brooklyn',
      state: 'NY',
      zipCode: '11201',
      latitude: 40.6782,
      longitude: -73.9442
    },
    images: [],
    categoryTags: ['carpentry', 'repair', 'kitchen'],
    isUrgent: false,
    deadline: '5 days'
  },
  {
    title: 'Rewire living room outlets',
    description: 'The outlets in the living room need to be rewired to support modern appliances. Currently they trip the circuit breaker when multiple devices are used.',
    budget: 280,
    status: 'open',
    pricingType: 'open_bid',
    startDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
    location: {
      address: '101 State St',
      city: 'Cambridge',
      state: 'MA',
      zipCode: '02138',
      latitude: 42.3736,
      longitude: -71.1097
    },
    images: [],
    categoryTags: ['electrical', 'rewiring', 'safety'],
    isUrgent: true,
    deadline: '1 week'
  }
];

async function importJobs() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting job import...');
    
    // Get landlord IDs
    const landlordResult = await client.query(`
      SELECT u.id
      FROM users u
      JOIN landlord_profiles lp ON u.id = lp.user_id
      WHERE u.user_type = 'landlord'
    `);
    
    if (landlordResult.rows.length === 0) {
      console.log('No landlords found in the database. Cannot import jobs.');
      return;
    }
    
    const landlordIds = landlordResult.rows.map(row => row.id);
    console.log(`Found ${landlordIds.length} landlords: ${landlordIds.join(', ')}`);
    
    // Import each job
    for (let i = 0; i < jobsToImport.length; i++) {
      const job = jobsToImport[i];
      // Assign each job to a landlord (round robin)
      const landlordId = landlordIds[i % landlordIds.length];
      
      // Insert job
      const result = await client.query(
        `INSERT INTO jobs (
          title, description, budget, status, pricing_type, start_date,
          location, images, category_tags, landlord_id, created_at, updated_at,
          is_urgent, deadline
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11, $12)
        RETURNING id`,
        [
          job.title,
          job.description,
          job.budget,
          job.status,
          job.pricingType,
          job.startDate,
          JSON.stringify(job.location),
          JSON.stringify(job.images),
          JSON.stringify(job.categoryTags),
          landlordId,
          job.isUrgent,
          job.deadline
        ]
      );
      
      const jobId = result.rows[0].id;
      console.log(`Created job '${job.title}' with ID ${jobId} for landlord ID ${landlordId}`);
    }
    
    await client.query('COMMIT');
    console.log('Job import completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing jobs:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
importJobs();