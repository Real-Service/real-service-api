// Minimal server for Render.com deployment
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

// Basic health check route required by Render
app.get('/healthz', (_, res) => {
  res.send('OK');
});

// Root route
app.get('/', (_, res) => {
  res.send('Real Service API');
});

// Start the server and ensure it keeps running
const server = app.listen(port, '0.0.0.0', () => {
  // This EXACT format is required for Render to detect the port
  console.log(`server is listening on port ${port}`);
});

// Keep the process running
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
  });
});