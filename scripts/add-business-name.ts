import { Pool, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import ws from 'ws';

// Configure the WebSocket connection for Node.js
neonConfig.webSocketConstructor = ws;

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('Connecting to database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Adding business_name column to contractor_profiles table...');
    
    // Check if the column already exists
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'contractor_profiles' AND column_name = 'business_name';
    `;
    
    const checkResult = await pool.query(checkColumnQuery);
    
    if (checkResult.rows.length === 0) {
      // Column doesn't exist, add it
      const alterTableQuery = `
        ALTER TABLE contractor_profiles
        ADD COLUMN business_name TEXT;
      `;
      
      await pool.query(alterTableQuery);
      console.log('business_name column added successfully!');
    } else {
      console.log('business_name column already exists, skipping...');
    }

    // Use a transaction to extract business name from bio and populate the new column
    const updateClient = await pool.connect();
    try {
      // Start transaction
      await updateClient.query('BEGIN');
      
      // Fetch all profiles
      const profiles = await updateClient.query('SELECT * FROM contractor_profiles');
      
      // Update business names
      for (const profile of profiles.rows) {
        if (profile.bio) {
          // Extract what looks like a business name from the bio
          // Assuming business name is at the beginning of the bio up to the first period or comma
          const match = profile.bio.match(/^([^.,;]+)(?:[.,;]|\s-)/);
          const possibleBusinessName = match ? match[1].trim() : null;
          
          if (possibleBusinessName && possibleBusinessName.length > 3) {
            await updateClient.query(
              'UPDATE contractor_profiles SET business_name = $1 WHERE id = $2',
              [possibleBusinessName, profile.id]
            );
            console.log(`Updated profile ${profile.id} with business name: ${possibleBusinessName}`);
          }
        }
      }
      
      // Commit transaction
      await updateClient.query('COMMIT');
      console.log('Initial business name population complete');
    } catch (error) {
      // Rollback on error
      await updateClient.query('ROLLBACK');
      console.error('Error populating business names:', error);
    } finally {
      // Release client
      updateClient.release();
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Unhandled error in migration script:', error);
  process.exit(1);
});