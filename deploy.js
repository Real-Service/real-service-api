#!/usr/bin/env node
/**
 * Secure Deployment Script for Real Service API
 * 
 * This script handles deployment preparation while ensuring secrets are not exposed.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing for deployment...');

// Ensure all dependencies are installed
try {
  console.log('📦 Installing dependencies...');
  execSync('npm ci', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Check for proper environment setup
const envFile = path.join(__dirname, '.env.production');
if (!fs.existsSync(envFile)) {
  console.error('❌ Missing .env.production file. Please create it first.');
  console.log('💡 Tip: Run node migrate-secrets.js to create it from your secrets.txt');
  process.exit(1);
}

// Verify the environment has required variables
const requiredVars = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'COOKIE_SECRET',
  'CORS_ORIGIN',
  'FRONTEND_URL'
];

const envContent = fs.readFileSync(envFile, 'utf8');
const missingVars = [];

requiredVars.forEach(varName => {
  if (!envContent.includes(`${varName}=`)) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.log('💡 Add them to .env.production before deploying');
  process.exit(1);
}

// Check if secrets.txt still exists and warn
const secretsFile = path.join(__dirname, 'secrets.txt');
if (fs.existsSync(secretsFile)) {
  console.warn('⚠️ WARNING: secrets.txt file still exists. This file should not be committed.');
  console.log('💡 Tip: Run node migrate-secrets.js to safely migrate your secrets');
}

// Build the application
try {
  console.log('🔨 Building application...');
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Run deployment tests
try {
  console.log('🧪 Running deployment tests...');
  execSync('node test-deployment.js', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Deployment tests failed:', error.message);
  process.exit(1);
}

console.log('\n✅ Deployment preparation complete!');
console.log('\n📋 Next steps:');
console.log('1. Push your code to GitHub (secrets won\'t be included due to .gitignore)');
console.log('2. Connect your repository to Render.com or your preferred hosting service');
console.log('3. Add environment secrets through the hosting service dashboard');
console.log('4. Deploy and verify with the test-deployment.js script');

console.log('\n💡 For Render.com:');
console.log('- Use render.yaml for Blueprint deployment');
console.log('- Or create a new Web Service with:');
console.log('  - Build Command: npm ci');
console.log('  - Start Command: node start-production.js');
console.log('  - Health Check Path: /healthz');

console.log('\n🎉 Good luck with your deployment!');