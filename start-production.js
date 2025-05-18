/**
 * Production startup script for Real Service API
 * This script starts the server in production mode
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Check for server file at various possible locations
const possibleServerPaths = [
  './dist/index.js',
  './dist/server/index.js',
  './deploy-pure-final/index.js'
];

async function checkServerFile() {
  for (const serverPath of possibleServerPaths) {
    try {
      if (fs.existsSync(serverPath)) {
        console.log(`Found server file at: ${serverPath}`);
        return serverPath;
      }
    } catch (error) {
      console.error(`Error checking ${serverPath}:`, error);
    }
  }
  return null;
}

async function startServer() {
  try {
    console.log('Starting production server...');
    
    // Find the server file
    const serverPath = await checkServerFile();
    
    if (!serverPath) {
      console.error('No server file found! Checking for pure server backup...');
      
      // If we can't find the compiled file, try to use the pure JS version as fallback
      if (fs.existsSync('./pure-production-server.js')) {
        console.log('Found pure production server, using as fallback');
        process.env.NODE_ENV = 'production';
        import('./pure-production-server.js');
        return;
      }
      
      throw new Error('No server file found at any of the expected locations');
    }
    
    // Start the server with the correct file
    console.log(`Starting server with: ${serverPath}`);
    process.env.NODE_ENV = 'production';
    
    // Use dynamic import for ESM compatibility
    const serverModule = await import(serverPath);
    
    console.log('Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();