#!/bin/bash
# Server-only build script for production deployment
# This script deliberately avoids compiling any client files that might depend on Vite

echo "Starting server-only build process..."

# Create dist directory
mkdir -p dist/server

# Compile only server files using tsc
echo "Compiling server TypeScript files..."
npx tsc --project tsconfig.server.json

# Create a minimal tsconfig for server files only
cat > tsconfig.server.json << EOF
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "."
  },
  "include": [
    "server/**/*.ts",
    "shared/**/*.ts"
  ],
  "exclude": [
    "client/**/*"
  ]
}
EOF

# Compile server code with server-specific tsconfig
npx tsc --project tsconfig.server.json

echo "Creating public directory for static assets..."
mkdir -p public

# Create a minimal index.html file (just in case)
cat > public/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>API Server</title>
  <style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:0 1rem}</style>
</head>
<body>
  <h1>Real Service API</h1>
  <p>The server is running in production mode.</p>
</body>
</html>
EOF

# Check for any Vite references
if grep -r "vite" dist/server; then
  echo "WARNING: Vite references found in server build!"
else
  echo "SUCCESS: Server build is clean (no Vite references)"
fi

echo "Server build completed!"