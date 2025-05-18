#!/bin/bash
# Deployment script for Real Service API

# Stop on errors
set -e

echo "🚀 Starting deployment process..."

# Build the client
echo "📦 Building client application..."
npm run build

# Ensure TypeScript compilation
echo "🔧 Compiling TypeScript..."
npx tsc

# Create a dist/server directory if it doesn't exist
mkdir -p dist/server

# Move server files if needed
if [ ! -f "dist/server/index.js" ]; then
  echo "📂 Copying server files to dist/server..."
  cp -r dist/index.js dist/server/ 2>/dev/null || :
fi

# Run the application
echo "🌐 Starting server..."
NODE_ENV=production node dist/server/index.js