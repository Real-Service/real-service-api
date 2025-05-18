#!/bin/bash
# Special build script for Render.com deployment that completely bypasses Vite
# by temporarily modifying package.json during the build process

set -e

echo "🚀 Starting Render.com build process (no Vite)..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Create temporary package.json with ONLY esbuild (no Vite)
echo "📝 Creating temporary package.json without Vite..."
# Using node instead of jq for better compatibility
node -e "
  const fs = require('fs');
  const pkg = require('./package.json');
  pkg.scripts.build = 'esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  console.log('Updated package.json build script to:', pkg.scripts.build);
"

# Run build script (now without Vite)
echo "🔨 Building server code with modified package.json..."
npm run build

echo "✅ Build completed successfully without using Vite!"