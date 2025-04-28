# Production Session Store Configuration

This document explains how the session storage is configured for the production environment.

## Current Configuration

Our application uses a PostgreSQL session store to maintain user sessions across server restarts and deployments. This provides a robust, production-ready solution for user authentication persistence.

## Key Components

1. **Session Table**
   - Table name: `session`
   - Created automatically by connect-pg-simple
   - Contains all active session data

2. **Database Connection**
   - Uses the same PostgreSQL database as the main application
   - Connected via the `DATABASE_URL` environment variable
   - Located in AWS Region: `us-west-2`

3. **Technical Implementation**

The session store is configured in `server/routes.ts` with these settings:

```javascript
import connectPg from "connect-pg-simple";
const PostgresSessionStore = connectPg(session);

const sessionStore = new PostgresSessionStore({
  pool,                      // Uses the same PostgreSQL pool as app
  createTableIfMissing: true // Auto-creates the session table if missing
});

const sessionSettings = {
  secret: process.env.SESSION_SECRET || 'realservice_secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
};
```

## Important Notes

1. **Session Persistence**
   - User sessions persist even after server restarts
   - Sessions expire after 24 hours by default

2. **Connection Management**
   - The session store shares the same database connection pool as the application
   - This reduces connection overhead and simplifies database management

3. **Session Table Verification**
   - Our testing confirms the session table exists and contains active sessions
   - Currently: 154 sessions in the database

## Troubleshooting

If sessions are not persisting as expected:

1. Verify the database connection is properly established
2. Check that the session table exists and has the correct schema
3. Ensure cookies are being properly set in the browser
4. Verify the session middleware is correctly configured in your Express application

## Further Enhancements

Possible improvements to consider:

1. **Session Cleanup** - Implement a routine to clear expired sessions
2. **Monitoring** - Add monitoring for session count and expiration
3. **Session Rotation** - Implement security best practices like session rotation