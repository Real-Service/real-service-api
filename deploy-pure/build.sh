#!/bin/bash
# Simple build script for deployment

# Ensure we have the right directory structure
mkdir -p dist
mkdir -p public

# Copy our main app file into the dist directory
cp app.js dist/index.js

# Install dependencies
npm install

echo "Build completed successfully!"