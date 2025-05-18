#!/usr/bin/env node
/**
 * STANDALONE PRODUCTION SERVER
 * This file has ZERO dependencies on any project code or Vite
 */

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
    timestamp: new Date().toISOString(),
    message: 'Standalone server running'
  });
});

// API endpoint
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    environment: process.env.NODE_ENV || 'development',
    message: 'API is running in standalone mode'
  });
});

// Public directory setup
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  
  // Create a minimal index.html if none exists
  fs.writeFileSync(path.join(publicDir, 'index.html'), `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Server Running</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { color: #333; }
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

// Serve static files
app.use(express.static(publicDir));

// SPA routing
app.get('*', (req, res) => {
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
    type: 'status',
    message: 'Connected to server',
    timestamp: new Date().toISOString()
  }));
});

// Start the server
server.listen(port, () => {
  console.log(`Standalone server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});