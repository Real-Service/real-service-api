import express from 'express';

const app = express();

// CRITICAL: Define PORT exactly like this
const PORT = process.env.PORT || 5000;

// Health checks
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Basic route
app.get('/', (req, res) => {
  res.send('Real Service API is running');
});

// CRITICAL: Exactly this format is required by Render.com
app.listen(PORT, () => {
  console.log(`✅ Server is running and listening on port ${PORT}`);
});