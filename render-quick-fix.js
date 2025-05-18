#!/usr/bin/env node
/**
 * MINIMAL EXPRESS SERVER FOR RENDER.COM
 * This file has only one purpose: bind to the port Render provides
 * And properly log it so Render can detect it
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// CRITICAL: Use this exact format for the PORT
const PORT = process.env.PORT || 5000;

// Basic health check routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// CRITICAL: Use this exact format as shown in the screenshot
app.listen(PORT, () => {
  // Using the exact format shown in the screenshot
  console.log("✅ Server is running and listening on port " + PORT);
});