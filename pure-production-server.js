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

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const port = process.env.PORT || 5000;

// Basic middleware
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Pure server is running correctly',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.status(200).json({
    version: '1.0',
    status: 'operational',
    message: 'Production deployment server running (no Vite dependencies)',
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
server.listen(port, () => {
  console.log(`Pure production server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});