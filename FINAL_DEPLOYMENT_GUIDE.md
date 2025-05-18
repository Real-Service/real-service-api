# Deployment Guide for Real Service API

This guide provides step-by-step instructions for deploying the Real Service API to Render.com.

## Deployment Steps

### 1. Fix the File Path Issue

The main issue we identified is that Render expects the main server file at `dist/index.js` but our TypeScript compiles it to `dist/server/index.js`. We've implemented two reliable solutions:

#### Solution A: Updated Build Script

We've updated the `render-build.sh` script to automatically create a reference from `dist/index.js` to `dist/server/index.js`. This means you can use the default start command on Render.

#### Solution B: Updated Start Command

Alternatively, you can modify the start command in Render to specifically point to the correct file:

```
node dist/server/index.js
```

### 2. Deploy to Render.com

1. **Create a New Web Service**
   - Log in to your Render.com account
   - Click "New +" and select "Web Service"
   - Connect your GitHub repository

2. **Configure the Web Service**
   - Name: `real-service-api` (or your preferred name)
   - Environment: `Node`
   - Build Command: `./render-build.sh`
   - Start Command: `node dist/index.js` (or `node dist/server/index.js` if using Solution B)
   - Instance Type: Select appropriate option for your needs (starter is fine for testing)

3. **Set Environment Variables**
   - Add the following environment variables:
     - `NODE_ENV`: `production`
     - `DATABASE_URL`: Your Neon PostgreSQL connection string
     - Other required secrets for your app

4. **Advanced Options**
   - Health Check Path: `/healthz`
   - Auto-Deploy: Enable if you want automatic deployments on new commits

### 3. Configure Database Connection

Since you're using Neon PostgreSQL, make sure your database connection is properly set up:

1. Ensure your `DATABASE_URL` environment variable is correctly set
2. Your database should use `snake_case` column names (already implemented)
3. No special configuration is needed for WebSockets with Neon

### 4. Verify Deployment

After deployment completes:

1. Visit your app URL to verify the server is running
2. Check the `/healthz` endpoint for server status
3. Check the `/api/status` endpoint for detailed API status
4. Test the `/api/database/test` endpoint to verify database connectivity

## Alternative Standalone Deployment

If you continue to have issues with the TypeScript compilation, we've created a pure JavaScript standalone deployment package in the `deploy-pure-final` directory:

1. Create a new GitHub repository with just these files:
   - `index.js`
   - `package.json`
   - `render.yaml`

2. Use Render's Blueprint feature to deploy directly from this repository.

## Troubleshooting

- **File Not Found Errors**: Check the build logs to see if the TypeScript compilation was successful
- **Database Connection Issues**: Verify your DATABASE_URL is correct and accessible from Render
- **Build Failures**: Make sure your dependencies are correctly listed in package.json
- **Runtime Errors**: Check the Render logs for detailed error messages

## Going Forward

As you continue development:

- Always test builds locally before pushing to production
- Consider setting up a staging environment for testing
- Update your render-build.sh script if your build process changes