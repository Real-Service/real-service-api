/**
 * Complete Data Migration Script
 * 
 * This script migrates all remaining data from the source database to the target database.
 * It handles jobs, bids, contractor profiles, and other related data while preserving IDs
 * and relationships.
 */

const { Pool } = require('pg');
const fs = require('fs');

// Connection to source database (sparkling-sound)
const SOURCE_DB_URL = 'postgresql://neondb_owner:npg_QVLlGIO3R4Yk@ep-sparkling-sound-a6f8kyru.us-west-2.aws.neon.tech/neondb?sslmode=require';
const sourcePool = new Pool({
  connectionString: SOURCE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Connection to target database (dark-bird)
const TARGET_DB_URL = 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const targetPool = new Pool({
  connectionString: TARGET_DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Create a log file for the migration process
const logStream = fs.createWriteStream('migration-log.txt', { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
}

async function migrateData() {
  try {
    log('===== BEGINNING FULL DATA MIGRATION =====');
    log(`Source DB: ${SOURCE_DB_URL.split('@')[1].split('/')[0]}`);
    log(`Target DB: ${TARGET_DB_URL.split('@')[1].split('/')[0]}`);

    // Step 1: Migrate contractor profiles
    await migrateContractorProfiles();
    
    // Step 2: Migrate jobs 
    await migrateJobs();
    
    // Step 3: Migrate bids
    await migrateBids();
    
    // Step 4: Migrate other essential tables
    await migrateOtherTables();
    
    // Step 5: Update sequences to prevent ID conflicts
    await updateSequences();

    log('===== DATA MIGRATION COMPLETED SUCCESSFULLY =====');
  } catch (error) {
    log(`ERROR: Migration failed: ${error.message}`);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close database connections
    await sourcePool.end();
    await targetPool.end();
    logStream.end();
  }
}

async function migrateContractorProfiles() {
  try {
    log('Migrating contractor profiles...');
    
    // Check if contractor_profiles table exists in target
    const tableCheck = await targetPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contractor_profiles'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      log('contractor_profiles table does not exist in target DB. Creating it first...');
      // Create the table - simplified version, you may need to adjust based on your actual schema
      await targetPool.query(`
        CREATE TABLE IF NOT EXISTS contractor_profiles (
          id SERIAL PRIMARY KEY,
          "userId" INTEGER NOT NULL UNIQUE REFERENCES users(id),
          bio TEXT,
          skills TEXT[],
          "serviceArea" JSONB,
          "walletBalance" NUMERIC DEFAULT 0,
          "averageRating" NUMERIC,
          "totalRatings" INTEGER DEFAULT 0,
          background TEXT,
          availability JSONB,
          city TEXT,
          state TEXT,
          "serviceRadius" INTEGER DEFAULT 25,
          "serviceZipCodes" TEXT[],
          trades TEXT[],
          experience TEXT,
          "hourlyRate" NUMERIC,
          "hasLiabilityInsurance" BOOLEAN DEFAULT FALSE,
          "insuranceCoverage" TEXT,
          "paymentMethods" TEXT[],
          warranty TEXT,
          languages TEXT[],
          portfolio JSONB[],
          "serviceAreas" JSONB[],
          "businessName" TEXT
        )
      `);
      log('contractor_profiles table created');
    }
    
    // Get all contractor profiles from source
    const { rows: sourceProfiles } = await sourcePool.query('SELECT * FROM contractor_profiles');
    log(`Found ${sourceProfiles.length} contractor profiles in source database`);
    
    // Insert each profile into target
    for (const profile of sourceProfiles) {
      // Check if profile already exists in target
      const existingCheck = await targetPool.query('SELECT id FROM contractor_profiles WHERE "userId" = $1', [profile.userId]);
      
      if (existingCheck.rows.length > 0) {
        log(`Contractor profile for user ${profile.userId} already exists. Updating...`);
        // Build update query dynamically based on non-null fields
        const updateFields = [];
        const values = [];
        let paramIndex = 1;
        
        // Skip id and userId which shouldn't be updated
        for (const [key, value] of Object.entries(profile)) {
          if (key !== 'id' && key !== 'userId' && value !== null) {
            updateFields.push(\`"\${key}" = $\${paramIndex}\`);
            values.push(value);
            paramIndex++;
          }
        }
        
        values.push(profile.userId); // Add userId for WHERE clause
        
        if (updateFields.length > 0) {
          const updateQuery = `
            UPDATE contractor_profiles 
            SET ${updateFields.join(', ')} 
            WHERE "userId" = $${paramIndex}
          `;
          await targetPool.query(updateQuery, values);
          log(`Updated contractor profile for user ${profile.userId}`);
        }
      } else {
        // Insert new profile
        const keys = Object.keys(profile).map(k => `"${k}"`).join(', ');
        const placeholders = Object.keys(profile).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(profile);
        
        await targetPool.query(`
          INSERT INTO contractor_profiles (${keys})
          VALUES (${placeholders})
        `, values);
        log(`Inserted contractor profile for user ${profile.userId}`);
      }
    }
    
    log('Contractor profiles migration completed');
  } catch (error) {
    log(`ERROR migrating contractor profiles: ${error.message}`);
    throw error;
  }
}

async function migrateJobs() {
  try {
    log('Migrating jobs...');
    
    // Check if jobs table exists in target
    const tableCheck = await targetPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      log('jobs table does not exist in target DB. Creating it first...');
      // Create the table - simplified version
      await targetPool.query(`
        CREATE TABLE IF NOT EXISTS jobs (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          "landlordId" INTEGER NOT NULL REFERENCES users(id),
          "contractorId" INTEGER REFERENCES users(id),
          status TEXT NOT NULL DEFAULT 'open',
          "pricingType" TEXT,
          budget NUMERIC,
          location JSONB,
          "categoryTags" TEXT[],
          "isUrgent" BOOLEAN DEFAULT FALSE,
          deadline TIMESTAMP,
          images TEXT[],
          "startDate" TIMESTAMP,
          "completionDate" TIMESTAMP,
          progress INTEGER DEFAULT 0,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        )
      `);
      log('jobs table created');
    }
    
    // Get all jobs from source
    const { rows: sourceJobs } = await sourcePool.query('SELECT * FROM jobs');
    log(`Found ${sourceJobs.length} jobs in source database`);
    
    // Insert each job into target
    for (const job of sourceJobs) {
      // Check if job already exists in target
      const existingCheck = await targetPool.query('SELECT id FROM jobs WHERE id = $1', [job.id]);
      
      if (existingCheck.rows.length > 0) {
        log(`Job ID ${job.id} already exists. Updating...`);
        // Build update query dynamically based on non-null fields
        const updateFields = [];
        const values = [];
        let paramIndex = 1;
        
        // Skip id which shouldn't be updated
        for (const [key, value] of Object.entries(job)) {
          if (key !== 'id' && value !== null) {
            updateFields.push(\`"\${key}" = $\${paramIndex}\`);
            values.push(value);
            paramIndex++;
          }
        }
        
        values.push(job.id); // Add id for WHERE clause
        
        if (updateFields.length > 0) {
          const updateQuery = `
            UPDATE jobs 
            SET ${updateFields.join(', ')} 
            WHERE id = $${paramIndex}
          `;
          await targetPool.query(updateQuery, values);
          log(`Updated job ID ${job.id}`);
        }
      } else {
        // Insert new job with original ID
        const keys = Object.keys(job).map(k => `"${k}"`).join(', ');
        const placeholders = Object.keys(job).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(job);
        
        await targetPool.query(`
          INSERT INTO jobs (${keys})
          VALUES (${placeholders})
        `, values);
        log(`Inserted job ID ${job.id}`);
      }
    }
    
    log('Jobs migration completed');
  } catch (error) {
    log(`ERROR migrating jobs: ${error.message}`);
    throw error;
  }
}

async function migrateBids() {
  try {
    log('Migrating bids...');
    
    // Check if bids table exists in target
    const tableCheck = await targetPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bids'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      log('bids table does not exist in target DB. Creating it first...');
      await targetPool.query(`
        CREATE TABLE IF NOT EXISTS bids (
          id SERIAL PRIMARY KEY,
          "jobId" INTEGER NOT NULL REFERENCES jobs(id),
          "contractorId" INTEGER NOT NULL REFERENCES users(id),
          amount NUMERIC NOT NULL,
          proposal TEXT,
          "timeEstimate" TEXT,
          "proposedStartDate" TIMESTAMP,
          status TEXT NOT NULL DEFAULT 'pending',
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        )
      `);
      log('bids table created');
    }
    
    // Get all bids from source
    const { rows: sourceBids } = await sourcePool.query('SELECT * FROM bids');
    log(`Found ${sourceBids.length} bids in source database`);
    
    // Insert each bid into target
    for (const bid of sourceBids) {
      // Check if bid already exists in target
      const existingCheck = await targetPool.query('SELECT id FROM bids WHERE id = $1', [bid.id]);
      
      if (existingCheck.rows.length > 0) {
        log(`Bid ID ${bid.id} already exists. Updating...`);
        // Build update query dynamically based on non-null fields
        const updateFields = [];
        const values = [];
        let paramIndex = 1;
        
        // Skip id which shouldn't be updated
        for (const [key, value] of Object.entries(bid)) {
          if (key !== 'id' && value !== null) {
            updateFields.push(\`"\${key}" = $\${paramIndex}\`);
            values.push(value);
            paramIndex++;
          }
        }
        
        values.push(bid.id); // Add id for WHERE clause
        
        if (updateFields.length > 0) {
          const updateQuery = `
            UPDATE bids 
            SET ${updateFields.join(', ')} 
            WHERE id = $${paramIndex}
          `;
          await targetPool.query(updateQuery, values);
          log(`Updated bid ID ${bid.id}`);
        }
      } else {
        // Insert new bid with original ID
        const keys = Object.keys(bid).map(k => `"${k}"`).join(', ');
        const placeholders = Object.keys(bid).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(bid);
        
        await targetPool.query(`
          INSERT INTO bids (${keys})
          VALUES (${placeholders})
        `, values);
        log(`Inserted bid ID ${bid.id}`);
      }
    }
    
    log('Bids migration completed');
  } catch (error) {
    log(`ERROR migrating bids: ${error.message}`);
    throw error;
  }
}

async function migrateOtherTables() {
  try {
    log('Migrating other essential tables...');
    
    // Array of additional tables to migrate
    const additionalTables = [
      'chat_rooms',
      'chat_participants',
      'messages',
      'reviews',
      'transactions',
      'landlord_profiles',
      'quotes',
      'quote_line_items',
      'invoices',
      'invoice_line_items',
      'waitlist_entries'
    ];
    
    for (const tableName of additionalTables) {
      try {
        log(`Checking table: ${tableName}`);
        
        // Check if table exists in source
        const sourceTableCheck = await sourcePool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
          )
        `);
        
        if (!sourceTableCheck.rows[0].exists) {
          log(`Table ${tableName} does not exist in source DB. Skipping.`);
          continue;
        }
        
        // Check if table exists in target
        const targetTableCheck = await targetPool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
          )
        `);
        
        // Get table structure from source
        const tableStructure = await sourcePool.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable
          FROM information_schema.columns
          WHERE table_name = '${tableName}'
          ORDER BY ordinal_position
        `);
        
        if (!targetTableCheck.rows[0].exists) {
          log(`Table ${tableName} does not exist in target DB. Creating it first...`);
          
          // Generate CREATE TABLE statement
          let createTableSQL = `CREATE TABLE ${tableName} (\n`;
          
          // Add columns
          for (const column of tableStructure.rows) {
            let columnType = column.data_type;
            if (column.character_maximum_length) {
              columnType += `(${column.character_maximum_length})`;
            }
            
            const nullable = column.is_nullable === 'YES' ? '' : ' NOT NULL';
            createTableSQL += `  "${column.column_name}" ${columnType}${nullable},\n`;
          }
          
          // Remove trailing comma and close parenthesis
          createTableSQL = createTableSQL.slice(0, -2) + '\n)';
          
          // Execute CREATE TABLE
          await targetPool.query(createTableSQL);
          log(`Created table ${tableName}`);
        }
        
        // Get data from source
        const { rows: sourceData } = await sourcePool.query(`SELECT * FROM ${tableName}`);
        log(`Found ${sourceData.length} rows in ${tableName}`);
        
        if (sourceData.length === 0) {
          log(`No data to migrate for ${tableName}. Skipping.`);
          continue;
        }
        
        // Insert data into target
        for (const row of sourceData) {
          // Check if row already exists in target
          let existingCheckQuery;
          let existingParams;
          
          if (row.id) {
            existingCheckQuery = `SELECT id FROM ${tableName} WHERE id = $1`;
            existingParams = [row.id];
          } else {
            // If no ID, we'll assume it's a new row - this is a simplification
            existingCheckQuery = null;
          }
          
          let existingRow = null;
          if (existingCheckQuery) {
            const existingCheck = await targetPool.query(existingCheckQuery, existingParams);
            existingRow = existingCheck.rows[0];
          }
          
          if (existingRow) {
            log(`Row with ID ${row.id} already exists in ${tableName}. Skipping.`);
          } else {
            // Insert new row
            const keys = Object.keys(row).map(k => `"${k}"`).join(', ');
            const placeholders = Object.keys(row).map((_, i) => `$${i + 1}`).join(', ');
            const values = Object.values(row);
            
            await targetPool.query(`
              INSERT INTO ${tableName} (${keys})
              VALUES (${placeholders})
            `, values);
            log(`Inserted row ID ${row.id} into ${tableName}`);
          }
        }
      } catch (error) {
        log(`WARNING: Error migrating table ${tableName}: ${error.message}`);
        // Continue with other tables even if one fails
      }
    }
    
    log('Other tables migration completed');
  } catch (error) {
    log(`ERROR migrating other tables: ${error.message}`);
    throw error;
  }
}

async function updateSequences() {
  try {
    log('Updating sequences...');
    
    // Get list of tables with ID columns
    const { rows: tables } = await targetPool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    
    for (const { table_name } of tables) {
      try {
        // Check if table has id column and a sequence
        const { rows: columns } = await targetPool.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = $1
          AND column_name = 'id'
        `, [table_name]);
        
        if (columns.length > 0) {
          const sequenceName = `${table_name}_id_seq`;
          
          // Check if sequence exists
          const { rows: sequences } = await targetPool.query(`
            SELECT 1
            FROM information_schema.sequences
            WHERE sequence_name = $1
          `, [sequenceName]);
          
          if (sequences.length > 0) {
            // Get max ID from table
            const { rows: maxId } = await targetPool.query(`
              SELECT COALESCE(MAX(id), 0) + 1 as next_id
              FROM ${table_name}
            `);
            
            if (maxId.length > 0 && maxId[0].next_id > 1) {
              // Update sequence
              await targetPool.query(`
                SELECT setval($1, $2, false)
              `, [`${sequenceName}`, maxId[0].next_id]);
              
              log(`Updated sequence for ${table_name} to start at ${maxId[0].next_id}`);
            }
          }
        }
      } catch (error) {
        log(`WARNING: Error updating sequence for ${table_name}: ${error.message}`);
        // Continue with other tables even if one fails
      }
    }
    
    log('Sequence updates completed');
  } catch (error) {
    log(`ERROR updating sequences: ${error.message}`);
    throw error;
  }
}

// Execute the migration
migrateData();