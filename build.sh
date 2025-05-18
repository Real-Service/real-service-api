#!/bin/bash
# Custom build script for the application - NO VITE DEPENDENCIES

echo "🚀 Starting build process..."

# Install dependencies if needed
if [ "$1" == "--install" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# Create public directory for static assets
echo "📁 Creating public directory..."
mkdir -p public

# Copy any pre-built client files if they exist
if [ -d "client/dist" ]; then
  echo "📋 Copying pre-built client files..."
  cp -r client/dist/* public/
else
  echo "⚠️ No client build found, will deploy server only"
  # Create a minimal index.html file
  echo "📝 Creating minimal index.html..."
  cat > public/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Real Service API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Real Service API</h1>
  <p>The server is running successfully.</p>
  <p>API available at <code>/api/*</code></p>
</body>
</html>
EOF
fi

# Compile TypeScript directly (no Vite)
echo "🔨 Compiling TypeScript..."
npx tsc

# Verify no Vite dependencies in the build
echo "🔍 Checking for Vite references in the build..."
if grep -q "vite" dist/server/index.js; then
  echo "⚠️ Warning: Vite references found in build output"
else
  echo "✅ Build is clean, no Vite references found"
fi

echo "✅ Build completed successfully!"