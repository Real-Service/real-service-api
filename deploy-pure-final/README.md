# Real Service API - Production Deployment

This is a standalone production deployment package for the Real Service API that doesn't rely on Vite or other development dependencies.

## Deployment Instructions

### Option 1: Deploy to Render.com

1. Create a new repository with these files:
   - `index.js`
   - `package.json`
   - `render.yaml`

2. Connect to Render.com and use the Blueprint deployment option, pointing to your repository.

3. Render will automatically set up the web service and database based on the `render.yaml` configuration.

4. Make sure to configure your environment variables, especially `DATABASE_URL`.

### Option 2: Deploy to Any Node.js Host

1. Copy these files to your server:
   - `index.js`
   - `package.json`

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `PORT` - Port to run the server on (defaults to 10000)
   - `NODE_ENV` - Set to "production"

4. Start the server:
   ```
   node index.js
   ```

## Features

- Minimal pure JavaScript implementation
- No TypeScript or Vite dependencies
- Database connection with proper error handling
- Health check endpoint at `/healthz`
- API status endpoint at `/api/status`
- Database test endpoint at `/api/database/test`
- Direct login test endpoint at `/api/direct-login`
- Static file serving from the `public` directory

## Testing

You can test the API once deployed by visiting:

- `/healthz` - Should return a 200 OK with server and database status
- `/api/status` - Should return basic API status information
- `/api/database/test` - Should return database connection status

## Troubleshooting

If you encounter any issues:

1. Check your database connection string
2. Ensure the PostgreSQL database is accessible from your server
3. Check the server logs for any specific error messages
4. Verify all environment variables are correctly set