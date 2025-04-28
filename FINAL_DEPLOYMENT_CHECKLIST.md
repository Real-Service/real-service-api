# Final Deployment Checklist for Real Service API

Use this checklist to ensure your application is production-ready before deploying.

## 1. Server Configuration

- [x] Ensure server listens on `process.env.PORT`
  ```javascript
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
  ```

- [x] Add health check endpoint for monitoring
  ```javascript
  app.get('/healthz', (req, res) => res.status(200).send('OK'));
  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date() }));
  ```

## 2. Environment Variables

- [x] Database connection string (`DATABASE_URL`)
- [x] Session secret (`SESSION_SECRET`)
- [x] Cookie secret (`COOKIE_SECRET`)
- [x] CORS configuration (`CORS_ORIGIN`)
- [x] Frontend URL (`FRONTEND_URL`)
- [x] MapBox token (`VITE_MAPBOX_TOKEN`)
- [x] Port configuration (`PORT`)

## 3. Security

- [x] Ensure cookies are secure
  ```javascript
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    maxAge: 86400000 // 1 day
  }
  ```

- [x] Set appropriate CORS headers
  ```javascript
  app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  ```

- [x] Implement Helmet for additional security headers
  ```javascript
  app.use(helmet());
  ```

## 4. Database

- [x] Create session table if not exists
- [x] Test database connection before startup
- [x] Implement connection retry logic
- [x] Use SSL for database connections

## 5. Deployment-Specific Files

- [x] `start-production.js` - Production startup script
- [x] `.env.production` - Production environment variables
- [x] `render.yaml` - Render deployment configuration
- [x] `vercel.json` - Vercel deployment configuration

## 6. Frontend Configuration

- [x] Update frontend to use production API URL
- [x] Configure WebSocket connection for production
- [x] Set proper authentication token handling

## 7. Testing & Verification

- [x] Run deployment test script to verify endpoints
  ```bash
  API_URL=https://your-deployed-api.render.com node test-deployment.js
  ```

- [x] Verify user authentication works
- [x] Verify database queries are functioning
- [x] Test WebSocket communication

## 8. Monitoring & Logging

- [x] Implement error logging
- [x] Add request logging
- [x] Ensure stack traces aren't exposed in production

## 9. Performance

- [x] Enable gzip compression
  ```javascript
  app.use(compression());
  ```

- [x] Implement appropriate caching headers
- [x] Optimize database queries

## 10. Final Verification

- [x] Verify all secrets are properly set in environment
- [x] Check CORS settings allow frontend to communicate
- [x] Ensure WebSocket URLs are correctly configured
- [x] Test all critical user flows end-to-end