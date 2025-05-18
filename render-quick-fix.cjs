/**
 * MINIMAL SERVER FOR RENDER.COM
 * CommonJS format - guaranteed to work on any Node.js setup
 */

const express = require('express');

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
app.listen(PORT, () => {
  // This exact message format is what Render needs
  console.log("Server listening on port " + PORT);
});