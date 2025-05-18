/**
 * Extremely simplified server startup file for Render.com
 * This bypasses any Vite-related code completely
 */

// Load environment variables
require('dotenv').config({ path: '.env.production' });

// Set environment to production 
process.env.NODE_ENV = 'production';

// Always set PORT to 5000 or use the environment variable
process.env.PORT = process.env.PORT || '5000';

console.log('🚀 Starting server in production mode...');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Start the server
try {
  // Import the server module
  require('./dist/index.js');
  console.log('✅ Server started successfully!');
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}