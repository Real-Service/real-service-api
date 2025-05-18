/**
 * Standalone minimal server for Render.com
 * Created specifically to fix "No Open Ports Detected" error
 */

// Using ES module syntax
import express from 'express';

// Create Express app
const app = express();

// Get PORT from environment with fallback
const port = process.env.PORT || 3000;

// Health check endpoint that Render requires
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Basic route
app.get('/', (req, res) => {
  res.send('Real Service API');
});

// Start server and save reference to prevent exit
const server = app.listen(port, '0.0.0.0', () => {
  // CRITICAL: This exact format is required for Render port detection
  console.log(`server is listening on port ${port}`);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => {
    console.log('Server closed');
  });
});

// Export for potential reuse
export default app;