// Mimimal server file - EXACTLY as shown in screenshots
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

// Basic routes
app.get('/', (_, res) => {
  res.send('Real Service API - Server is running');
});

app.get('/healthz', (_, res) => {
  res.send('OK');
});

// Start the server with exactly the same format as screenshot
app.listen(port, () => {
  // Must use this exact format - no template literals
  console.log("server is listening on port " + port);
});