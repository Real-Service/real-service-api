// Simple test to check if Node is working
console.log('Node is working!');
console.log('Environment variables:');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('SESSION_SECRET exists:', !!process.env.SESSION_SECRET);