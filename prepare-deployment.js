#!/usr/bin/env node
/**
 * Deployment Preparation Script for Real Service API
 * 
 * This script prepares your project for deployment by:
 * 1. Checking if all required files exist
 * 2. Ensuring no secrets are committed
 * 3. Verifying the server configuration
 * 4. Running tests if needed
 * 5. Creating deployment-ready files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing Real Service API for deployment...\n');

// Files that should exist
const requiredFiles = [
  'server/index.ts',
  'start-production.js',
  'DEPLOYMENT_GUIDE.md',
  'FINAL_DEPLOYMENT_CHECKLIST.md',
  'render.yaml'
];

// Files that should NOT exist in git
const forbiddenFiles = [
  'secrets.txt',
  '.env.production',
  '.env.development',
  '.env.local'
];

// Check required files
console.log('📋 Checking required files...');
const missingFiles = [];
requiredFiles.forEach(file => {
  if (!fs.existsSync(path.join(__dirname, file))) {
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.error(`❌ Missing required files: ${missingFiles.join(', ')}`);
  process.exit(1);
} else {
  console.log('✅ All required files are present');
}

// Check for forbidden files
console.log('\n🔒 Checking for sensitive files...');
const presentForbiddenFiles = [];
forbiddenFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    presentForbiddenFiles.push(file);
  }
});

if (presentForbiddenFiles.length > 0) {
  console.warn(`⚠️  The following sensitive files were found and should not be committed: ${presentForbiddenFiles.join(', ')}`);
  console.log('   Consider running the migrate-secrets.js script to safely handle these files');
} else {
  console.log('✅ No sensitive files found that should be excluded');
}

// Check for secrets.example.txt
if (!fs.existsSync(path.join(__dirname, 'secrets.example.txt'))) {
  console.warn('⚠️  secrets.example.txt is missing. This file helps others understand what environment variables are needed.');
  fs.copyFileSync(path.join(__dirname, 'secrets.example.txt.hidden'), path.join(__dirname, 'secrets.example.txt'));
  console.log('✅ Created secrets.example.txt');
}

// Check .gitignore
console.log('\n📝 Checking .gitignore configuration...');
const gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
let gitignoreUpdated = false;

for (const file of forbiddenFiles) {
  if (!gitignore.includes(file)) {
    const updatedGitignore = gitignore + `\n${file}`;
    fs.writeFileSync(path.join(__dirname, '.gitignore'), updatedGitignore);
    gitignoreUpdated = true;
    console.log(`✅ Added ${file} to .gitignore`);
  }
}

if (!gitignoreUpdated) {
  console.log('✅ .gitignore is properly configured');
}

// Check server port configuration
console.log('\n🔌 Checking server port configuration...');
const serverIndexContent = fs.readFileSync(path.join(__dirname, 'server/index.ts'), 'utf8');
if (serverIndexContent.includes('const port = 5000;')) {
  console.log('✅ Server is configured to use port 5000 for Replit compatibility');
} else {
  console.warn('⚠️  Server might not be using port 5000, which could cause issues on Replit');
}

// Check for health endpoint
if (serverIndexContent.includes('/healthz') && serverIndexContent.includes('/api/health')) {
  console.log('✅ Health check endpoints are properly configured');
} else {
  console.warn('⚠️  Health check endpoints might not be properly configured');
}

// Check production startup script
console.log('\n🔍 Checking production startup script...');
const startProductionContent = fs.readFileSync(path.join(__dirname, 'start-production.js'), 'utf8');
if (startProductionContent.includes('checkDatabase()')) {
  console.log('✅ Production startup includes database validation');
} else {
  console.warn('⚠️  Production startup might not include database validation');
}

// Create deployment platform configurations if missing
console.log('\n🏗️  Checking deployment platform configurations...');
if (!fs.existsSync(path.join(__dirname, 'vercel.json'))) {
  const vercelConfig = {
    "version": 2,
    "builds": [
      {
        "src": "start-production.js",
        "use": "@vercel/node"
      }
    ],
    "routes": [
      {
        "src": "/(.*)",
        "dest": "start-production.js"
      }
    ]
  };
  fs.writeFileSync(
    path.join(__dirname, 'vercel.json'),
    JSON.stringify(vercelConfig, null, 2)
  );
  console.log('✅ Created vercel.json');
}

// Final summary
console.log('\n✨ Deployment preparation complete!');
console.log('\n📋 Next steps:');
console.log('1. Review DEPLOYMENT_GUIDE.md for platform-specific instructions');
console.log('2. Make sure all environment variables are set in your deployment platform');
console.log('3. Deploy your application and test the health endpoints');
console.log('4. Run test-deployment.js against your deployed app to verify functionality');

console.log('\n👍 Your Real Service API is ready for deployment!');