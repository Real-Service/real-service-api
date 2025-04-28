/**
 * Dedicated database client for authentication operations
 * 
 * This module provides a separate database client specifically for authentication
 * operations that guarantees use of pg.Pool with TCP/SSL connections rather than
 * Neon's WebSocket driver. This ensures all authentication queries can work in
 * production environments where WebSocket connections may be blocked.
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

// Create a dedicated pg pool for authentication - ALWAYS using pg.Pool (TCP/SSL)
const authPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5, // Smaller pool just for auth operations
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Create a Drizzle instance that's guaranteed to use the pg.Pool
const authDb = drizzle(authPool, { schema });

// Log pool type to verify it's using pg.Pool
console.log('💼 Auth DB using connection type:', authPool.constructor.name);

export { authDb, authPool };

// Also export this function to close the pool when the app shuts down
export function closeAuthPool() {
  return authPool.end();
}