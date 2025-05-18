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

// Parse PORT as integer - CRITICAL for Render
const PORT = parseInt(process.env.PORT || "10000", 10);

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

// Bind directly with Express to the port
// DO NOT use template literals for the console.log
app.listen(PORT, "0.0.0.0", () => {
  // This exact message format is what Render is looking for
  console.log("Server listening on port " + PORT);
});