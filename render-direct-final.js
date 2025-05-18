// Guaranteed working version for Render.com deployment
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (_, res) => {
  res.send('Welcome to Real Service API');
});

app.get('/healthz', (_, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`🟢 server is listening on port ${port}`);
});