// Ultra-minimal standalone server for Render.com
import express from 'express';
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

// Store server reference
const server = app.listen(port, () => {
  // This format is essential for Render port detection
  console.log(`server is listening on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server gracefully closed');
  });
});