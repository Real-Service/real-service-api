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

// CRITICAL: Use exactly this format for Render.com port detection
app.listen(PORT, () => {
  // The EXACT format Render is looking for
  console.log("Server listening on port " + PORT);
});