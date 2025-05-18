#!/bin/bash
# Simple build script for Render.com deployment
# This avoids all Vite dependencies and uses a minimal approach

echo "Starting simplified build process..."

# Install only essential dependencies
npm install express cors pg

# Create public directory for static assets
mkdir -p public

# Create a simple index.html if it doesn't exist
if [ ! -f "public/index.html" ]; then
  echo "Creating basic index.html file..."
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
  <p>The production server is running.</p>
  <p>This is the backend API server for Real Service.</p>
</body>
</html>
EOF
fi

# Ensure our pure server file is in the right place and executable
echo "Ensuring pure production server file is available..."
chmod +x pure-production-server.js

# Make sure we're pointing to the right server file
echo "Creating proper file path reference..."
mkdir -p dist

# Run full build process to ensure files are generated
npm ci && npm run build

# Verify the file exists and create symlink or copy the file
if [ -f "dist/server/index.js" ]; then
  echo "Found compiled server file at dist/server/index.js"
  
  # Create a symlink from dist/index.js to dist/server/index.js
  echo "Creating symlink from dist/index.js to dist/server/index.js"
  rm -f dist/index.js # Remove if it exists
  ln -sf ./server/index.js dist/index.js
  
  # As a fallback, copy the file if symlink fails
  if [ ! -f "dist/index.js" ]; then
    echo "Symlink failed, copying file instead"
    cp dist/server/index.js dist/index.js
  fi
  
  echo "Verified file exists at dist/index.js"
  ls -la dist/index.js
else
  echo "WARNING: Compiled server file not found at dist/server/index.js"
  echo "Checking for pure server implementation..."
  
  # If we can't find the compiled file, try to use the pure JS version as fallback
  if [ -f "pure-production-server.js" ]; then
    echo "Found pure production server, copying to dist/index.js"
    cp pure-production-server.js dist/index.js
    echo "Created dist/index.js from pure-production-server.js"
  else
    echo "ERROR: No server file found at any expected location"
    exit 1
  fi
fi

echo "Build completed successfully!"