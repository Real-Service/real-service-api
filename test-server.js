// Simple test server to check environment
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Test server is working!');
});

const port = 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Test server running on port ${port}`);
});