// Ultra-minimal server for Render.com
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Welcome to Real Service API');
});

app.get('/healthz', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});