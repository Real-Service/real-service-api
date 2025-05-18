// COMPLETE SERVER FOR RENDER.COM
// This file contains everything needed to deploy
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

// Health check route
app.get('/healthz', (_, res) => {
  res.send('OK');
});

// Root route
app.get('/', (_, res) => {
  res.send('Real Service API Running');
});

// Important: Start the server and keep it running
const server = app.listen(port, () => {
  console.log(`server is listening on port ${port}`);
});

// Prevent process from exiting immediately
process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server shutting down gracefully');
    process.exit(0);
  });
});