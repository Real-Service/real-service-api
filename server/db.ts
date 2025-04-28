import * as schema from "@shared/schema";

// Add TypeScript type definition for our global property
declare global {
  var databasePool: any; // Using any to avoid TypeScript issues with different pool types
  var isProductionEnv: boolean;
}

// Force production database mode regardless of environment
// This ensures we always use the production database
const isProduction = true; // Override environment detection to always use production
// Store production environment flag globally so it can be accessed by other modules
globalThis.isProductionEnv = isProduction;
console.log('🚨 IMPORTANT: Forcing production database mode to ensure production data is used');

// Override DATABASE_URL to ensure we're using the production database
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
console.log('🔐 Forcing DATABASE_URL to use the production database: ep-dark-bird-a4xtgivw-pooler');

// Initialize PostgreSQL connection with proper environment separation
let db;

// IMPORTANT: Split imports and initialization based on environment
// This prevents any Neon modules from being loaded in production
if (isProduction) {
  // PRODUCTION-ONLY IMPORTS - NO NEON-RELATED IMPORTS AT ALL
  console.log('📍 Loading production-specific database modules');
  
  // Only import what we need for production
  const { Pool } = await import('pg');
  // Important: Use the node-postgres (pg) version of Drizzle for proper TCP connections
  const { drizzle } = await import("drizzle-orm/node-postgres");
  // Also import pg-specific session module if we need it for direct session operations
  const { getTableColumns, sql: pgSql } = await import("drizzle-orm/pg-core");
  
  // Use standard 'pg' in production for TCP/SSL connection that works in Replit deployments
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
      rejectUnauthorized: false 
    },
    // Connection pool settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Test connection
  try {
    const result = await pgPool.query('SELECT NOW()');
    console.log('✅ Production database connection test successful using pg.Pool');
    console.log('Connected to database, server time:', result.rows[0].now);
  } catch (err) {
    console.error('❌ Production database connection test failed:', err);
  }

  console.log('🔥 Using production Postgres TCP pool (pg.Pool) for app DB');
  
  // Initialize production database with node-postgres
  db = drizzle(pgPool, { schema });
  
  // Export pool for session store or other direct usage
  globalThis.databasePool = pgPool;
} else {
  // DEVELOPMENT-ONLY IMPORTS - these never run in production
  console.log('📍 Loading development-specific database modules');
  
  // Import Neon-related modules only for development
  const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const ws = await import('ws');
  
  // Development mode - Use Neon's serverless WebSocket driver
  neonConfig.webSocketConstructor = ws.default;

  const neonPool = new NeonPool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🔄 Using development Neon serverless WebSocket pool');
  
  // Initialize development database with neon-serverless
  db = drizzle(neonPool, { schema });
  
  // Export pool for session store or other direct usage
  globalThis.databasePool = neonPool;
}

// Export a single db instance for use throughout the app
export { db };

// Also export the pool for direct connection needs
export const pool = globalThis.databasePool;
