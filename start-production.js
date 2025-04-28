/**
 * Production startup script for Real Service API
 * This script starts the server in production mode
 */

require('dotenv').config({ path: '.env.production' });

console.log('Starting Real Service API in production mode...');
console.log('Environment: ', process.env.NODE_ENV);
console.log('Port: ', process.env.PORT || 8080);
console.log('Database: ', process.env.DATABASE_URL ? 'Connected' : 'Not configured');
console.log('CORS Origin: ', process.env.CORS_ORIGIN || 'Any');

// Try to connect to the database before starting the server
// This way we fail fast if the database connection isn't working
async function checkDatabase() {
  try {
    console.log('Validating database connection...');
    
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Neon database
      }
    });
    
    // Test the connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    console.log('Database connection successful, timestamp:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

// Start the server if database is connected
async function startServer() {
  const dbConnected = await checkDatabase();
  
  if (!dbConnected) {
    console.error('Failed to connect to database, exiting...');
    process.exit(1);
  }
  
  // We can now safely start the server
  console.log('Starting server...');
  
  try {
    // Load the server with the production flag
    process.env.NODE_ENV = 'production';
    require('./server/index.js');
    console.log('Server started successfully!');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the startup sequence
startServer();