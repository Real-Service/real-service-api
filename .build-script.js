// Pre-build script for Real Service API
// This creates a production-ready build without using Vite

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

console.log(`${colors.bright}${colors.blue}Real Service API - Production Build Script${colors.reset}\n`);

// Create dist directory if it doesn't exist
if (!fs.existsSync('./dist')) {
  console.log(`${colors.yellow}Creating dist directory...${colors.reset}`);
  fs.mkdirSync('./dist', { recursive: true });
}

// Build the server using esbuild directly
try {
  console.log(`${colors.yellow}Building server with esbuild...${colors.reset}`);
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
    stdio: 'inherit'
  });
  console.log(`${colors.green}Server build successful!${colors.reset}`);
} catch (error) {
  console.error(`${colors.magenta}Server build failed:${colors.reset}`, error);
  process.exit(1);
}

// Create a production package.json
console.log(`${colors.yellow}Creating production package.json...${colors.reset}`);
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// Create a simplified version for production
const productionPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  type: packageJson.type,
  description: "Real Service API Production Build",
  main: "dist/index.js",
  engines: {
    node: ">=18.0.0"
  },
  scripts: {
    start: "NODE_ENV=production node dist/index.js"
  },
  dependencies: packageJson.dependencies
};

// Write the production package.json
fs.writeFileSync('./dist/package.json', JSON.stringify(productionPackageJson, null, 2));
console.log(`${colors.green}Production package.json created!${colors.reset}`);

// Create a simplified render.yaml in the dist folder
console.log(`${colors.yellow}Creating production render.yaml...${colors.reset}`);
const renderYaml = `
# Real Service API - Render.com Deployment Configuration
services:
  # Main API server
  - type: web
    name: real-service-api
    env: node
    buildCommand: npm ci
    startCommand: npm start
    healthCheckPath: /healthz
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5000
      - key: DATABASE_URL
        fromDatabase:
          name: real-service-db
          property: connectionString
`;

fs.writeFileSync('./dist/render.yaml', renderYaml);
console.log(`${colors.green}Production render.yaml created!${colors.reset}`);

// Instructions for deployment
console.log(`\n${colors.bright}${colors.green}Build completed successfully!${colors.reset}`);
console.log(`\n${colors.yellow}To deploy to Render.com:${colors.reset}`);
console.log(`1. Upload the contents of the ${colors.bright}dist${colors.reset} folder to your repository`);
console.log(`2. Configure Render.com to deploy from this repository`);
console.log(`3. Ensure all environment variables are set in the Render.com dashboard\n`);