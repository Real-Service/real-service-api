#!/bin/bash
# Special build script for Render.com deployment
# This script COMPLETELY skips Vite and ONLY builds the server with esbuild

echo "🚀 Starting Render.com build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# DIRECT BUILD APPROACH: NO VITE INVOLVED
echo "🔨 Compiling server ONLY with esbuild..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Create empty client directory - avoid Vite completely
echo "📁 Creating client directory structure..."
mkdir -p dist/client/assets

# Create an empty file to ensure the directories exist (Render might need this)
touch dist/client/assets/.gitkeep

echo "✅ Build completed successfully without Vite!"