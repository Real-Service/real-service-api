// This script handles migrating our session data while preserving existing sessions
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';
dotenv.config();

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function main() {
  try {
    const pool = new Pool({ connectionString });
    
    console.log('Checking for existing session table...');
    
    // Check if session table exists
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'session'
      );
    `);
    
    const sessionTableExists = tableCheckResult.rows[0].exists;
    
    if (sessionTableExists) {
      console.log('Session table exists, preserving existing data...');
      
      // Create a backup of the session table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS session_backup AS 
        SELECT * FROM session;
      `);
      
      console.log('Session data backed up to session_backup table');
      
      // Get count of backup sessions
      const countResult = await pool.query('SELECT COUNT(*) FROM session_backup');
      console.log(`Backed up ${countResult.rows[0].count} session records`);
    } else {
      console.log('Session table does not exist yet, will be created by connect-pg-simple');
    }
    
    // Close the connection
    await pool.end();
    console.log('Session migration completed successfully');
    
  } catch (error) {
    console.error('Error during session migration:', error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('Session migration script completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Session migration failed:', err);
    process.exit(1);
  });