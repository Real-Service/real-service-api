#!/usr/bin/env node
/**
 * MINIMAL EXPRESS SERVER FOR RENDER.COM
 * This file has only one purpose: bind to the port Render provides
 * And properly log it so Render can detect it
 */

const express = require('express');
const http = require('http');
const path = require('path');

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