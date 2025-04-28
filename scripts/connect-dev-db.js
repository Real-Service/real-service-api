/**
 * Script to find and connect to the development database
 * Used to determine the correct connection string for migration
 */

import pg from 'pg';
const { Pool } = pg;

// Potential connection strings to try
const connectionStrings = [
  'postgresql://postgres:postgres@localhost:5432/real_service_dev',
  'postgresql://postgres:postgres@localhost:5432/real_service',
  'postgresql://postgres:postgres@localhost:5432/postgres',
  'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-broken-frost-a1xtgivw.us-east-2.aws.neon.tech/neondb?sslmode=require'
];

async function findDevDatabase() {
  console.log('ATTEMPTING TO LOCATE DEVELOPMENT DATABASE');
  console.log('=======================================');
  
  for (const connectionString of connectionStrings) {
    console.log(`\nTrying connection: ${connectionString.split('@')[1]}`);
    
    const pool = new Pool({
      connectionString,
      ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false,
      // Short timeout to avoid long waits for failed connections
      connectionTimeoutMillis: 5000
    });
    
    try {
      // Attempt connection
      const client = await pool.connect();
      console.log('✅ Connected successfully');
      
      // Check if this is the real service database by looking for specific tables
      try {
        const tablesResult = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        
        const tables = tablesResult.rows.map(row => row.table_name);
        console.log(`Found ${tables.length} tables:`);
        console.log(tables.join(', '));
        
        // Check if key tables exist
        const hasUsers = tables.includes('users');
        const hasContractors = tables.includes('contractor_profiles');
        const hasLandlords = tables.includes('landlord_profiles');
        const hasJobs = tables.includes('jobs');
        
        if (hasUsers && hasContractors && hasLandlords && hasJobs) {
          console.log('\n✅ This appears to be the Real Service development database!');
          
          // Count records
          const usersCount = await client.query('SELECT COUNT(*) FROM users');
          const contractorsCount = await client.query('SELECT COUNT(*) FROM contractor_profiles');
          const landlordCount = await client.query('SELECT COUNT(*) FROM landlord_profiles');
          const jobsCount = await client.query('SELECT COUNT(*) FROM jobs');
          
          console.log('\nRecord counts:');
          console.log(`- Users: ${usersCount.rows[0].count}`);
          console.log(`- Contractor profiles: ${contractorsCount.rows[0].count}`);
          console.log(`- Landlord profiles: ${landlordCount.rows[0].count}`);
          console.log(`- Jobs: ${jobsCount.rows[0].count}`);
          
          console.log('\n🔑 To use this database for migration, set this environment variable:');
          console.log(`DEV_DATABASE_URL=${connectionString}`);
          
          // Get a sample user to confirm it's the right database
          const sampleUser = await client.query('SELECT id, username, email, "userType" FROM users LIMIT 1');
          if (sampleUser.rows.length > 0) {
            console.log('\nSample user from this database:');
            console.log(sampleUser.rows[0]);
          }
          
          return connectionString;
        } else {
          console.log('❌ This database does not appear to be the Real Service database');
        }
      } catch (error) {
        console.log(`Error checking tables: ${error.message}`);
      }
      
      client.release();
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
    } finally {
      pool.end();
    }
  }
  
  console.log('\n❌ Could not locate the development database');
  console.log('Please provide the correct connection string manually using:');
  console.log('DEV_DATABASE_URL=your_connection_string node scripts/migrate-dev-to-prod.js');
  
  return null;
}

findDevDatabase();