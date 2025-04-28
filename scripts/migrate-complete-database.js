/**
 * Complete Database Migration Script
 * 
 * This script migrates all tables and data from the source database (sparkling-sound)
 * to the target database (dark-bird) while preserving all relationships.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import { promisify } from 'util';

dotenv.config();

const { Pool } = pg;

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
const logFile = fs.createWriteStream('./migration-log.txt', { flags: 'a' });
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

// Get table schema from source database
async function getTableSchema(tableName) {
  try {
    const query = `
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;
    const result = await executeQuery(sourcePool, query, [tableName]);
    return result.rows;
  } catch (error) {
    log(`Error getting schema for table ${tableName}: ${error.message}`);
    throw error;
  }
}

// Get primary key for a table
async function getPrimaryKey(pool, tableName) {
  try {
    const query = `
      SELECT a.attname as column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass
      AND i.indisprimary
    `;
    const result = await executeQuery(pool, query, [tableName]);
    return result.rows.length > 0 ? result.rows[0].column_name : null;
  } catch (error) {
    log(`Error getting primary key for table ${tableName}: ${error.message}`);
    return null;
  }
}

// Create table in target database
async function createTable(tableName, schema) {
  try {
    // Get primary key info
    const primaryKey = await getPrimaryKey(sourcePool, tableName);
    
    // Start building the CREATE TABLE statement
    let createStatement = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
    
    // Add columns
    const columns = schema.map(col => {
      let colDef = `"${col.column_name}" ${col.data_type}`;
      
      // Add length for character types
      if (col.character_maximum_length) {
        colDef += `(${col.character_maximum_length})`;
      }
      
      // Add nullability
      colDef += col.is_nullable === 'YES' ? ' NULL' : ' NOT NULL';
      
      // Add default value if exists
      if (col.column_default) {
        colDef += ` DEFAULT ${col.column_default}`;
      }
      
      return colDef;
    });
    
    createStatement += columns.join(',\n');
    
    // Add primary key if exists
    if (primaryKey) {
      createStatement += `,\nPRIMARY KEY ("${primaryKey}")`;
    }
    
    createStatement += '\n)';
    
    log(`Creating table: ${tableName}`);
    await executeQuery(targetPool, createStatement);
    log(`Table ${tableName} created successfully`);
    
    return true;
  } catch (error) {
    log(`Error creating table ${tableName}: ${error.message}`);
    return false;
  }
}

// Get sequence info for a table
async function getSequenceInfo(tableName) {
  try {
    const query = `
      SELECT pg_get_serial_sequence($1, a.attname) as sequence_name
      FROM pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE c.relname = $1
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND pg_get_serial_sequence($1, a.attname) IS NOT NULL
    `;
    const result = await executeQuery(sourcePool, query, [tableName]);
    return result.rows.map(row => row.sequence_name);
  } catch (error) {
    log(`Error getting sequence info for table ${tableName}: ${error.message}`);
    return [];
  }
}

// Set sequence value in target database
async function setSequenceValue(sequenceName) {
  try {
    // Get current sequence value from source
    const sourceQuery = `SELECT last_value FROM ${sequenceName}`;
    const sourceResult = await executeQuery(sourcePool, sourceQuery);
    const lastValue = sourceResult.rows[0].last_value;
    
    // Update sequence in target
    const targetQuery = `SELECT setval($1, $2, true)`;
    await executeQuery(targetPool, targetQuery, [sequenceName, lastValue]);
    log(`Updated sequence ${sequenceName} to ${lastValue}`);
    
    return true;
  } catch (error) {
    log(`Error setting sequence value for ${sequenceName}: ${error.message}`);
    return false;
  }
}

// Migrate data from source to target
async function migrateTableData(tableName) {
  try {
    // Get column names
    const schema = await getTableSchema(tableName);
    const columnNames = schema.map(col => col.column_name);
    const columnList = columnNames.map(col => `"${col}"`).join(', ');
    
    // Get data from source
    const selectQuery = `SELECT ${columnList} FROM "${tableName}"`;
    const sourceData = await executeQuery(sourcePool, selectQuery);
    
    if (sourceData.rows.length === 0) {
      log(`No data to migrate for table ${tableName}`);
      return true;
    }
    
    log(`Migrating ${sourceData.rows.length} rows for table ${tableName}`);
    
    // Delete existing data from target (if exists)
    await executeQuery(targetPool, `DELETE FROM "${tableName}"`);
    
    // Build insert statement
    const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(', ');
    const insertQuery = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;
    
    // Insert each row (could be optimized with batch inserts)
    let inserted = 0;
    for (const row of sourceData.rows) {
      const values = columnNames.map(col => row[col]);
      await executeQuery(targetPool, insertQuery, values);
      inserted++;
      
      if (inserted % 100 === 0) {
        log(`Inserted ${inserted}/${sourceData.rows.length} rows into ${tableName}`);
      }
    }
    
    log(`Successfully migrated all ${inserted} rows for table ${tableName}`);
    return true;
  } catch (error) {
    log(`Error migrating data for table ${tableName}: ${error.message}`);
    return false;
  }
}

// Migrate foreign keys
async function migrateForeignKeys() {
  try {
    // Get all foreign key constraints
    const query = `
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    `;
    
    const result = await executeQuery(sourcePool, query);
    
    for (const fk of result.rows) {
      const addFkQuery = `
        ALTER TABLE "${fk.table_name}" 
        ADD CONSTRAINT "${fk.constraint_name}" 
        FOREIGN KEY ("${fk.column_name}") 
        REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}")
      `;
      
      try {
        await executeQuery(targetPool, addFkQuery);
        log(`Added foreign key: ${fk.constraint_name}`);
      } catch (error) {
        log(`Error adding foreign key ${fk.constraint_name}: ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    log(`Error migrating foreign keys: ${error.message}`);
    return false;
  }
}

// Migrate indexes
async function migrateIndexes() {
  try {
    // Get all indexes
    const query = `
      SELECT
        tablename,
        indexname,
        indexdef
      FROM
        pg_indexes
      WHERE
        schemaname = 'public'
        AND indexname NOT LIKE 'pk_%'
        AND indexname NOT LIKE '%_pkey'
    `;
    
    const result = await executeQuery(sourcePool, query);
    
    for (const idx of result.rows) {
      try {
        // Skip if index is for primary key
        if (idx.indexname.endsWith('_pkey')) {
          continue;
        }
        
        // Extract the CREATE INDEX statement
        await executeQuery(targetPool, idx.indexdef);
        log(`Created index: ${idx.indexname}`);
      } catch (error) {
        log(`Error creating index ${idx.indexname}: ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    log(`Error migrating indexes: ${error.message}`);
    return false;
  }
}

// Main migration function
async function migrateDatabase() {
  try {
    log('Starting database migration');
    
    // Get all tables from source database
    const sourceTables = await getSourceTables();
    log(`Found ${sourceTables.length} tables in source database`);
    
    const targetTables = await getTargetTables();
    log(`Found ${targetTables.length} tables in target database`);
    
    // Migration tables array to track progress
    const migrationTables = [];
    
    // First, create all tables
    for (const tableName of sourceTables) {
      const schema = await getTableSchema(tableName);
      const created = await createTable(tableName, schema);
      
      migrationTables.push({
        name: tableName,
        created,
        dataMigrated: false
      });
    }
    
    // Migrate table data
    for (const table of migrationTables) {
      if (table.created) {
        const migrated = await migrateTableData(table.name);
        table.dataMigrated = migrated;
      }
    }
    
    // Update sequences
    for (const tableName of sourceTables) {
      const sequences = await getSequenceInfo(tableName);
      for (const sequence of sequences) {
        await setSequenceValue(sequence);
      }
    }
    
    // Migrate foreign keys
    await migrateForeignKeys();
    
    // Migrate indexes
    await migrateIndexes();
    
    // Log migration results
    log('\nMigration Summary:');
    log('-----------------');
    
    const successful = migrationTables.filter(t => t.created && t.dataMigrated).length;
    const failed = migrationTables.length - successful;
    
    log(`Total tables: ${migrationTables.length}`);
    log(`Successfully migrated: ${successful}`);
    log(`Failed: ${failed}`);
    
    if (failed > 0) {
      log('\nFailed tables:');
      migrationTables
        .filter(t => !t.created || !t.dataMigrated)
        .forEach(t => log(`- ${t.name} (created: ${t.created}, data migrated: ${t.dataMigrated})`));
    }
    
    log('\nMigration completed!');
  } catch (error) {
    log(`Migration failed: ${error.message}`);
  } finally {
    // Close database connections
    sourcePool.end();
    targetPool.end();
    logFile.end();
  }
}

// Run the migration
migrateDatabase();