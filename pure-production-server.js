#!/usr/bin/env node
/**
 * ULTRA-MINIMAL PRODUCTION SERVER
 * No dependencies on any other files in the project
 * This is a pure JavaScript file with no TypeScript or Vite
 * It can be deployed to Render.com without any compilation
 */

import express from 'express';
import path from 'path';
import { createServer } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up database connection
const { Pool } = pg;
let pool;

try {
  if (process.env.DATABASE_URL) {
    console.log('Initializing database connection pool...');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Test database connection
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('Database connection error:', err.message);
      } else {
        console.log('Database connected successfully at:', res.rows[0].now);
      }
    });
  } else {
    console.warn('No DATABASE_URL found in environment, database features will be unavailable');
  }
} catch (error) {
  console.error('Failed to initialize database pool:', error.message);
}

// Create Express app
const app = express();
const port = process.env.PORT || 5000;
console.log(`Starting production server with PORT=${port}`);

// Debug: Log all environment variables to help with troubleshooting
console.log('Environment variables:');
Object.keys(process.env).forEach(key => {
  if (!key.includes('SECRET') && !key.includes('KEY') && !key.includes('PASSWORD')) {
    console.log(`${key}=${process.env[key]}`);
  } else {
    console.log(`${key}=[REDACTED]`);
  }
});

// Basic middleware
app.use(express.json({ limit: '10mb' }));

// Health check endpoint with database status
app.get('/healthz', async (req, res) => {
  let dbStatus = 'unavailable';
  let dbMessage = 'Database not configured';
  
  if (pool) {
    try {
      const result = await pool.query('SELECT NOW()');
      dbStatus = 'connected';
      dbMessage = `Connected at ${result.rows[0].now}`;
    } catch (error) {
      dbStatus = 'error';
      dbMessage = error.message;
    }
  }
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Pure server is running correctly',
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      message: dbMessage
    }
  });
});

// API status endpoint
app.get('/api/status', async (req, res) => {
  let dbStatus = 'unavailable';
  
  if (pool) {
    try {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'error';
    }
  }
  
  res.status(200).json({
    version: '1.0',
    status: 'operational',
    message: 'Production deployment server running (no Vite dependencies)',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Simple logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Serve static files
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'index.html'), `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Real Service API</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { color: #333; }
      </style>
    </head>
    <body>
      <h1>Real Service API</h1>
      <p>The production server is running.</p>
      <p>This is a pure JavaScript server with no Vite dependencies.</p>
      <p>API available at <code>/api/*</code></p>
    </body>
    </html>
  `);
}

app.use(express.static(publicDir));

// SPA routing
app.get('*', (req, res) => {
  // API routes should 404 if not found
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  
  // All other routes go to index.html
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Create and start server
const server = createServer(app);

// CRITICAL FIX: Use the exact format required by Render
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server is running and listening on port ${PORT}`);
});