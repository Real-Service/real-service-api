/**
 * Fixed implementation for jobs and bids API with direct SQL queries
 * Ensures proper mapping between snake_case database columns and camelCase frontend
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

// Create a router
export const jobsFixRouter = Router();

// Create a connection pool
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

// Helper to transform snake_case database column names to camelCase for frontend
function transformJob(job: any) {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    landlordId: job.landlord_id,
    status: job.status,
    pricingType: job.pricing_type,
    budget: parseFloat(job.budget || '0'),
    location: typeof job.location === 'string' ? JSON.parse(job.location) : job.location,
    categoryTags: job.category_tags || [],
    images: job.images || [],
    startDate: job.start_date,
    startTime: job.start_time,
    completionDate: job.completion_date,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    contractorId: job.contractor_id,
    // Add any additional fields that are necessary
  };
}

// Helper to transform snake_case database column names to camelCase for frontend
function transformBid(bid: any) {
  return {
    id: bid.id,
    jobId: bid.job_id,
    contractorId: bid.contractor_id,
    amount: parseFloat(bid.amount || '0'),
    proposal: bid.proposal,
    timeEstimate: bid.time_estimate,
    proposedStartDate: bid.proposed_start_date,
    status: bid.status,
    createdAt: bid.created_at,
    updatedAt: bid.updated_at,
    // Add any additional fields that are necessary
  };
}

// Get all available jobs (filtered by status="open")
jobsFixRouter.get('/all-jobs', async (req: Request, res: Response) => {
  try {
    console.log('Fetching all available jobs from Neon DB with proper column mapping');
    
    // Direct SQL query to get all open jobs with bid counts
    const result = await pool.query(`
      SELECT j.*, COUNT(b.id) AS bid_count 
      FROM jobs j 
      LEFT JOIN bids b ON j.id = b.job_id 
      WHERE j.status = 'open' 
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `);
    
    // Map column names from snake_case to camelCase
    const mappedJobs = result.rows.map(job => ({
      ...transformJob(job),
      bidCount: parseInt(job.bid_count || '0')
    }));
    
    console.log(`Found ${mappedJobs.length} available jobs`);
    return res.json(mappedJobs);
    
  } catch (error) {
    console.error('Error fetching available jobs:', error);
    return res.status(500).json({ 
      message: 'Error fetching available jobs',
      error: String(error)
    });
  }
});

// Get all bids for a contractor
jobsFixRouter.get('/contractor-bids/:contractorId', async (req: Request, res: Response) => {
  try {
    const contractorId = parseInt(req.params.contractorId);
    if (isNaN(contractorId)) {
      return res.status(400).json({ message: 'Invalid contractor ID' });
    }
    
    console.log(`Fetching bids for contractor ${contractorId} with proper column mapping`);
    
    // Direct SQL query for bids
    const result = await pool.query(`
      SELECT * FROM bids WHERE contractor_id = $1
      ORDER BY created_at DESC
    `, [contractorId]);
    
    // Map column names from snake_case to camelCase
    const mappedBids = result.rows.map(transformBid);
    
    console.log(`Found ${mappedBids.length} bids for contractor ${contractorId}`);
    return res.json(mappedBids);
    
  } catch (error) {
    console.error('Error fetching contractor bids:', error);
    return res.status(500).json({ 
      message: 'Error fetching contractor bids',
      error: String(error)
    });
  }
});

// Get a specific job by ID
jobsFixRouter.get('/job/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).json({ message: 'Invalid job ID' });
    }
    
    console.log(`Fetching job ${jobId} with proper column mapping`);
    
    // Direct SQL query for job
    const result = await pool.query(`
      SELECT j.*, COUNT(b.id) AS bid_count 
      FROM jobs j 
      LEFT JOIN bids b ON j.id = b.job_id 
      WHERE j.id = $1
      GROUP BY j.id
    `, [jobId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Map column names from snake_case to camelCase
    const job = {
      ...transformJob(result.rows[0]),
      bidCount: parseInt(result.rows[0].bid_count || '0')
    };
    
    return res.json(job);
    
  } catch (error) {
    console.error(`Error fetching job:`, error);
    return res.status(500).json({ 
      message: 'Error fetching job',
      error: String(error)
    });
  }
});

// Get jobs for a contractor (accepted or in progress)
jobsFixRouter.get('/contractor-jobs/:contractorId', async (req: Request, res: Response) => {
  try {
    const contractorId = parseInt(req.params.contractorId);
    if (isNaN(contractorId)) {
      return res.status(400).json({ message: 'Invalid contractor ID' });
    }
    
    console.log(`Fetching jobs for contractor ${contractorId} with proper column mapping`);
    
    // Direct SQL query to find jobs assigned to this contractor
    // or jobs that have accepted bids from this contractor
    const result = await pool.query(`
      SELECT DISTINCT j.*, COUNT(b.id) AS bid_count 
      FROM jobs j 
      LEFT JOIN bids b ON j.id = b.job_id 
      WHERE j.contractor_id = $1
         OR (b.contractor_id = $1 AND b.status = 'accepted')
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `, [contractorId]);
    
    // Map column names from snake_case to camelCase
    const mappedJobs = result.rows.map(job => ({
      ...transformJob(job),
      bidCount: parseInt(job.bid_count || '0')
    }));
    
    console.log(`Found ${mappedJobs.length} jobs for contractor ${contractorId}`);
    return res.json(mappedJobs);
    
  } catch (error) {
    console.error('Error fetching contractor jobs:', error);
    return res.status(500).json({ 
      message: 'Error fetching contractor jobs',
      error: String(error)
    });
  }
});

// Get bids for a job
jobsFixRouter.get('/job-bids/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).json({ message: 'Invalid job ID' });
    }
    
    console.log(`Fetching bids for job ${jobId} with proper column mapping`);
    
    // Direct SQL query for bids
    const result = await pool.query(`
      SELECT b.*, u.username, u.full_name AS contractor_name
      FROM bids b
      JOIN users u ON b.contractor_id = u.id
      WHERE b.job_id = $1
      ORDER BY b.created_at DESC
    `, [jobId]);
    
    // Map column names from snake_case to camelCase
    const mappedBids = result.rows.map(bid => ({
      ...transformBid(bid),
      contractorName: bid.contractor_name,
      username: bid.username
    }));
    
    console.log(`Found ${mappedBids.length} bids for job ${jobId}`);
    return res.json(mappedBids);
    
  } catch (error) {
    console.error('Error fetching job bids:', error);
    return res.status(500).json({ 
      message: 'Error fetching job bids',
      error: String(error)
    });
  }
});

// Create a new bid
jobsFixRouter.post('/create-bid', async (req: Request, res: Response) => {
  try {
    console.log('Creating new bid with proper column mapping', req.body);
    
    // Extract fields from request body
    const { 
      jobId, 
      contractorId, 
      amount, 
      proposal, 
      timeEstimate, 
      proposedStartDate 
    } = req.body;
    
    // Validate required fields
    if (!jobId || !contractorId || !amount || !proposal) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        required: ['jobId', 'contractorId', 'amount', 'proposal'] 
      });
    }
    
    // Check if the job exists
    const jobCheck = await pool.query(`SELECT id FROM jobs WHERE id = $1`, [jobId]);
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Check if the contractor exists
    const contractorCheck = await pool.query(`SELECT id FROM users WHERE id = $1 AND user_type = 'contractor'`, [contractorId]);
    if (contractorCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Contractor not found' });
    }
    
    // Check if the bid already exists
    const bidCheck = await pool.query(`
      SELECT id FROM bids 
      WHERE job_id = $1 AND contractor_id = $2
    `, [jobId, contractorId]);
    
    if (bidCheck.rows.length > 0) {
      return res.status(409).json({ 
        message: 'You have already submitted a bid for this job',
        bidId: bidCheck.rows[0].id
      });
    }
    
    // Insert the bid using snake_case column names for database
    const insertResult = await pool.query(`
      INSERT INTO bids (
        job_id, 
        contractor_id, 
        amount, 
        proposal, 
        time_estimate, 
        proposed_start_date,
        status,
        created_at,
        updated_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [
      jobId,
      contractorId,
      amount,
      proposal,
      timeEstimate || null,
      proposedStartDate || null,
      'pending'
    ]);
    
    if (insertResult.rows.length === 0) {
      return res.status(500).json({ message: 'Failed to create bid' });
    }
    
    // Map the response to camelCase for frontend
    const createdBid = transformBid(insertResult.rows[0]);
    
    console.log('Successfully created bid:', createdBid);
    return res.status(201).json(createdBid);
    
  } catch (error) {
    console.error('Error creating bid:', error);
    return res.status(500).json({ 
      message: 'Error creating bid',
      error: String(error)
    });
  }
});