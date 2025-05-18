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

# Skip any attempt to run the compiled server
echo "Skipping default server startup approach..."
echo "// This file is deliberately empty to prevent the default server from running" > dist/index.js 2>/dev/null || true

echo "Build completed successfully!"