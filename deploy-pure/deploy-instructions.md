# Deployment Instructions for Real-Service API

These instructions provide a step-by-step guide to deploy the standalone production server for Real Service API to Render.com without any Vite dependencies.

## Prerequisites

1. A Render.com account
2. Your database connection string (from Neon or another PostgreSQL provider)

## Deployment Steps

### Step 1: Create a New Git Repository

1. Create a new Git repository for deployment (separate from your development repository)
2. Copy ONLY the following files from the `deploy-pure` directory to your new repository:
   - `index.js`
   - `package.json`
   - `render.yaml`

### Step 2: Set Up Your Repository on Render.com

1. Log in to your Render.com dashboard
2. Click "New" and select "Blueprint" from the dropdown
3. Connect your GitHub account and select the repository you created in Step 1
4. Render will automatically detect the `render.yaml` file and set up the services

### Step 3: Configure Environment Variables

1. After the initial deployment is created, go to the "Environment" tab for your web service
2. Add the `DATABASE_URL` environment variable with your database connection string
3. Add any other necessary environment variables (e.g., `STRIPE_SECRET_KEY`, etc.)

### Step 4: Deploy

1. Click "Manual Deploy" and select "Deploy latest commit"
2. Wait for the deployment to complete
3. Check the logs to ensure everything is working correctly
4. Once deployed, your API will be available at the URL provided by Render

## Troubleshooting

If you encounter any issues with the deployment:

1. Check the deployment logs for specific error messages
2. Verify your environment variables are correctly set
3. Ensure your database is accessible from Render's servers
4. Check that your database schema is properly set up

## Production Ready Checks

- [ ] Health check endpoint returns 200 OK
- [ ] Database connection is successful
- [ ] API returns expected responses for basic endpoints
- [ ] Logs show no critical errors

## Notes

This deployment approach completely avoids using Vite dependencies, which removes the "Cannot find package 'vite'" error that occurs with TypeScript-based deployments. The standalone server provides only the essential API endpoints needed for your application.