/**
 * Full Data Migration Script: Development to Production
 * 
 * This script migrates all data from the development database to the production database:
 * - Users (with password preservation)
 * - Contractor profiles
 * - Landlord profiles
 * - Jobs
 * - Bids
 * - Chats & Messages
 * - Reviews
 * - Quotes & Invoices
 * - All other related data
 */

import pg from 'pg';
import { promisify } from 'util';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import fs from 'fs';
const { Pool } = pg;

// Connection info
const DEV_DB_URL = process.env.DEV_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/real_service_dev';
const PROD_DB_URL = process.env.DATABASE_URL;

const scryptAsync = promisify(scrypt);

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

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

// Create database connections
async function migrateAllData() {
  if (!PROD_DB_URL) {
    logError('DATABASE_URL environment variable is not set for production');
    process.exit(1);
  }

  logSection('STARTING FULL DATA MIGRATION: DEV TO PRODUCTION');
  console.log(`From: ${DEV_DB_URL.split('@')[1]}`);
  console.log(`To:   ${PROD_DB_URL.split('@')[1]}`);

  const devPool = new Pool({
    connectionString: DEV_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  const prodPool = new Pool({
    connectionString: PROD_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test connections
    const devClient = await devPool.connect();
    logSuccess('Connected to development database');
    devClient.release();

    const prodClient = await prodPool.connect();
    logSuccess('Connected to production database');
    prodClient.release();

    // Get table list from development database
    const tablesResult = await devPool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    logInfo(`Found ${tables.length} tables in development database`);
    
    // 0. Create migration log
    const migrationLog = {
      startTime: new Date().toISOString(),
      tables: {},
      errors: []
    };

    // 1. Migrate users first
    await migrateUsers(devPool, prodPool, migrationLog);
    
    // 2. Migrate the rest of the tables
    for (const table of tables) {
      // Skip users table (already handled)
      if (table === 'users') continue;
      
      // Skip PostgreSQL internal tables
      if (table === 'pg_stat_statements' || table === 'pg_stat_statements_info') continue;
      
      // Handle profile tables with special logic
      if (table === 'contractor_profiles' || table === 'landlord_profiles') {
        await migrateProfiles(table, devPool, prodPool, migrationLog);
      } else {
        // Generic migration for other tables
        await migrateTable(table, devPool, prodPool, migrationLog);
      }
    }

    // Save migration log
    fs.writeFileSync('migration-log.json', JSON.stringify(migrationLog, null, 2));
    logSuccess('Migration log saved to migration-log.json');

    logSection('MIGRATION SUMMARY');
    let totalRecords = 0;
    for (const [table, count] of Object.entries(migrationLog.tables)) {
      console.log(`${table}: ${count} records`);
      totalRecords += count;
    }
    console.log(`\nTotal records migrated: ${totalRecords}`);
    
    if (migrationLog.errors.length > 0) {
      logWarning(`Encountered ${migrationLog.errors.length} errors during migration`);
      console.log('See migration-log.json for details');
    } else {
      logSuccess('Migration completed successfully with no errors');
    }

  } catch (error) {
    logError(`Migration failed: ${error.message}`);
    console.error(error);
  } finally {
    // Close connections
    await devPool.end();
    await prodPool.end();
    logInfo('Database connections closed');
  }
}

// Special handling for users table to preserve passwords
async function migrateUsers(devPool, prodPool, migrationLog) {
  logSection('MIGRATING USERS');
  
  try {
    // Get all users from development
    const devUsersResult = await devPool.query('SELECT * FROM users');
    const devUsers = devUsersResult.rows;
    logInfo(`Found ${devUsers.length} users in development database`);
    
    // Get all users from production
    const prodUsersResult = await prodPool.query('SELECT id, username, email FROM users');
    const prodUsers = prodUsersResult.rows;
    logInfo(`Found ${prodUsers.length} existing users in production database`);
    
    // Map existing production users by username
    const prodUsersByUsername = {};
    prodUsers.forEach(user => {
      prodUsersByUsername[user.username] = user;
    });
    
    // Process each development user
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const devUser of devUsers) {
      // Check if user exists in production
      const existingProdUser = prodUsersByUsername[devUser.username];
      
      // If user exists, skip or update
      if (existingProdUser) {
        // Use conservative approach - only update email and other non-critical fields if missing
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;
        
        // Fields to potentially update
        const updatableFields = ['email', 'fullName', 'phone', 'profilePicture', 'updatedAt'];
        
        for (const field of updatableFields) {
          if (!existingProdUser[field] && devUser[field]) {
            updateFields.push(`"${field}" = $${paramCount}`);
            updateValues.push(devUser[field]);
            paramCount++;
          }
        }
        
        // Only update if there are fields to update
        if (updateFields.length > 0) {
          const updateQuery = `
            UPDATE users
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, username
          `;
          updateValues.push(existingProdUser.id);
          
          const updateResult = await prodPool.query(updateQuery, updateValues);
          if (updateResult.rows.length > 0) {
            logSuccess(`Updated user: ${updateResult.rows[0].username} (ID: ${updateResult.rows[0].id})`);
            updated++;
          }
        } else {
          skipped++;
        }
      } else {
        // Insert new user
        // Note: We use the same password from dev for simplicity
        const insertQuery = `
          INSERT INTO users (
            username, email, password, "fullName", "userType", phone, "profilePicture", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, username
        `;
        
        const insertValues = [
          devUser.username,
          devUser.email,
          devUser.password, // Keep the original password hash
          devUser.fullName || devUser.fullname,
          devUser.userType || devUser.usertype,
          devUser.phone,
          devUser.profilePicture || devUser.profilepicture,
          devUser.createdAt || devUser.createdat || new Date(),
          devUser.updatedAt || devUser.updatedat || new Date()
        ];
        
        const insertResult = await prodPool.query(insertQuery, insertValues);
        if (insertResult.rows.length > 0) {
          logSuccess(`Created user: ${insertResult.rows[0].username} (ID: ${insertResult.rows[0].id})`);
          inserted++;
        }
      }
    }
    
    logSuccess(`Users migration complete: ${inserted} inserted, ${updated} updated, ${skipped} unchanged`);
    migrationLog.tables['users'] = inserted + updated;
    
  } catch (error) {
    logError(`Error migrating users: ${error.message}`);
    migrationLog.errors.push({
      table: 'users',
      error: error.message,
      stack: error.stack
    });
  }
}

// Special handling for profile tables to ensure proper JSON formatting
async function migrateProfiles(table, devPool, prodPool, migrationLog) {
  logSection(`MIGRATING ${table.toUpperCase()}`);
  
  try {
    // Get all profiles from development
    const devProfilesResult = await devPool.query(`SELECT * FROM ${table}`);
    const devProfiles = devProfilesResult.rows;
    logInfo(`Found ${devProfiles.length} records in development ${table}`);
    
    // Get all profiles from production
    const prodProfilesResult = await prodPool.query(`SELECT "userId" FROM ${table}`);
    const prodProfiles = prodProfilesResult.rows;
    logInfo(`Found ${prodProfiles.length} existing records in production ${table}`);
    
    // Map existing production profiles by userId
    const prodProfilesByUserId = {};
    prodProfiles.forEach(profile => {
      prodProfilesByUserId[profile.userId] = true;
    });
    
    // Process each development profile
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const devProfile of devProfiles) {
      const userId = devProfile.userId || devProfile.userid;
      
      // Skip if no userId (shouldn't happen with proper data)
      if (!userId) {
        logWarning(`Profile in ${table} has no userId, skipping`);
        skipped++;
        continue;
      }
      
      // Check if profile exists in production
      const exists = prodProfilesByUserId[userId];
      
      // Insert or update
      if (!exists) {
        // Build column list and values for insert
        const columns = [];
        const placeholders = [];
        const values = [];
        let paramCount = 1;
        
        // Process each field in the profile, ensuring proper JSON formatting
        for (const [key, value] of Object.entries(devProfile)) {
          // Special handling for JSON fields
          if (key === 'serviceArea' || key === 'serviceAreas' || key === 'skills') {
            columns.push(`"${key}"`);
            placeholders.push(`$${paramCount}`);
            
            // Ensure proper JSON formatting
            if (value && typeof value === 'object') {
              // Already an object, stringify it
              values.push(JSON.stringify(value));
            } else if (value && typeof value === 'string') {
              try {
                // Try to parse and re-stringify to ensure proper formatting
                const parsed = JSON.parse(value);
                values.push(JSON.stringify(parsed));
              } catch (e) {
                // Not valid JSON, use as-is but warn
                logWarning(`Invalid JSON in ${key} for ${table} userId ${userId}, using as-is`);
                values.push(value);
              }
            } else {
              // Null or undefined, use empty object or array
              if (key === 'serviceAreas') {
                values.push('[]');
              } else {
                values.push('{}');
              }
            }
          } else {
            // Normal field
            columns.push(`"${key}"`);
            placeholders.push(`$${paramCount}`);
            values.push(value);
          }
          paramCount++;
        }
        
        // Insert query
        const insertQuery = `
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING id, "userId"
        `;
        
        const insertResult = await prodPool.query(insertQuery, values);
        if (insertResult.rows.length > 0) {
          logSuccess(`Created ${table} for user ID: ${insertResult.rows[0].userId}`);
          inserted++;
        }
      } else {
        // Skip existing profiles for safety
        logInfo(`${table} for user ID ${userId} already exists, skipping`);
        skipped++;
      }
    }
    
    logSuccess(`${table} migration complete: ${inserted} inserted, ${skipped} unchanged`);
    migrationLog.tables[table] = inserted;
    
  } catch (error) {
    logError(`Error migrating ${table}: ${error.message}`);
    migrationLog.errors.push({
      table,
      error: error.message,
      stack: error.stack
    });
  }
}

// Generic migration logic for other tables
async function migrateTable(table, devPool, prodPool, migrationLog) {
  logSection(`MIGRATING ${table.toUpperCase()}`);
  
  try {
    // Get schema information to handle column names properly
    const schemaQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;
    
    const devSchemaResult = await devPool.query(schemaQuery, [table]);
    const devColumns = devSchemaResult.rows;
    
    if (devColumns.length === 0) {
      logWarning(`No columns found for table ${table} in development, skipping`);
      return;
    }
    
    // Get all data from development
    const columnNames = devColumns.map(col => `"${col.column_name}"`).join(', ');
    const devDataResult = await devPool.query(`SELECT ${columnNames} FROM ${table}`);
    const devData = devDataResult.rows;
    
    logInfo(`Found ${devData.length} records in development ${table}`);
    
    // Check if table exists in production
    try {
      await prodPool.query(`SELECT 1 FROM ${table} LIMIT 1`);
    } catch (e) {
      // Table doesn't exist, create it first
      logWarning(`Table ${table} doesn't exist in production, creating it...`);
      
      // Build CREATE TABLE statement
      const createColumns = devColumns.map(col => {
        let dataType = col.data_type;
        if (col.data_type === 'USER-DEFINED') {
          // For enum types, use text instead
          dataType = 'text';
        }
        return `"${col.column_name}" ${dataType}`;
      }).join(', ');
      
      const createQuery = `CREATE TABLE IF NOT EXISTS ${table} (${createColumns})`;
      await prodPool.query(createQuery);
      logSuccess(`Created table ${table} in production`);
    }
    
    // Get count of existing records in production
    const prodCountResult = await prodPool.query(`SELECT COUNT(*) FROM ${table}`);
    const existingCount = parseInt(prodCountResult.rows[0].count);
    logInfo(`Found ${existingCount} existing records in production ${table}`);
    
    // Check if table already has data and has id column
    if (existingCount > 0) {
      logWarning(`Table ${table} already has data in production. Skipping to avoid duplicates.`);
      return;
    }
    
    // Insert all development data
    let inserted = 0;
    
    for (const record of devData) {
      const columns = [];
      const placeholders = [];
      const values = [];
      let paramCount = 1;
      
      // Process each field in the record
      for (const [key, value] of Object.entries(record)) {
        columns.push(`"${key}"`);
        placeholders.push(`$${paramCount}`);
        
        // Special handling for JSON fields
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramCount++;
      }
      
      // Insert query
      const insertQuery = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
      `;
      
      try {
        await prodPool.query(insertQuery, values);
        inserted++;
        
        // Log progress occasionally
        if (inserted % 100 === 0 || inserted === devData.length) {
          logInfo(`Inserted ${inserted}/${devData.length} records into ${table}`);
        }
      } catch (insertError) {
        logWarning(`Error inserting record into ${table}: ${insertError.message}`);
        migrationLog.errors.push({
          table,
          error: insertError.message,
          record: record
        });
      }
    }
    
    logSuccess(`${table} migration complete: ${inserted} inserted`);
    migrationLog.tables[table] = inserted;
    
  } catch (error) {
    logError(`Error migrating ${table}: ${error.message}`);
    migrationLog.errors.push({
      table,
      error: error.message,
      stack: error.stack
    });
  }
}

// Run the migration
migrateAllData();