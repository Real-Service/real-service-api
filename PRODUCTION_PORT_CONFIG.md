# Port Configuration for Production Deployment

## Important Notes About Port Configuration

When deploying the Real Service API to production, it's important to understand how port configuration works across different environments.

## Local Development (Replit)

- In Replit, the application is configured to run on port `5000` regardless of environment variables
- This is hard-coded in `server/index.ts` to match Replit's workflow settings
- This ensures the application works correctly in the Replit environment

## Production Deployment

For production deployments on platforms like Render.com, Railway, or Fly.io:

1. The application will listen on port `5000` by default
2. Most cloud platforms will automatically assign a `PORT` environment variable
3. The application will expose health endpoints on the same port:
   - `/healthz` - Simple health check
   - `/health` - Detailed health check with database status
   - `/api/health` - API health status endpoint

## Troubleshooting Port Issues

If you encounter port-related issues during deployment:

1. Check that the `PORT` environment variable is properly set in your deployment environment
2. Verify that the port mentioned in `start-production.js` matches your platform's expected port
3. Ensure your deployment platform is correctly routing traffic to the port the application is using

## Recommended Configuration by Platform

### Render.com
```
PORT=10000
```

### Railway
```
PORT=5000
```

### Fly.io
```
PORT=8080
```

### Vercel
Vercel automatically handles port assignment, so no specific configuration is needed.

## Testing Port Configuration

Use the following command to test if your application is properly responding on the configured port:

```bash
curl -v http://yourdomain.com:$PORT/healthz
```

Replace `$PORT` with your actual port number and `yourdomain.com` with your actual domain.