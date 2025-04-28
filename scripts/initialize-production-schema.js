/**
 * Initialize Production Schema
 * 
 * This script updates the target database schema using Drizzle
 * and then migrates data from the source database.
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// For Neon serverless connections
neonConfig.webSocketConstructor = ws;

// Define source and target database connections
const SOURCE_DB = 'postgresql://neondb_owner:npg_QVLlGIO3R4Yk@ep-sparkling-sound-a6f8kyru.us-west-2.aws.neon.tech/neondb?sslmode=require';
const TARGET_DB = 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Helper function to log to console and file
const logFile = fs.createWriteStream('./migration-log.txt', { flags: 'a' });
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logFile.write(logMessage + '\n');
}

async function initializeSchema() {
  try {
    log('Starting schema initialization for target database');
    
    // Create source pool
    const sourcePool = new Pool({ connectionString: SOURCE_DB });
    
    // Initialize the target database connection
    log('Setting up target database connection');
    
    // Set current connection string for drizzle migrations to use
    process.env.DATABASE_URL = TARGET_DB;
    
    // Get the current directory
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = path.join(__dirname, '..', 'migrations');
    
    log(`Using migrations from: ${migrationsFolder}`);
    
    if (!fs.existsSync(migrationsFolder)) {
      log('ERROR: Migrations folder does not exist');
      return;
    }
    
    // Create target connection for drizzle
    const targetPool = new Pool({ connectionString: TARGET_DB });
    const targetDb = drizzle(targetPool);
    
    // Drop existing tables (if needed - be careful with this!)
    log('WARNING: Dropping all existing tables in target database');
    const dropTablesQuery = `
      DO $$ 
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `;
    await targetPool.query(dropTablesQuery);
    
    // Run the migrations
    log('Running Drizzle migrations to initialize the schema');
    await migrate(targetDb, { migrationsFolder });
    
    log('Schema initialized successfully!');
    
    // Close the database connections
    await sourcePool.end();
    await targetPool.end();
    
    log('Database connections closed');
  } catch (error) {
    log(`Error initializing schema: ${error.message}`);
    log(error.stack);
  } finally {
    logFile.end();
  }
}

// Run the initialization
initializeSchema();