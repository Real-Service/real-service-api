/**
 * Health check endpoints for production monitoring
 * These endpoints are used by services like Render and Vercel to verify the app is running
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Simple health check endpoint
router.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Detailed health check with timestamp
router.get('/api/health', async (req, res) => {
  try {
    // Basic health information
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    };

    // Check database connection if DATABASE_URL is available
    if (process.env.DATABASE_URL) {
      try {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: {
            rejectUnauthorized: false
          },
          // Fast query timeout
          query_timeout: 2000,
          connectionTimeoutMillis: 2000
        });

        // Test the connection with a simple query
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as time');
        client.release();

        health.database = {
          connected: true,
          timestamp: result.rows[0].time
        };
      } catch (dbError) {
        health.database = {
          connected: false,
          error: process.env.NODE_ENV === 'production' ? 'Database connection failed' : dbError.message
        };
      }
    }

    res.status(200).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;