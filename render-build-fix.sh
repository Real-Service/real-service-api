#!/bin/bash
# Build script for Render.com deployment
# This script creates a symlink from dist/index.js to dist/server/index.js

echo "Starting build process..."

# Run the normal build process
npm ci && npm run build

# Create the symlink to fix the path issue
echo "Creating symlink from dist/index.js to dist/server/index.js..."
mkdir -p dist
ln -sf dist/server/index.js dist/index.js

echo "Build completed successfully!"