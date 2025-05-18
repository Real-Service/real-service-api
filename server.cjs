// CommonJS server file for Render.com
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Health check routes
app.get('/health', (req, res) => {
  res.send('OK');
});

app.get('/healthz', (req, res) => {
  res.send('OK');
});

// Root route
app.get('/', (req, res) => {
  res.send('Real Service API');
});

// Start the server
const server = app.listen(port, () => {
  // Must log port in EXACTLY this format for Render.com
  console.log(`server is listening on port ${port}`);
});

// Make sure process doesn't exit immediately
process.stdin.resume();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server gracefully closed');
  });
});