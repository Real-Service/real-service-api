#!/usr/bin/env node
/**
 * Build script that compiles the server without Vite dependencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building server with direct TypeScript compilation (no Vite)...');

// Use TypeScript compiler directly to build server files
try {
  // Make sure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // Compile the TypeScript files
  execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
  
  console.log('TypeScript compilation successful');
  
  // Verify the output doesn't contain any Vite imports
  console.log('Checking for any remaining Vite references...');
  
  let viteFound = false;
  const checkFile = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('vite') || content.includes('Vite')) {
      console.log(`Found Vite reference in: ${filePath}`);
      viteFound = true;
    }
  };
  
  // Recursively check all JS files in dist
  const checkDir = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        checkDir(fullPath);
      } else if (file.endsWith('.js')) {
        checkFile(fullPath);
      }
    }
  };
  
  checkDir('./dist');
  
  if (!viteFound) {
    console.log('Success! No Vite references found in the compiled output.');
  } else {
    console.error('Warning: Vite references were found. Further cleanup may be needed.');
  }
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}