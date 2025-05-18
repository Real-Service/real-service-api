#!/bin/bash
# Custom build script for the application

echo "🚀 Starting build process..."

# Install dependencies if needed
if [ "$1" == "--install" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# Build the frontend with Vite
echo "🏗️ Building frontend with Vite..."
npx vite build

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npx tsc

echo "✅ Build completed successfully!"