const { Pool } = require('pg');
require('dotenv').config();

// Target DB connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const CONTRACTOR_ID = 7; // ID for contractor 10
const LANDLORD_IDS = [3, 4, 5, 6]; // Using existing landlord profiles

async function createJob(title, description, budget, categoryTags, status, landlordId, location) {
  const query = `
    INSERT INTO jobs(
      title, description, budget, category_tags, status, landlord_id, location, is_urgent, created_at, updated_at
    ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING id
  `;

  const isUrgent = Math.random() > 0.7; // 30% chance of being urgent

  const { rows } = await pool.query(query, [
    title,
    description,
    budget,
    categoryTags,
    status,
    landlordId,
    JSON.stringify(location),
    isUrgent
  ]);

  return rows[0].id;
}

async function createBid(jobId, contractorId, amount, proposal, timeEstimate, status = 'pending') {
  const query = `
    INSERT INTO bids(
      job_id, contractor_id, amount, proposal, time_estimate, status, created_at, updated_at
    ) VALUES($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING id
  `;

  const { rows } = await pool.query(query, [
    jobId,
    contractorId,
    amount,
    proposal,
    timeEstimate,
    status
  ]);

  return rows[0].id;
}

async function createJobsAndBidsForContractor10() {
  console.log('Creating jobs and bids for contractor 10 (ID: 7)...');
  
  try {
    // First, create some open jobs that could be bid on
    const openJobs = [
      {
        title: 'Fix leaking bathroom faucet',
        description: 'The bathroom faucet has been leaking for a week. Need it fixed ASAP.',
        budget: 120,
        categoryTags: ['Plumbing', 'Bathroom', 'Urgent'],
        landlordId: LANDLORD_IDS[0],
        location: {
          city: 'Halifax',
          state: 'NS',
          coordinates: {
            latitude: 44.6488,
            longitude: -63.5752
          }
        }
      },
      {
        title: 'Kitchen renovation',
        description: 'Looking for a contractor to renovate our kitchen. Need new cabinets, countertop, and backsplash.',
        budget: 5000,
        categoryTags: ['Kitchen', 'Renovation', 'Carpentry'],
        landlordId: LANDLORD_IDS[1],
        location: {
          city: 'Dartmouth',
          state: 'NS',
          coordinates: {
            latitude: 44.6658,
            longitude: -63.5669
          }
        }
      },
      {
        title: 'Repair deck',
        description: 'Deck has some rotting boards that need to be replaced and the whole deck needs to be stained.',
        budget: 1200,
        categoryTags: ['Carpentry', 'Exterior', 'Maintenance'],
        landlordId: LANDLORD_IDS[2],
        location: {
          city: 'Halifax',
          state: 'NS',
          coordinates: {
            latitude: 44.6420,
            longitude: -63.5644
          }
        }
      },
      {
        title: 'Replace furnace filter',
        description: 'Need regular maintenance - replacing the furnace filter.',
        budget: 80,
        categoryTags: ['HVAC', 'Maintenance', 'Quick Job'],
        landlordId: LANDLORD_IDS[3],
        location: {
          city: 'Bedford',
          state: 'NS',
          coordinates: {
            latitude: 44.7325,
            longitude: -63.6590
          }
        }
      }
    ];

    console.log('Creating open jobs...');
    for (const jobData of openJobs) {
      await createJob(
        jobData.title,
        jobData.description,
        jobData.budget,
        jobData.categoryTags,
        'open',
        jobData.landlordId,
        jobData.location
      );
    }
    console.log(`Created ${openJobs.length} open jobs`);

    // Create some jobs with bids from contractor 10
    const jobsWithBids = [
      {
        title: 'Paint living room',
        description: 'Need to paint my living room walls. The walls are currently beige and I want to change to light gray.',
        budget: 550,
        categoryTags: ['Painting', 'Interior'],
        landlordId: LANDLORD_IDS[0],
        location: {
          city: 'Halifax',
          state: 'NS',
          coordinates: {
            latitude: 44.6488,
            longitude: -63.5752
          }
        },
        bid: {
          amount: 525,
          proposal: 'I can complete this job within a week. I have extensive experience with interior painting and will ensure clean lines and proper coverage.',
          timeEstimate: '3 days',
          status: 'pending'
        }
      },
      {
        title: 'Replace bathroom sink',
        description: 'The bathroom sink is cracked and needs to be replaced.',
        budget: 300,
        categoryTags: ['Plumbing', 'Bathroom'],
        landlordId: LANDLORD_IDS[1],
        location: {
          city: 'Dartmouth',
          state: 'NS',
          coordinates: {
            latitude: 44.6658,
            longitude: -63.5669
          }
        },
        bid: {
          amount: 350,
          proposal: 'I noticed the budget is a bit low for this type of work. I can replace the sink with a high-quality model that will last for years.',
          timeEstimate: '1 day',
          status: 'accepted'
        }
      },
      {
        title: 'Fix electrical outlet',
        description: 'One of the outlets in the bedroom isn\'t working. Need an electrician to check it out.',
        budget: 150,
        categoryTags: ['Electrical', 'Quick Fix'],
        landlordId: LANDLORD_IDS[2],
        location: {
          city: 'Halifax',
          state: 'NS',
          coordinates: {
            latitude: 44.6420,
            longitude: -63.5644
          }
        },
        bid: {
          amount: 125,
          proposal: 'I can troubleshoot the outlet and fix it. If it\'s a simple issue, it won\'t take long.',
          timeEstimate: '2 hours',
          status: 'rejected'
        }
      }
    ];

    console.log('Creating jobs with bids from contractor 10...');
    for (const jobData of jobsWithBids) {
      const jobId = await createJob(
        jobData.title,
        jobData.description,
        jobData.budget,
        jobData.categoryTags,
        'open',
        jobData.landlordId,
        jobData.location
      );

      await createBid(
        jobId,
        CONTRACTOR_ID,
        jobData.bid.amount,
        jobData.bid.proposal,
        jobData.bid.timeEstimate,
        jobData.bid.status
      );
    }
    console.log(`Created ${jobsWithBids.length} jobs with bids from contractor 10`);

    // Create some jobs assigned to contractor 10
    const assignedJobs = [
      {
        title: 'Install ceiling fan',
        description: 'Need a ceiling fan installed in the master bedroom.',
        budget: 250,
        categoryTags: ['Electrical', 'Installation'],
        status: 'in_progress',
        landlordId: LANDLORD_IDS[3],
        contractorId: CONTRACTOR_ID,
        location: {
          city: 'Bedford',
          state: 'NS',
          coordinates: {
            latitude: 44.7325,
            longitude: -63.6590
          }
        }
      },
      {
        title: 'Replace kitchen faucet',
        description: 'The kitchen faucet is old and needs to be replaced with a new model.',
        budget: 200,
        categoryTags: ['Plumbing', 'Kitchen'],
        status: 'completed',
        landlordId: LANDLORD_IDS[0],
        contractorId: CONTRACTOR_ID,
        location: {
          city: 'Halifax',
          state: 'NS',
          coordinates: {
            latitude: 44.6488,
            longitude: -63.5752
          }
        }
      }
    ];

    console.log('Creating jobs assigned to contractor 10...');
    for (const jobData of assignedJobs) {
      const query = `
        INSERT INTO jobs(
          title, description, budget, category_tags, status, landlord_id, contractor_id, location, created_at, updated_at
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id
      `;

      await pool.query(query, [
        jobData.title,
        jobData.description,
        jobData.budget,
        jobData.categoryTags,
        jobData.status,
        jobData.landlordId,
        jobData.contractorId,
        JSON.stringify(jobData.location)
      ]);
    }
    console.log(`Created ${assignedJobs.length} jobs assigned to contractor 10`);

    console.log('All jobs and bids created successfully!');
  } catch (error) {
    console.error('Error creating jobs and bids:', error);
  } finally {
    await pool.end();
  }
}

createJobsAndBidsForContractor10();