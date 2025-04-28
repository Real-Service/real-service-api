/**
 * Deployment Environment Variable Checker
 * 
 * This script checks if all required environment variables for production deployment
 * are set and reports any missing variables.
 */

require('dotenv').config({ path: '.env.production' });

const REQUIRED_VARIABLES = [
  // Database Configuration
  'DATABASE_URL',
  'PGHOST',
  'PGUSER',
  'PGPASSWORD',
  'PGPORT',
  'PGDATABASE',
  
  // Security & Authentication
  'SESSION_SECRET',
  'COOKIE_SECRET',
  
  // Application Configuration
  'NODE_ENV',
  'PORT',
  
  // CORS & Frontend Configuration
  'CORS_ORIGIN',
  'FRONTEND_URL',
  
  // Map Integration
  'VITE_MAPBOX_TOKEN',
];

// Optional but recommended variables
const RECOMMENDED_VARIABLES = [
  'LOG_LEVEL',
  'SESSION_LIFETIME',
  'MAX_UPLOAD_SIZE',
  'ENABLE_WEBSOCKETS',
];

console.log('🔍 Checking deployment environment variables...\n');

// Check required variables
const missingRequired = [];
const presentRequired = [];

REQUIRED_VARIABLES.forEach(varName => {
  if (!process.env[varName]) {
    missingRequired.push(varName);
  } else {
    presentRequired.push(varName);
  }
});

// Check recommended variables
const missingRecommended = [];
const presentRecommended = [];

RECOMMENDED_VARIABLES.forEach(varName => {
  if (!process.env[varName]) {
    missingRecommended.push(varName);
  } else {
    presentRecommended.push(varName);
  }
});

// Print results
console.log('✅ Required variables present:');
if (presentRequired.length > 0) {
  presentRequired.forEach(varName => {
    const value = varName.toLowerCase().includes('secret') || varName.toLowerCase().includes('password')
      ? '********' // Mask secrets and passwords
      : process.env[varName];
    console.log(`   ${varName}: ${value}`);
  });
} else {
  console.log('   None');
}

console.log('\n❌ Required variables missing:');
if (missingRequired.length > 0) {
  missingRequired.forEach(varName => {
    console.log(`   ${varName}`);
  });
} else {
  console.log('   None - all required variables are set! 🎉');
}

console.log('\n✅ Recommended variables present:');
if (presentRecommended.length > 0) {
  presentRecommended.forEach(varName => {
    console.log(`   ${varName}: ${process.env[varName]}`);
  });
} else {
  console.log('   None');
}

console.log('\n⚠️ Recommended variables missing:');
if (missingRecommended.length > 0) {
  missingRecommended.forEach(varName => {
    console.log(`   ${varName}`);
  });
} else {
  console.log('   None - all recommended variables are set! 🎉');
}

console.log('\n📝 Summary:');
console.log(`   Required: ${presentRequired.length}/${REQUIRED_VARIABLES.length} variables set`);
console.log(`   Recommended: ${presentRecommended.length}/${RECOMMENDED_VARIABLES.length} variables set`);

// Exit with error code if any required variables are missing
if (missingRequired.length > 0) {
  console.log('\n❌ Deployment check failed: Missing required environment variables');
  process.exit(1);
} else {
  console.log('\n✅ Deployment check passed: All required environment variables are set');
  process.exit(0);
}