/**
 * Simple startup script for Render.com deployment
 * 
 * This script tries multiple approaches to start the server:
 * 1. First tries the compiled TypeScript version at dist/server/index.js
 * 2. Then tries a regular compiled version at dist/index.js
 * 3. Finally falls back to the pure production server implementation
 */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Set production environment
process.env.NODE_ENV = 'production';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define all possible server paths
const possiblePaths = [
  resolve(__dirname, 'dist/server/index.js'),
  resolve(__dirname, 'dist/index.js'),
  resolve(__dirname, 'pure-production-server.js')
];

// Find the first existing server file
let serverPath = null;
for (const path of possiblePaths) {
  console.log(`Checking for server at: ${path}`);
  if (existsSync(path)) {
    serverPath = path;
    console.log(`Found server at: ${path}`);
    break;
  }
}

if (!serverPath) {
  console.error('ERROR: No server file found at any expected location');
  process.exit(1);
}

// Start the server
console.log(`Starting server from: ${serverPath}`);
import(serverPath)
  .then(() => {
    console.log('Server started successfully');
  })
  .catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });