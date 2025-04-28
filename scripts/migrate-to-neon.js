import { Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pg = require('pg');

config();

// This script will:
// 1. Connect to both your current database and Neon
// 2. Get all data from your app DB
// 3. Insert it into Neon database

async function migrateToNeon() {
  // Create TCP/SSL pg.Pool for guaranteed direct connection
  const neonPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const currentPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log("Connected to both databases");

    console.log("Starting migration...");

    // 1. Migrate users
    console.log("Migrating users...");
    const usersResult = await currentPool.query('SELECT * FROM users');
    const users = usersResult.rows;
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      try {
        const query = `
          INSERT INTO users (
            id, username, email, password, "fullName", "userType", phone, "profilePicture", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `;
        
        await neonPool.query(query, [
          user.id,
          user.username,
          user.email,
          user.password,
          user.fullName,
          user.userType,
          user.phone,
          user.profilePicture,
          user.createdAt,
          user.updatedAt
        ]);
      } catch (error) {
        console.error(`Error inserting user ${user.id}:`, error.message);
      }
    }
    console.log("Users migration completed!");

    // 2. Create session table if it doesn't exist
    console.log("Creating session table if needed...");
    try {
      await neonPool.query(`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        )
      `);
      console.log("Session table ready");
    } catch (error) {
      console.error("Error creating session table:", error.message);
    }

    // Add more tables as needed - the most critical is the users table
    
    // 3. Try to migrate other tables - only if they exist
    const tables = [
      'landlord_profiles',
      'contractor_profiles',
      'jobs',
      'bids',
      'reviews',
      'transactions',
      'messages',
      'chat_rooms',
      'chat_participants',
      'service_areas',
      'waitlist_entries',
      'password_reset_tokens',
      'quotes',
      'quote_line_items',
      'invoices',
      'invoice_line_items',
      'time_slots',
      'job_schedules',
      'job_dependencies',
      'job_templates',
      'job_template_tasks',
      'job_template_materials'
    ];

    for (const table of tables) {
      try {
        console.log(`Checking if table ${table} exists...`);
        const tableCheck = await currentPool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [table]);
        
        if (tableCheck.rows[0].exists) {
          console.log(`Migrating ${table}...`);
          const result = await currentPool.query(`SELECT * FROM "${table}"`);
          const rows = result.rows;
          console.log(`Found ${rows.length} rows in ${table}`);
          
          if (rows.length > 0) {
            // Get column names from the first row
            const columns = Object.keys(rows[0]);
            const columnsStr = columns.map(c => `"${c}"`).join(', ');
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            
            for (const row of rows) {
              try {
                const values = columns.map(c => row[c]);
                await neonPool.query(`
                  INSERT INTO "${table}" (${columnsStr})
                  VALUES (${placeholders})
                  ON CONFLICT DO NOTHING
                `, values);
              } catch (error) {
                console.error(`Error inserting into ${table}:`, error.message);
              }
            }
            console.log(`${table} migration completed!`);
          }
        } else {
          console.log(`Table ${table} does not exist, skipping...`);
        }
      } catch (error) {
        console.error(`Error during ${table} migration:`, error.message);
      }
    }

    console.log("Migration completed!");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await neonPool.end();
    await currentPool.end();
  }
}

migrateToNeon();