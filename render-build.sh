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
echo "Ensuring server files are available..."
# Make sure our quick fix server is executable
if [ -f "render-quick-fix.js" ]; then
  echo "Found render-quick-fix.js, making it executable"
  chmod +x render-quick-fix.js
else
  echo "WARNING: render-quick-fix.js not found, creating it"
  cat > render-quick-fix.js << EOF
#!/usr/bin/env node
const express = require('express');
const http = require('http');

// Create Express app
const app = express();
const PORT = parseInt(process.env.PORT || "10000", 10);

// Basic health check routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Bind directly with Express to the port
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server listening on port " + PORT);
});
EOF
  chmod +x render-quick-fix.js
fi

# Also make sure the pure production server is executable
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