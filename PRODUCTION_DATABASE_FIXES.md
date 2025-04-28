# Production Database Connection Fixes

This document explains how to fix common database connection issues when deploying the Real Service application to production.

## Core Issues in Production

When moving from development to production with Neon PostgreSQL, you may encounter these issues:

1. **WebSocket Connection Failures**: Neon's serverless WebSocket driver (`@neondatabase/serverless`) often fails in production due to WebSocket connectivity limitations in some server environments.
2. **Session Storage Failures**: Without a properly configured session table, the PostgreSQL session store will fall back to memory storage, causing all sessions to be lost on server restart.
3. **Session Retrieval Issues**: The connect-pg-simple package may fail to retrieve sessions even when they exist in the database.
4. **SSL Certificate Verification**: Some deployment environments require special SSL configuration for PostgreSQL connections.

## Solutions

### 1. Fix Database Connection for Production

In `server/db.ts`, ensure that:

- All imports of `@neondatabase/serverless` are wrapped in conditional logic
- Production environments use standard `pg.Pool` with SSL configuration
- The SSL option `rejectUnauthorized: false` is set for production

Here's the proper pattern:

```typescript
// Development - use conditional imports
let pool;

// The standard pg Pool is always available
import { Pool } from 'pg';

// Set flag to detect which environment we're in
const isProduction = process.env.NODE_ENV === 'production';
// Make this available globally for other modules
globalThis.isProductionEnv = isProduction;

if (isProduction) {
  // PRODUCTION: Use standard pg Pool with SSL for TCP connections
  console.log('🛢️ Using production Postgres TCP pool (pg.Pool)');
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  // DEVELOPMENT: Use Neon's serverless driver with WebSockets
  console.log('🛢️ Using development Neon WebSocket pool (NeonPool)');
  
  // Import dynamically to avoid issues in production
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);
  
  pool = sql;
}

export { pool };
```

### 2. Fix Session Store Configuration

In `server/storage.ts`, ensure the session store is properly configured:

1. Use the correct pool (standard `pg.Pool`) in production
2. Verify the session table exists
3. Set up fallback to memory store if needed
4. Implement a custom session retrieval method that works reliably (see PRODUCTION_SESSION_STORE.md)

```typescript
// Method to set up production session store
private async _setupProductionSessionStore() {
  try {
    // Use pure pg Pool approach
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const PgSessionLib = require('connect-pg-simple');
    const PostgresSessionStore = PgSessionLib(session);
    
    // Make sure we're using the pg.Pool instance, not NeonPool
    this.sessionStore = new PostgresSessionStore({
      pool: pool, // This should be a pg.Pool in production from db.ts
      tableName: 'session', // Important: This table must exist in the database
      pruneSessionInterval: 60 * 15, // prune expired sessions every 15 minutes
    });
    
    // Check if session table exists, if not, auto-create it
    try {
      // Try to query the session table to see if it exists
      await (pool as any).query('SELECT COUNT(*) FROM session');
      console.log('✅ Session table exists in database');
    } catch (tableErr) {
      console.log('⚠️ Session table does not exist, creating it now...');
      // Create the session table if it doesn't exist
      try {
        await (pool as any).query(`
          CREATE TABLE IF NOT EXISTS "session" (
            "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
            "sess" json NOT NULL,
            "expire" timestamp(6) NOT NULL
          )
          WITH (OIDS=FALSE);
          
          CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
        `);
        console.log('✅ Session table created successfully');
      } catch (createErr) {
        console.error('❌ Failed to create session table:', createErr);
        throw new Error('Failed to create session table');
      }
    }
    
    console.log('✅ Production PostgreSQL session store initialized successfully');
  } catch (err) {
    console.error('❌ Failed to initialize production PostgreSQL session store:', err);
    console.error('Using memory store as fallback. Sessions will be lost on restart!');
    this._setupMemoryStore('production');
  }
}
```

### 3. Create the Session Table

Always ensure the session table exists in your database with the correct structure:

```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

You can use the provided script `scripts/create-session-table.js` to automatically create or verify this table.

### 4. Testing Production Database Connection

Use the `test-production-db.js` script to verify your production database connection:

```bash
NODE_ENV=production node test-production-db.js
```

This will test the connection using `pg.Pool` with SSL, just like in the production environment.

## Session Configuration in Express App

Make sure your Express session configuration in `server/index.ts` is properly set up:

```typescript
app.use(session({
  store: storage.sessionStore,
  secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: isProduction,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax'
  }
}));
```

## Troubleshooting

### MemoryStore Warning

If you see this warning:

```
Warning: connect.session() MemoryStore is not designed for a production environment
```

It means your PostgreSQL session store is not working correctly. Verify:

1. The session table exists in your database
2. Your database connection is working correctly
3. Your session store configuration is using the correct pool

### Database Connection Errors

If you see connection errors:

1. Double-check your `DATABASE_URL` is correct
2. Verify the SSL configuration in `server/db.ts`
3. Make sure your Neon PostgreSQL database is accessible from your deployment environment
4. Use `NODE_ENV=production node test-production-db.js` to test the connection