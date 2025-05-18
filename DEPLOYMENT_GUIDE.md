# Deployment Guide for Real Service API

This guide outlines the deployment process for the Real Service API using Render.com or similar cloud platforms.

## Prerequisites

- GitHub account with access to the repository
- Render.com account (or similar cloud platform)
- PostgreSQL database (Neon Database recommended)
- Required environment variables (see below)

## Environment Variables

Ensure these environment variables are set in your deployment platform:

```
NODE_ENV=production
PORT=5000
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_session_secret
CORS_ORIGIN=https://your-frontend-domain.com
```

## Deployment Steps

### Option 1: Render.com Deployment

1. Connect your GitHub repository to Render.com
2. Create a new Web Service
3. Select your repository
4. Configure the service:
   - Name: `real-service-api`
   - Environment: `Node`
   - Build Command: `./build.sh --install`
   - Start Command: `node dist/index.js`
   - Add all required environment variables

### Option 2: Dockerfile Deployment

If deploying to a container platform:

1. Build the Docker image:
   ```bash
   docker build -t real-service-api .
   ```

2. Run the container:
   ```bash
   docker run -p 5000:5000 --env-file .env.production real-service-api
   ```

## Troubleshooting

### Connection Issues

If you experience database connection issues:

1. Verify your `DATABASE_URL` is correct and accessible from your deployment environment
2. Check database SSL settings - Neon requires SSL with `rejectUnauthorized: false`
3. Ensure your IP address is allowed in database firewall settings

### Build Failures

If the build process fails:

1. Check the build logs for specific errors
2. Ensure all dependencies are correctly listed in `package.json`
3. Verify the build script has execute permissions with `chmod +x build.sh`

## Health Check Endpoint

The API provides health check endpoints at:
- `/healthz` - Primary health check for Render.com
- `/health` - Alternative health check
- `/api/health` - API-specific health check

These endpoints return status information about the application, including database connectivity.