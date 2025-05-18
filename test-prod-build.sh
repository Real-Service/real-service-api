#!/bin/bash
# Test production build locally to verify it works without Vite

set -e

echo "🔨 Building production-ready server (no Vite)..."
mkdir -p dist
npx esbuild server/server-prod.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

echo "✅ Build completed. Starting server in production mode..."
NODE_ENV=production node dist/index.js