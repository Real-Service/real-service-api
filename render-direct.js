// Fixed minimal server for Render.com
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (_, res) => {
  res.send('API Server Running');
});

app.get('/healthz', (_, res) => {
  res.send('OK');
});

// Render.com is looking for exactly this format
app.listen(port, () => {
  // Don't modify this line - it must be exactly like this
  console.log("server is listening on port " + port);
});