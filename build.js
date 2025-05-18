#!/usr/bin/env node

/**
 * Special build script for Real Service API
 * This script builds only the server without requiring Vite
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting server-only build process...');

// Create dist directory if it doesn't exist
if (!fs.existsSync('./dist')) {
  console.log('📁 Creating dist directory...');
  fs.mkdirSync('./dist', { recursive: true });
}

// Build server with esbuild
try {
  console.log('🔨 Building server with esbuild...');
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', {
    stdio: 'inherit'
  });
  console.log('✅ Server build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}

console.log('🎉 Build process completed successfully!');