#!/usr/bin/env node
// STANDALONE PRODUCTION SERVER - NO VITE DEPENDENCIES
// This file is completely independent and can be deployed on its own

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get directory name in ESM
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
    timestamp: new Date().toISOString()
  });
});

// API endpoint that returns a message
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Production server is running in standalone mode',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files
const publicDir = path.join(__dirname, 'public');
// Create public dir if it doesn't exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  // Create a basic index.html
  fs.writeFileSync(path.join(publicDir, 'index.html'), `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Server Running</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
        h1 { color: #333; }
        p { line-height: 1.6; }
      </style>
    </head>
    <body>
      <h1>Server Running</h1>
      <p>The standalone production server is running successfully.</p>
      <p>API is available at <code>/api/*</code></p>
    </body>
    </html>
  `);
}

app.use(express.static(publicDir));

// For SPA routing - send the index.html for any non-API routes
app.get('*', (req, res) => {
  // API requests should 404 if not found
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ 
  server, 
  path: '/ws'
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.send(JSON.stringify({
    type: 'server_status',
    message: 'Connected to standalone server',
    timestamp: new Date().toISOString()
  }));
});

// Start the server
server.listen(port, () => {
  console.log(`Standalone production server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});