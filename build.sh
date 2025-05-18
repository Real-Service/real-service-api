#!/bin/bash
# Custom build script for the application

echo "🚀 Starting build process..."

# Install dependencies if needed
if [ "$1" == "--install" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# Skip Vite build entirely and only run esbuild for server code
echo "🔨 Compiling server with esbuild..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Ensure we have a dist directory and client assets directory
mkdir -p dist/client

echo "✅ Build completed successfully!"