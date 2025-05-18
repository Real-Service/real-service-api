#!/bin/bash
# Script to build only the server part of the application for deployment
# This eliminates Vite dependencies when deploying to production

echo "Building server-only for production deployment..."

# First compile TypeScript using our server-specific config
echo "Compiling TypeScript..."
npx tsc -p tsconfig.server.json

# Check if the compilation was successful
if [ $? -eq 0 ]; then
    echo "Server compilation successful"
    echo "Output files location: ./dist/index.js"
    
    # Add extra step to verify the file exists
    if [ -f "./dist/index.js" ]; then
        echo "✅ Main server file exists at the expected location"
    else
        echo "❌ Warning: Main server file not found at ./dist/index.js"
        
        # Check if it's in the server subdirectory
        if [ -f "./dist/server/index.js" ]; then
            echo "Found file at ./dist/server/index.js"
            echo "Creating symlink..."
            ln -sf ./server/index.js ./dist/index.js
            echo "✅ Symlink created successfully"
        fi
    fi
else
    echo "❌ Server compilation failed"
    exit 1
fi

echo "Server ready for deployment!"