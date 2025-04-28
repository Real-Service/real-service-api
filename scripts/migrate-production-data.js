/**
 * Migrate Production Data
 * 
 * This script migrates data from source database to target database
 * after schema has been initialized.
 */

import { Pool } from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Define source and target database connections
const SOURCE_DB = 'postgresql://neondb_owner:npg_QVLlGIO3R4Yk@ep-sparkling-sound-a6f8kyru.us-west-2.aws.neon.tech/neondb?sslmode=require';
const TARGET_DB = 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Create connection pools
const sourcePool = new Pool({
  connectionString: SOURCE_DB,
  ssl: { rejectUnauthorized: false }
});

const targetPool = new Pool({
  connectionString: TARGET_DB,
  ssl: { rejectUnauthorized: false }
});

// Helper function to log to console and file
const logFile = fs.createWriteStream('./data-migration-log.txt', { flags: 'a' });
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logFile.write(logMessage + '\n');
}

// Helper function to execute a query with transaction support
async function executeQuery(pool, query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    log(`Query error: ${error.message}`);
    log(`Failed query: ${query}`);
    throw error;
  }
}

// Get all tables from source database
async function getSourceTables() {
  try {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const result = await executeQuery(sourcePool, query);
    return result.rows.map(row => row.table_name);
  } catch (error) {
    log(`Error getting source tables: ${error.message}`);
    throw error;
  }
}

// Get all tables from target database
async function getTargetTables() {
  try {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const result = await executeQuery(targetPool, query);
    return result.rows.map(row => row.table_name);
  } catch (error) {
    log(`Error getting target tables: ${error.message}`);
    throw error;
  }
}

// Get column names for a table
async function getColumnNames(pool, tableName) {
  try {
    const query = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position
    `;
    const result = await executeQuery(pool, query, [tableName]);
    return result.rows.map(row => row.column_name);
  } catch (error) {
    log(`Error getting column names for table ${tableName}: ${error.message}`);
    throw error;
  }
}

// Get common columns between source and target
async function getCommonColumns(sourceColumns, targetColumns) {
  return sourceColumns.filter(col => targetColumns.includes(col));
}

// Migrate data for a table
async function migrateTableData(tableName) {
  try {
    log(`Starting data migration for table: ${tableName}`);
    
    // Get column names from source and target
    const sourceColumns = await getColumnNames(sourcePool, tableName);
    const targetColumns = await getColumnNames(targetPool, tableName);
    
    // Get common columns between source and target
    const commonColumns = await getCommonColumns(sourceColumns, targetColumns);
    
    if (commonColumns.length === 0) {
      log(`No common columns found for table ${tableName}, skipping...`);
      return false;
    }
    
    const columnList = commonColumns.map(col => `"${col}"`).join(', ');
    
    // Get data from source
    log(`Fetching data from source table ${tableName}...`);
    const selectQuery = `SELECT ${columnList} FROM "${tableName}"`;
    const sourceData = await executeQuery(sourcePool, selectQuery);
    
    if (sourceData.rows.length === 0) {
      log(`No data to migrate for table ${tableName}`);
      return true;
    }
    
    log(`Migrating ${sourceData.rows.length} rows for table ${tableName}`);
    
    // Delete existing data from target table
    await executeQuery(targetPool, `DELETE FROM "${tableName}"`);
    
    // Build insert query
    const placeholders = commonColumns.map((_, i) => `$${i + 1}`).join(', ');
    const insertQuery = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;
    
    // Use batching for efficiency
    const BATCH_SIZE = 100;
    let batches = [];
    
    for (let i = 0; i < sourceData.rows.length; i += BATCH_SIZE) {
      batches.push(sourceData.rows.slice(i, i + BATCH_SIZE));
    }
    
    let inserted = 0;
    for (const batch of batches) {
      const client = await targetPool.connect();
      
      try {
        await client.query('BEGIN');
        
        for (const row of batch) {
          const values = commonColumns.map(col => row[col]);
          await client.query(insertQuery, values);
          inserted++;
        }
        
        await client.query('COMMIT');
        log(`Batch inserted: ${inserted}/${sourceData.rows.length} rows`);
      } catch (error) {
        await client.query('ROLLBACK');
        log(`Batch error: ${error.message}`);
        throw error;
      } finally {
        client.release();
      }
    }
    
    log(`Successfully migrated ${inserted} rows for table ${tableName}`);
    
    // Update sequences if needed
    try {
      const seqQuery = `
        SELECT pg_get_serial_sequence($1, c.column_name) as seq_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND c.table_name = $1
        AND c.column_default LIKE 'nextval%'
      `;
      
      const seqResult = await executeQuery(targetPool, seqQuery, [tableName]);
      
      for (const seq of seqResult.rows) {
        if (seq.seq_name) {
          const maxIdQuery = `SELECT COALESCE(MAX(id), 0) + 1 as max_id FROM "${tableName}"`;
          const maxIdResult = await executeQuery(targetPool, maxIdQuery);
          const maxId = maxIdResult.rows[0].max_id;
          
          if (maxId > 1) {
            const setvalQuery = `SELECT setval($1, $2, false)`;
            await executeQuery(targetPool, setvalQuery, [seq.seq_name, maxId]);
            log(`Updated sequence ${seq.seq_name} to ${maxId}`);
          }
        }
      }
    } catch (error) {
      log(`Warning: Could not update sequences for ${tableName}: ${error.message}`);
      // Continue even if sequence update fails
    }
    
    return true;
  } catch (error) {
    log(`Error migrating data for table ${tableName}: ${error.message}`);
    return false;
  }
}

// Main migration function
async function migrateData() {
  try {
    log('Starting data migration');
    
    // Get all tables from target database (these are the tables we're migrating TO)
    const targetTables = await getTargetTables();
    log(`Target database has ${targetTables.length} tables`);
    
    // Also get source tables for comparison
    const sourceTables = await getSourceTables();
    log(`Source database has ${sourceTables.length} tables`);
    
    // Find tables that exist in both source and target
    const commonTables = sourceTables.filter(table => targetTables.includes(table));
    log(`Found ${commonTables.length} common tables to migrate`);
    
    // Migration results to track progress
    const migrationResults = [];
    
    // Migrate each table
    for (const tableName of commonTables) {
      log(`Processing table: ${tableName}`);
      const success = await migrateTableData(tableName);
      
      migrationResults.push({
        table: tableName,
        success
      });
    }
    
    // Log migration summary
    log('\nMigration Summary:');
    log('-----------------');
    
    const successful = migrationResults.filter(r => r.success).length;
    const failed = migrationResults.filter(r => !r.success).length;
    
    log(`Total tables attempted: ${migrationResults.length}`);
    log(`Successfully migrated: ${successful}`);
    log(`Failed: ${failed}`);
    
    if (failed > 0) {
      log('\nFailed tables:');
      migrationResults
        .filter(r => !r.success)
        .forEach(r => log(`- ${r.table}`));
    }
    
    log('\nData migration completed!');
    
  } catch (error) {
    log(`Migration failed: ${error.message}`);
    log(error.stack);
  } finally {
    // Close database connections
    await sourcePool.end();
    await targetPool.end();
    logFile.end();
  }
}

// Run the migration
migrateData();