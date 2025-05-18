#!/bin/bash
# Custom build script for the application

echo "🚀 Starting build process..."

# Install dependencies if needed
if [ "$1" == "--install" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# Build the backend with esbuild only
echo "🔨 Compiling server with esbuild..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "✅ Build completed successfully!"