/**
 * Script to migrate data from local development database to production Neon database
 * This handles both SQLite and local PostgreSQL databases
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import pg from 'pg';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Production database (Neon)
const PROD_DB_URL = process.env.DATABASE_URL;

// Check for required variables
if (!PROD_DB_URL) {
  console.error('❌ Missing required DATABASE_URL environment variable');
  process.exit(1);
}

// Formatting and log helpers
const logSection = (title) => {
  console.log('\n' + '='.repeat(80));
  console.log(`${title}`);
  console.log('='.repeat(80));
};

const logSuccess = (message) => console.log(`✅ ${message}`);
const logWarning = (message) => console.log(`⚠️ ${message}`);
const logError = (message) => console.log(`❌ ${message}`);
const logInfo = (message) => console.log(`ℹ️ ${message}`);

// Migration log to track progress
const migrationLog = {
  startTime: new Date().toISOString(),
  sourceType: null,
  tables: {},
  recordCounts: {},
  errors: []
};

async function determineDatabaseType() {
  logSection('DETECTING LOCAL DATABASE TYPE');
  
  // First, search for SQLite database files
  const dbFiles = [
    './dev.db',
    './database.sqlite',
    './database.db',
    './sqlite.db',
    './app.db',
    './real_service.db'
  ];
  
  for (const dbFile of dbFiles) {
    if (fs.existsSync(dbFile)) {
      logSuccess(`Found SQLite database: ${dbFile}`);
      migrationLog.sourceType = 'sqlite';
      migrationLog.sourceLocation = dbFile;
      return { type: 'sqlite', location: dbFile };
    }
  }
  
  // Check for local PostgreSQL
  try {
    const localPgPool = new pg.Pool({
      host: 'localhost',
      port: 5432,
      database: 'real_service',
      user: 'postgres',
      password: 'postgres',
      // Short timeout for quicker failure
      connectionTimeoutMillis: 3000
    });
    
    const client = await localPgPool.connect();
    logSuccess('Connected to local PostgreSQL database');
    client.release();
    await localPgPool.end();
    
    migrationLog.sourceType = 'postgres';
    migrationLog.sourceLocation = 'localhost:5432/real_service';
    return { type: 'postgres', location: 'localhost:5432/real_service' };
  } catch (pgError) {
    logInfo('No local PostgreSQL database detected');
    
    // Try SQLite3 in node_modules
    try {
      const sqlite3Path = require.resolve('sqlite3');
      logInfo(`SQLite3 module found at: ${sqlite3Path}`);
      
      // Check common paths in project root
      const rootDir = path.resolve('./');
      const files = fs.readdirSync(rootDir);
      
      // Filter for potential database files
      const potentialDbFiles = files.filter(file => 
        file.endsWith('.db') || 
        file.endsWith('.sqlite') || 
        file.endsWith('.sqlite3')
      );
      
      if (potentialDbFiles.length > 0) {
        const dbFile = potentialDbFiles[0];
        logSuccess(`Found potential SQLite database: ${dbFile}`);
        migrationLog.sourceType = 'sqlite';
        migrationLog.sourceLocation = dbFile;
        return { type: 'sqlite', location: dbFile };
      }
    } catch (sqliteError) {
      logInfo('SQLite3 module not found in dependencies');
    }
  }
  
  logWarning('Could not automatically detect local database type');
  logInfo('Please specify your database type manually:');
  logInfo('1. For SQLite: node scripts/migrate-local-to-production.js --sqlite=path/to/db.sqlite');
  logInfo('2. For PostgreSQL: node scripts/migrate-local-to-production.js --postgres=postgresql://user:pass@localhost:5432/dbname');
  
  return { type: null, location: null };
}

async function migrateFromSQLite(dbPath) {
  logSection(`MIGRATING FROM SQLITE: ${dbPath}`);
  
  try {
    // Dynamically import SQLite
    const sqlite3 = require('sqlite3').verbose();
    const { open } = require('sqlite');
    
    // Open SQLite database
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Get list of tables
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    logSuccess(`Found ${tables.length} tables in SQLite database`);
    console.log(tables.map(t => t.name).join(', '));
    
    // Connect to production Postgres
    const pgPool = new pg.Pool({
      connectionString: PROD_DB_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Process each table
    for (const table of tables) {
      const tableName = table.name;
      logInfo(`Processing table: ${tableName}`);
      
      // Get all rows from SQLite table
      const rows = await db.all(`SELECT * FROM ${tableName}`);
      logSuccess(`Found ${rows.length} rows in ${tableName}`);
      
      if (rows.length === 0) {
        logInfo(`Skipping empty table: ${tableName}`);
        continue;
      }
      
      // Get column info from first row
      const columns = Object.keys(rows[0]);
      
      // Skip if table might be a system table
      if (tableName.startsWith('sqlite_') || tableName === 'knex_migrations' || tableName === 'knex_migrations_lock') {
        logInfo(`Skipping system table: ${tableName}`);
        continue;
      }
      
      // Check if table exists in Postgres
      try {
        const tableCheckResult = await pgPool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);
        
        const tableExists = tableCheckResult.rows[0].exists;
        
        if (tableExists) {
          // Get count from Postgres table
          const countResult = await pgPool.query(`SELECT COUNT(*) FROM ${tableName}`);
          const pgCount = parseInt(countResult.rows[0].count);
          
          logInfo(`Table ${tableName} exists in Postgres with ${pgCount} rows`);
          
          if (pgCount > 0) {
            logWarning(`Target table already contains data. Skipping to avoid duplicates.`);
            migrationLog.tables[tableName] = 'skipped - target not empty';
            continue;
          }
        } else {
          // Create table in Postgres based on SQLite schema
          // This is a simplified approach and might need adjustments
          logInfo(`Creating table ${tableName} in Postgres`);
          
          // Get schema from SQLite
          const schema = await db.all(`PRAGMA table_info(${tableName})`);
          
          // Build CREATE TABLE statement
          const createColumns = schema.map(col => {
            // Map SQLite types to Postgres types
            let pgType;
            const sqliteType = col.type.toUpperCase();
            
            if (sqliteType.includes('INT')) pgType = 'INTEGER';
            else if (sqliteType.includes('CHAR') || sqliteType.includes('TEXT')) pgType = 'TEXT';
            else if (sqliteType.includes('REAL') || sqliteType.includes('FLOA') || sqliteType.includes('DOUB')) pgType = 'REAL';
            else if (sqliteType.includes('BOOL')) pgType = 'BOOLEAN';
            else if (sqliteType.includes('DATE') || sqliteType.includes('TIME')) pgType = 'TIMESTAMP';
            else pgType = 'TEXT'; // Default to TEXT for unknown types
            
            return `"${col.name}" ${pgType}${col.pk ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}`;
          }).join(', ');
          
          const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (${createColumns})`;
          await pgPool.query(createTableQuery);
          logSuccess(`Created table ${tableName} in Postgres`);
        }
        
        // Insert data
        for (const row of rows) {
          const columnNames = Object.keys(row).map(c => `"${c}"`).join(', ');
          const placeholders = Object.keys(row).map((_, i) => `$${i + 1}`).join(', ');
          const values = Object.values(row);
          
          try {
            await pgPool.query(`
              INSERT INTO ${tableName} (${columnNames})
              VALUES (${placeholders})
            `, values);
          } catch (insertError) {
            logWarning(`Error inserting row in ${tableName}: ${insertError.message}`);
            migrationLog.errors.push({
              table: tableName, 
              error: insertError.message,
              row: row
            });
          }
        }
        
        logSuccess(`Migrated ${rows.length} rows from ${tableName}`);
        migrationLog.tables[tableName] = rows.length;
      } catch (error) {
        logError(`Error processing table ${tableName}: ${error.message}`);
        migrationLog.errors.push({
          table: tableName,
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    // Close connections
    await db.close();
    await pgPool.end();
    
    logSuccess('SQLite migration completed');
    
  } catch (error) {
    logError(`SQLite migration failed: ${error.message}`);
    console.error(error);
    migrationLog.errors.push({
      general: error.message,
      stack: error.stack
    });
  }
}

async function migrateFromPostgres(connectionString) {
  logSection(`MIGRATING FROM POSTGRES: ${connectionString}`);
  
  // Default connection if none provided
  if (!connectionString) {
    connectionString = 'postgresql://postgres:postgres@localhost:5432/real_service';
  }
  
  // Create source and target pools
  const sourcePool = new pg.Pool({
    connectionString,
    // Local doesn't need SSL
    ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });
  
  const targetPool = new pg.Pool({
    connectionString: PROD_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Test connections
    const sourceClient = await sourcePool.connect();
    logSuccess('Connected to source PostgreSQL database');
    sourceClient.release();
    
    const targetClient = await targetPool.connect();
    logSuccess('Connected to target PostgreSQL database');
    targetClient.release();
    
    // Get list of tables
    const tablesResult = await sourcePool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    logSuccess(`Found ${tables.length} tables in source database`);
    console.log(tables.join(', '));
    
    // Process each table
    for (const tableName of tables) {
      logInfo(`Processing table: ${tableName}`);
      
      // Skip system tables
      if (tableName === 'knex_migrations' || tableName === 'knex_migrations_lock' || tableName === 'pg_stat_statements') {
        logInfo(`Skipping system table: ${tableName}`);
        continue;
      }
      
      // Get table schema
      const schemaResult = await sourcePool.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      const schema = schemaResult.rows;
      
      // Get all rows from source table
      const rowsResult = await sourcePool.query(`SELECT * FROM ${tableName}`);
      const rows = rowsResult.rows;
      
      logSuccess(`Found ${rows.length} rows in ${tableName}`);
      
      if (rows.length === 0) {
        logInfo(`Skipping empty table: ${tableName}`);
        continue;
      }
      
      // Check if table exists in target
      const tableCheckResult = await targetPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);
      
      const tableExists = tableCheckResult.rows[0].exists;
      
      if (tableExists) {
        // Get count from target table
        const countResult = await targetPool.query(`SELECT COUNT(*) FROM ${tableName}`);
        const targetCount = parseInt(countResult.rows[0].count);
        
        logInfo(`Table ${tableName} exists in target with ${targetCount} rows`);
        
        if (targetCount > 0) {
          logWarning(`Target table already contains data. Skipping to avoid duplicates.`);
          migrationLog.tables[tableName] = 'skipped - target not empty';
          continue;
        }
      } else {
        // Create table in target
        logInfo(`Creating table ${tableName} in target database`);
        
        // Build CREATE TABLE statement
        const createColumns = schema.map(col => {
          let dataType = col.data_type;
          
          // Add length for character types if specified
          if (col.character_maximum_length && 
              (col.data_type === 'character varying' || col.data_type === 'character')) {
            dataType += `(${col.character_maximum_length})`;
          }
          
          return `"${col.column_name}" ${dataType}`;
        }).join(', ');
        
        const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (${createColumns})`;
        
        try {
          await targetPool.query(createTableQuery);
          logSuccess(`Created table ${tableName} in target database`);
        } catch (createError) {
          logError(`Error creating table ${tableName}: ${createError.message}`);
          migrationLog.errors.push({
            table: tableName,
            operation: 'create',
            error: createError.message
          });
          continue; // Skip to next table if creation fails
        }
      }
      
      // Insert data
      let inserted = 0;
      
      for (const row of rows) {
        const columnNames = Object.keys(row).map(c => `"${c}"`).join(', ');
        const placeholders = Object.keys(row).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(row);
        
        try {
          await targetPool.query(`
            INSERT INTO ${tableName} (${columnNames})
            VALUES (${placeholders})
          `, values);
          
          inserted++;
          
          // Log progress periodically
          if (inserted % 100 === 0 || inserted === rows.length) {
            logInfo(`Inserted ${inserted}/${rows.length} rows into ${tableName}`);
          }
        } catch (insertError) {
          logWarning(`Error inserting row in ${tableName}: ${insertError.message}`);
          migrationLog.errors.push({
            table: tableName,
            operation: 'insert',
            error: insertError.message
          });
        }
      }
      
      logSuccess(`Migrated ${inserted} rows from ${tableName}`);
      migrationLog.tables[tableName] = inserted;
    }
    
    // Close connections
    await sourcePool.end();
    await targetPool.end();
    
    logSuccess('PostgreSQL migration completed');
    
  } catch (error) {
    logError(`PostgreSQL migration failed: ${error.message}`);
    console.error(error);
    migrationLog.errors.push({
      general: error.message,
      stack: error.stack
    });
  }
}

async function main() {
  logSection('STARTING LOCAL TO PRODUCTION MIGRATION');
  
  // Check command line arguments
  const args = process.argv.slice(2);
  let dbType = null;
  let dbLocation = null;
  
  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--sqlite=')) {
      dbType = 'sqlite';
      dbLocation = arg.split('=')[1];
    } else if (arg.startsWith('--postgres=')) {
      dbType = 'postgres';
      dbLocation = arg.split('=')[1];
    }
  }
  
  // If not specified in arguments, try to detect
  if (!dbType) {
    const detected = await determineDatabaseType();
    dbType = detected.type;
    dbLocation = detected.location;
  }
  
  // Start migration based on type
  if (dbType === 'sqlite') {
    await migrateFromSQLite(dbLocation);
  } else if (dbType === 'postgres') {
    await migrateFromPostgres(dbLocation);
  } else {
    logError('Unable to determine database type. Migration aborted.');
    return;
  }
  
  // Save migration log
  migrationLog.endTime = new Date().toISOString();
  fs.writeFileSync('local-migration-log.json', JSON.stringify(migrationLog, null, 2));
  
  logSection('MIGRATION SUMMARY');
  let totalRecords = 0;
  for (const [table, count] of Object.entries(migrationLog.tables)) {
    if (typeof count === 'number') {
      console.log(`${table}: ${count} records`);
      totalRecords += count;
    } else {
      console.log(`${table}: ${count}`);
    }
  }
  
  console.log(`\nTotal records migrated: ${totalRecords}`);
  
  if (migrationLog.errors.length > 0) {
    logWarning(`Encountered ${migrationLog.errors.length} errors during migration`);
    console.log('See local-migration-log.json for details');
  } else {
    logSuccess('Migration completed successfully with no errors');
  }
}

main();