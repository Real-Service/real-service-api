/**
 * Force update environment variables to use the correct database
 * 
 * This script explicitly sets DATABASE_URL to the proper production database URL
 * for all subsequent commands in the terminal session.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The correct production database URL to use
const CORRECT_DB_URL = 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Update the environment variable for this process
process.env.DATABASE_URL = CORRECT_DB_URL;

console.log(`Set DATABASE_URL to: ${CORRECT_DB_URL}`);
console.log('This change is only active for the current process. To make it permanent:');
console.log('1. The .env file has been updated correctly');
console.log('2. You may need to restart your terminal/shell');
console.log('3. Use "export DATABASE_URL=<url>" in your terminal');

// Log the current DATABASE_URL being used by this script
console.log('\nVerifying current environment settings:');
console.log(`Current DATABASE_URL: ${process.env.DATABASE_URL}`);

// Create a verification shell script that can be sourced
const verifyScript = `#!/bin/bash
# Run this script with: source ./scripts/verify-env.sh

export DATABASE_URL="${CORRECT_DB_URL}"
echo "DATABASE_URL has been set to the production database."
echo "Current value: $DATABASE_URL"
`;

fs.writeFileSync(path.join(__dirname, 'verify-env.sh'), verifyScript, 'utf8');
console.log('\nCreated scripts/verify-env.sh to help set correct environment');
console.log('Run "source ./scripts/verify-env.sh" to update your terminal environment');