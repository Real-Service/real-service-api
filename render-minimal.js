// Minimal server with exact format Render.com is looking for
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (_, res) => {
  res.send('API Server Running');
});

app.get('/healthz', (_, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`server is listening on port ${port}`);
});