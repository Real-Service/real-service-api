/**
 * MINIMAL SERVER FOR RENDER.COM
 * ES Module format for package.json with "type": "module"
 */

import express from 'express';

// Create a minimal express app
const app = express();

// CRITICAL: Define PORT this way
const PORT = process.env.PORT || 10000;

// Basic health check routes
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Root route
app.get('/', (req, res) => {
  res.send('API Server Running');
});

// CRITICAL: Use exactly this format without any fancy text
app.listen(PORT, '0.0.0.0', () => {
  // This exact message format is what Render needs
  console.log("Server listening on port " + PORT);
});