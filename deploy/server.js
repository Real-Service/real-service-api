#!/usr/bin/env node
/**
 * ULTRA MINIMAL PRODUCTION SERVER
 * No dependencies on ANY other files in the project
 * Completely standalone file that can be run directly
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const port = process.env.PORT || 5000;

// Basic middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Server is running in minimal production mode',
  });
});

// API endpoint that returns a message
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Production server is running in minimal mode',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files from public directory
const publicDir = path.join(__dirname, 'public');
console.log(`Serving static files from: ${publicDir}`);
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
    message: 'Connected to minimal production server',
    timestamp: new Date().toISOString()
  }));
});

// Start the server
server.listen(port, () => {
  console.log(`Minimal production server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});