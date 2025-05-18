#!/bin/bash
# Deploy script that creates a completely isolated production build
# This script ensures NO Vite dependencies are present in the final deployment

# Set strict error handling
set -e

echo "Starting deployment process..."

# Create a fresh directory for our production build
rm -rf ./deploy
mkdir -p ./deploy/public

# Copy our standalone server file
cp ./server.js ./deploy/

# Copy any static assets (assuming they're in client/dist)
if [ -d "./client/dist" ]; then
  echo "Copying client assets..."
  cp -r ./client/dist/* ./deploy/public/
else
  echo "No client build found, deploying server only"
  # Create a minimal index.html
  echo "<html><body><h1>Server Running</h1><p>API is available at /api/*</p></body></html>" > ./deploy/public/index.html
fi

# Create a minimalist package.json with only what we need
cat > ./deploy/package.json << EOF
{
  "name": "real-service-production",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "engines": {
    "node": "20.x"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "ws": "^8.14.2"
  },
  "scripts": {
    "start": "NODE_ENV=production node server.js"
  }
}
EOF

echo "Deployment package prepared successfully."
echo "To run the production server:"
echo "cd deploy && npm install && npm start"