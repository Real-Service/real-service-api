// Database configuration

// Production database connection
export const PRODUCTION_DB_URL = "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Export standard DB connection type for production operations
export const DB_CONNECTION_TYPE = "postgres-tcp-ssl";

// Additional server settings
export const SESSION_SECRET = process.env.SESSION_SECRET || "real-service-secret-key";