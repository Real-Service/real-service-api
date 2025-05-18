#!/bin/bash
# Special build script for Render.com deployment
# This script skips Vite completely and only builds the server component

echo "🚀 Starting Render.com build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Directly build server without Vite
echo "🔨 Compiling server with esbuild only..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "✅ Build completed successfully!"