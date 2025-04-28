# Production Deployment Guide for Real Service API

This guide explains how to deploy the Real Service API backend separately from the frontend to fix login and authentication issues.

## Prerequisites

Before you begin, make sure you have:
- Access to a Render, Railway, Fly.io, or Vercel account
- Access to the Neon Database credentials 
- A Replit account where the frontend is hosted
- Git installed on your local machine (if deploying from your computer)

## Step 1: Get the Backend Code Ready

1. The backend code is already prepared for deployment with the following files:
   - `.env.production` - Contains production environment variables
   - `start-production.js` - Script to start the server in production
   - `vercel.json` - Configuration for Vercel deployment
   - `render.yaml` - Configuration for Render deployment

2. Make sure you have updated the CORS settings in `.env.production` to match your Replit frontend URL:
   ```
   CORS_ORIGIN=https://your-replit-app-name.replit.app
   ```

## Step 2: Choose a Deployment Platform

Choose one of the following platforms:

### Option A: Deploy to Render

1. Create a new account at [render.com](https://render.com) if you don't have one
2. Create a new Web Service
3. Connect to your GitHub repository or upload the code directly
4. Set the following:
   - Name: `real-service-api`
   - Build Command: `npm install`
   - Start Command: `node start-production.js`
5. Add the following environment variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - `SESSION_SECRET`: Generate a random string or use the one in .env.production
   - `CORS_ORIGIN`: Your Replit frontend URL

### Option B: Deploy to Vercel

1. Create a new account at [vercel.com](https://vercel.com) if you don't have one
2. Install the Vercel CLI: `npm i -g vercel`
3. Navigate to your project directory
4. Run `vercel login` and follow the authentication steps
5. Run `vercel` and follow the prompts
6. Add the same environment variables as listed in the Render section through the Vercel dashboard

### Option C: Deploy to Railway

1. Create a new account at [railway.app](https://railway.app) if you don't have one
2. Create a new project
3. Connect to your GitHub repository
4. Add the same environment variables as listed in the Render section
5. Deploy the application

## Step 3: Update Frontend Configuration

After deploying your backend, you'll need to update the frontend to use the deployed API:

1. Update the `client/.env.production` file:
   ```
   VITE_API_BASE_URL=https://your-backend-api-url.onrender.com
   VITE_API_URL=https://your-backend-api-url.onrender.com/api
   VITE_WEBSOCKET_URL=wss://your-backend-api-url.onrender.com/api/chat-ws
   VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN}
   ```

2. Make sure the CORS configuration in your backend `.env.production` matches your frontend domain:
   ```
   CORS_ORIGIN=https://real-service-team9-01-teamleader2000.replit.app
   ```

## Step 4: Verify the Deployment

1. Test the API endpoint by visiting:
   ```
   https://your-backend-api-url.onrender.com/api/health
   ```
   You should see a JSON response indicating the API is up and running.

2. Test your frontend by logging in - the requests should now go to your deployed backend.

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure your `CORS_ORIGIN` in the backend matches exactly with the frontend URL.

2. **Connection Issues**: Verify that the `DATABASE_URL` is correct and accessible from your deployment platform.

3. **WebSocket Errors**: Make sure the WebSocket URL uses `wss://` protocol for secure connections.

4. **Authentication Failures**: Check if cookies are being set correctly by looking at the request/response headers.

### Debug Steps

1. Check server logs on your deployment platform
2. Monitor network requests in the browser's developer tools
3. Verify environment variables are set correctly
4. Test API endpoints directly using curl or Postman

## Security Considerations

1. Keep your `SESSION_SECRET` secure and don't reuse it across different environments
2. Ensure your database connection uses SSL (`sslmode=require`)
3. Set proper CORS headers to only allow access from your frontend domain
4. Use HTTPS for all connections in production