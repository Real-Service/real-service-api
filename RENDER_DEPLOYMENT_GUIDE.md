# Render.com Deployment Guide

This guide explains how to deploy the Real Service API to Render.com with our build configuration changes.

## What's Happening

Render.com ignores our `render.yaml` file because the service was initially created through Render's UI. When a service is created manually, Render defaults to using the scripts in `package.json`.

## How to Fix It

Since we can't modify the package.json file directly, and Render is ignoring our render.yaml file, we need to reconfigure the deployment settings in Render's dashboard:

1. Go to your Render.com dashboard
2. Select the `real-service-api` service
3. Click "Settings"
4. Scroll down to the "Build & Deploy" section

## Update These Settings

Change the following settings:

### Build Command
Instead of the default `npm run build`, use:
```
./build.js
```

### Start Command
Keep the existing:
```
node dist/index.js
```

## Important Environment Variables

Make sure the following environment variables are set:

- `NODE_ENV`: `production`
- `PORT`: `5000`
- `DATABASE_URL`: Your Neon database URL
- Any other required environment variables (Stripe, etc.)

## Testing After Deployment

After deploying:

1. Check the build logs to ensure Vite is no longer being called
2. Verify the application is running by visiting the Render URL
3. Test critical API endpoints to confirm functionality

## Troubleshooting

If issues persist:

1. Try creating a new service in Render using the YAML deploy method (not manual UI)
2. Upload the render.yaml file to the root of your repository first
3. Then use Render's "Blueprint" deployment option when creating a new service