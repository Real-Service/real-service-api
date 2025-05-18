# Real Service API Deployment Guide

This guide explains how to deploy the Real Service API to production using the configuration files and secrets provided.

## Files Provided

- **secrets.txt**: Contains all environment variables and secrets
- **render.yaml.production**: Render deployment configuration
- **.env.production.updated**: Updated environment file for production

## Deployment to Render

### Option 1: Using the Dashboard (Recommended)

1. Log in to your [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - Name: real-service-api
   - Environment: Node.js
   - Build Command: `npm ci`
   - Start Command: `node start-production.js`
5. Add Environment Variables:
   - Copy all variables from `secrets.txt` or `.env.production.updated`
   - Add each as a key-value pair in the Render dashboard
6. Click "Create Web Service"

### Option 2: Using Blueprint (render.yaml)

1. Rename `render.yaml.production` to `render.yaml`
2. Add it to your repository
3. Push to GitHub
4. Go to [Render Dashboard](https://dashboard.render.com/blueprints)
5. Click "New Blueprint Instance"
6. Select your repository
7. Render will automatically configure and deploy your service

## Deployment to Vercel

1. Sign in to [Vercel](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure the project:
   - Framework Preset: Other
   - Build Command: `npm ci`
   - Output Directory: (leave blank)
   - Install Command: `npm install`
   - Development Command: (leave blank)
5. Add Environment Variables:
   - Copy all variables from `secrets.txt` or `.env.production.updated`
   - Add each as a key-value pair in the Vercel dashboard
6. Click "Deploy"

## Important Configuration Notes

### Database Connection

The database connection is configured to use Neon Postgres:
```
DATABASE_URL=postgresql://neondb_owner:npg_7hyG1JwXWmhm@ep-crimson-dust-a6smdy25.us-west-2.aws.neon.tech/neondb?sslmode=require
```

### CORS Configuration

The CORS configuration is set up to allow requests from the Replit frontend:
```
CORS_ORIGIN=https://real-service-team9-01-teamleader2000.replit.app
FRONTEND_URL=https://real-service-team9-01-teamleader2000.replit.app
```

If you deploy the frontend elsewhere, update these values.

### Mapbox Token

The Mapbox token is configured for maps functionality:
```
VITE_MAPBOX_TOKEN=pk.eyJ1IjoiZHJuewYzdXlzIjoidCI6MTUiOiJjaXJtNWlkcWIwMDB9LnF5bnhSTVBLMFtYWm1IQ18wbmE
```

## Testing the Deployment

After deployment, test these endpoints:

1. **Health Check**: `https://your-service.onrender.com/api/health`
2. **Authentication**: `https://your-service.onrender.com/api/login` (POST request)

## Troubleshooting

- **Database Connection Issues**: Ensure the DATABASE_URL is correctly set
- **CORS Errors**: Check CORS_ORIGIN matches your frontend URL
- **Authentication Failures**: Verify SESSION_SECRET and COOKIE_SECRET are set

## Security Notes

- Revoke and replace the GitHub PAT after use
- Never commit `.env` files directly to your repository
- Use Render's secret environment variables feature for sensitive data