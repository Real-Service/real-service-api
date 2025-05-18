# Cloud Deployment Guide for Real Service API

This guide provides specific instructions for deploying your Real Service application to various cloud platforms.

## Prerequisites

Before deploying, ensure you have:

1. Completed the `clean-secrets.js` script to remove any sensitive information
2. Created proper environment variable templates with `.env.example` 
3. Prepared your database for production use
4. Run `npm run build` locally to verify the build works

## Deployment Options

### 1. Render.com (Recommended)

Render.com offers the simplest deployment experience with built-in PostgreSQL database support.

#### Steps:

1. Sign up or log in to [Render.com](https://render.com)
2. Select "Blueprint" from the dashboard and connect your GitHub repository
3. Import the `render.yaml` file from this repository
4. Configure environment variables:
   - `VITE_MAPBOX_TOKEN`: Your Mapbox API key
   - Any other secrets not defined in `render.yaml`
5. Click "Apply" to deploy both web service and database

#### Alternative Manual Setup:

1. Create a new PostgreSQL database in Render
2. Create a new Web Service:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm run start`
   - Environment: Node.js
   - Set environment variables including DATABASE_URL from your Render database

### 2. Railway.app

Railway offers easy deployment with Git-based workflows.

#### Steps:

1. Create a new project in Railway
2. Connect your GitHub repository
3. Add a PostgreSQL database to your project
4. Configure the deployment:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm run start`
5. Set environment variables:
   - `DATABASE_URL` (from Railway's PostgreSQL service)
   - `PORT`: 5000
   - `NODE_ENV`: production
   - `SESSION_SECRET`: (generate a secure random string)
   - `VITE_MAPBOX_TOKEN`: Your Mapbox API key

### 3. Fly.io

Fly.io provides global distribution with edge deployment.

#### Steps:

1. Install Flyctl: `curl -L https://fly.io/install.sh | sh`
2. Log in: `flyctl auth login`
3. Launch your app: `flyctl launch`
   - This will generate a `fly.toml` file
4. Configure the Dockerfile included in this repository
5. Create a Postgres database: `flyctl postgres create`
6. Set secrets:
   ```
   flyctl secrets set DATABASE_URL=postgres://username:password@hostname:port/database_name
   flyctl secrets set SESSION_SECRET=your_secure_random_string
   flyctl secrets set VITE_MAPBOX_TOKEN=your_mapbox_token
   ```
7. Deploy: `flyctl deploy`

### 4. Vercel

For Vercel deployment, we can use the included `vercel.json` configuration file.

#### Steps:

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` from the project root to configure your deployment
3. Set environment variables in the Vercel dashboard:
   - `DATABASE_URL` (pointing to your production database)
   - `NODE_ENV`: production
   - `SESSION_SECRET`: (generate a secure random string)
   - `VITE_MAPBOX_TOKEN`: Your Mapbox API key
4. Deploy with: `vercel --prod`

## Post-Deployment Verification

After deploying, verify your application is working correctly:

1. Access the deployed URL and check that the application loads
2. Test authentication functionality
3. Verify database connectivity via the `/health` endpoint
4. Check that environment variables are working properly

## Troubleshooting

### Common Issues:

1. **Database Connection Errors**: Verify your `DATABASE_URL` format and ensure network access is permitted

2. **Missing Environment Variables**: Check that all required variables are set in your deployment platform

3. **Build Errors**: Try running the build locally first to identify any issues

4. **Port Conflicts**: Ensure the port specified in your deployment matches what the application expects (5000)