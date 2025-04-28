/**
 * Migrate Users Only
 * 
 * This script specifically migrates user data from source to target database
 * Handling the different column names and ensuring required fields are filled
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
const logFile = fs.createWriteStream('./user-migration-log.txt', { flags: 'a' });
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logFile.write(logMessage + '\n');
}

// Get users from source database
async function getSourceUsers() {
  try {
    const query = `SELECT * FROM users ORDER BY id`;
    const result = await sourcePool.query(query);
    log(`Found ${result.rows.length} users in source database`);
    return result.rows;
  } catch (error) {
    log(`Error getting source users: ${error.message}`);
    throw error;
  }
}

// Get target database schema for users
async function getTargetUserSchema() {
  try {
    const query = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      ORDER BY ordinal_position
    `;
    const result = await targetPool.query(query);
    log(`Target user table has ${result.rows.length} columns`);
    return result.rows;
  } catch (error) {
    log(`Error getting target user schema: ${error.message}`);
    throw error;
  }
}

// Map source user data to target schema
function mapUserData(sourceUser, targetSchema) {
  const targetUser = {};
  
  // Mapping of field names (source -> target)
  const fieldMapping = {
    'id': 'id',
    'username': 'username',
    'password': 'password',
    'email': 'email',
    'fullName': 'full_name',
    'phone': 'phone',
    'userType': 'user_type',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'profilePicture': 'profile_picture'
  };
  
  // For each field in the target schema
  targetSchema.forEach(column => {
    // Find the corresponding source field
    const sourceField = Object.keys(fieldMapping).find(key => fieldMapping[key] === column.column_name);
    
    if (sourceField && sourceUser[sourceField] !== undefined) {
      targetUser[column.column_name] = sourceUser[sourceField];
    } else if (column.is_nullable === 'NO' && !column.column_default) {
      // Fill required fields with defaults if they don't exist in source
      switch (column.column_name) {
        case 'full_name':
          targetUser[column.column_name] = sourceUser.username || 'Unknown';
          break;
        case 'user_type':
          targetUser[column.column_name] = sourceUser.userType || 'contractor';
          break;
        default:
          if (column.data_type === 'text' || column.data_type.includes('character')) {
            targetUser[column.column_name] = '';
          } else if (column.data_type === 'boolean') {
            targetUser[column.column_name] = false;
          } else if (column.data_type.includes('int')) {
            targetUser[column.column_name] = 0;
          }
      }
    }
  });
  
  return targetUser;
}

// Insert a user into the target database
async function insertUser(user) {
  const columns = Object.keys(user);
  const values = Object.values(user);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  
  const query = `
    INSERT INTO users (${columns.map(c => `"${c}"`).join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE
    SET ${columns.map((col, i) => `"${col}" = $${i + 1}`).join(', ')}
    RETURNING id, username, email
  `;
  
  try {
    const result = await targetPool.query(query, values);
    return result.rows[0];
  } catch (error) {
    log(`Error inserting user: ${error.message}`);
    throw error;
  }
}

// Main migration function
async function migrateUsers() {
  try {
    log('Starting user migration');
    
    // Clear existing users
    await targetPool.query('DELETE FROM users');
    log('Deleted existing users from target database');
    
    // Get users from source database
    const sourceUsers = await getSourceUsers();
    
    // Get target database schema
    const targetSchema = await getTargetUserSchema();
    
    // Migrate each user
    let successCount = 0;
    let failCount = 0;
    
    for (const sourceUser of sourceUsers) {
      try {
        // Map source user data to target schema
        const targetUser = mapUserData(sourceUser, targetSchema);
        
        // Insert user into target database
        const result = await insertUser(targetUser);
        
        log(`✅ Migrated user ${result.id}: ${result.username} (${result.email})`);
        successCount++;
      } catch (error) {
        log(`❌ Failed to migrate user ${sourceUser.id}: ${sourceUser.username}: ${error.message}`);
        failCount++;
      }
    }
    
    // Update the sequence
    try {
      const maxIdQuery = `SELECT COALESCE(MAX(id), 0) + 1 as max_id FROM users`;
      const maxIdResult = await targetPool.query(maxIdQuery);
      const maxId = maxIdResult.rows[0].max_id;
      
      if (maxId > 1) {
        const setvalQuery = `SELECT setval('users_id_seq', $1, false)`;
        await targetPool.query(setvalQuery, [maxId]);
        log(`Updated sequence users_id_seq to ${maxId}`);
      }
    } catch (error) {
      log(`Warning: Could not update users sequence: ${error.message}`);
    }
    
    // Log migration summary
    log('\nUser Migration Summary:');
    log('-----------------');
    log(`Total users attempted: ${sourceUsers.length}`);
    log(`Successfully migrated: ${successCount}`);
    log(`Failed: ${failCount}`);
    
    log('\nUser migration completed!');
    
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
migrateUsers();