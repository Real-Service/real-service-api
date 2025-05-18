#!/bin/bash
# Deployment script for Real Service API

# Stop on errors
set -e

echo "🚀 Starting deployment process..."

# Use our custom build script
echo "📦 Building application..."
./build.sh

# Run the application
echo "🌐 Starting server..."
NODE_ENV=production node dist/index.js