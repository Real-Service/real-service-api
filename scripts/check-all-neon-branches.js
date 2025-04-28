/**
 * Script to check all possible Neon database branches
 * This helps identify where development and production data is stored
 */

import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Known connection string patterns from our files
const connectionPatterns = [
  // Production - US West
  'postgresql://neondb_owner:npg_QVLlGIO3R4Yk@ep-sparkling-sound-a6f8kyru.us-west-2.aws.neon.tech/neondb',
  // Previously seen - US East 1
  'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb',
  // Alternative US East 2 branch
  'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-broken-frost-a1xtgivw.us-east-2.aws.neon.tech/neondb',
  // Custom branch possibilities
  'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw.us-east-1.aws.neon.tech/neondb',
  'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-dev.us-east-1.aws.neon.tech/neondb',
  'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-development.us-east-1.aws.neon.tech/neondb',
];

// Generate all possible branch names
const possibleBranches = [
  '', // main branch
  '-pooler',
  '-dev',
  '-development',
  '-prod',
  '-production',
  '-staging',
  '-test'
];

// Generate all possible connections
const allConnections = [];

connectionPatterns.forEach(baseConn => {
  // Extract parts of the connection string
  const [prefix, hostPart] = baseConn.split('@');
  if (!hostPart) return;
  
  const [host, dbPart] = hostPart.split('/');
  if (!host || !dbPart) return;
  
  // Base host without any branch suffix
  let baseHost = host;
  possibleBranches.forEach(branchSuffix => {
    // Extract the original host without any branch
    for (const suffix of possibleBranches) {
      if (baseHost.endsWith(suffix)) {
        baseHost = baseHost.substring(0, baseHost.length - suffix.length);
        break;
      }
    }
    
    // Create new connection with this branch
    const newHost = baseHost + branchSuffix;
    const newConn = `${prefix}@${newHost}/${dbPart}`;
    allConnections.push(newConn);
  });
});

// Add SSL parameter to all
const connectionsWithSSL = allConnections.map(conn => `${conn}?sslmode=require`);

// Deduplicate
const uniqueConnections = [...new Set(connectionsWithSSL)];

async function checkAllBranches() {
  console.log(`CHECKING ${uniqueConnections.length} POSSIBLE NEON DATABASE BRANCHES`);
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const connection of uniqueConnections) {
    // Create a simple identifier
    const identifier = connection.split('@')[1].split('?')[0];
    console.log(`\nTrying: ${identifier}`);
    
    const pool = new Pool({
      connectionString: connection,
      ssl: { rejectUnauthorized: false },
      // Short timeout to avoid hanging
      connectionTimeoutMillis: 5000
    });
    
    try {
      // Test connection
      const client = await pool.connect();
      console.log('✅ Connected successfully');
      
      // Check for our tables
      try {
        const tablesResult = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        
        const tables = tablesResult.rows.map(row => row.table_name);
        
        // Look for our key tables
        const hasUsers = tables.includes('users');
        const hasContractorProfiles = tables.includes('contractor_profiles');
        const hasLandlordProfiles = tables.includes('landlord_profiles');
        const hasJobs = tables.includes('jobs');
        
        // Determine if this is likely our app database
        const isRealServiceDb = hasUsers && (hasContractorProfiles || hasLandlordProfiles || hasJobs);
        
        if (isRealServiceDb) {
          console.log(`✅ FOUND REAL SERVICE DATABASE! Has ${tables.length} tables`);
          
          // Get record counts
          const userCount = await client.query('SELECT COUNT(*) FROM users');
          console.log(`- Users: ${userCount.rows[0].count}`);
          
          if (hasContractorProfiles) {
            const contractorCount = await client.query('SELECT COUNT(*) FROM contractor_profiles');
            console.log(`- Contractor profiles: ${contractorCount.rows[0].count}`);
          }
          
          if (hasLandlordProfiles) {
            const landlordCount = await client.query('SELECT COUNT(*) FROM landlord_profiles');
            console.log(`- Landlord profiles: ${landlordCount.rows[0].count}`);
          }
          
          if (hasJobs) {
            const jobCount = await client.query('SELECT COUNT(*) FROM jobs');
            console.log(`- Jobs: ${jobCount.rows[0].count}`);
          }
          
          // Get sample users
          const usersResult = await client.query('SELECT id, username, email, "userType" FROM users ORDER BY id LIMIT 3');
          console.log('\nSample users:');
          usersResult.rows.forEach(user => {
            console.log(`- ${user.username} (${user.email}, ${user.userType})`);
          });
          
          // Store this in results
          results.push({
            connection,
            identifier,
            tables: tables.length,
            userCount: parseInt(userCount.rows[0].count),
            isRealServiceDb: true,
            sampleTables: tables.slice(0, 10)
          });
        } else {
          console.log(`Found database but not Real Service (has ${tables.length} tables)`);
          if (tables.length > 0) {
            console.log(`Tables include: ${tables.slice(0, 5).join(', ')}${tables.length > 5 ? '...' : ''}`);
          }
          
          results.push({
            connection,
            identifier,
            tables: tables.length,
            isRealServiceDb: false,
            sampleTables: tables.slice(0, 5)
          });
        }
      } catch (error) {
        console.log(`Error checking tables: ${error.message}`);
        results.push({
          connection,
          identifier,
          connected: true,
          error: error.message
        });
      }
      
      client.release();
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      results.push({
        connection,
        identifier,
        connected: false,
        error: error.message
      });
    } finally {
      await pool.end();
    }
  }
  
  // Summarize results
  console.log('\n='.repeat(80));
  console.log('DATABASE CONNECTION RESULTS');
  console.log('='.repeat(80));
  
  const realServiceDbs = results.filter(r => r.isRealServiceDb);
  console.log(`\nFound ${realServiceDbs.length} Real Service databases:`);
  
  realServiceDbs.forEach(db => {
    console.log(`\n${db.identifier}:`);
    console.log(`- Tables: ${db.tables}`);
    console.log(`- Users: ${db.userCount}`);
    console.log(`- Connection: ${db.connection}`);
  });
  
  // Write the results to a file
  fs.writeFileSync('database-branches.json', JSON.stringify(results, null, 2));
  console.log('\nFull results saved to database-branches.json');
  
  // Recommend ENV variables
  if (realServiceDbs.length >= 2) {
    const sorted = [...realServiceDbs].sort((a, b) => b.userCount - a.userCount);
    console.log('\nRECOMMENDED ENVIRONMENT VARIABLES:');
    console.log(`PROD_DATABASE_URL="${sorted[0].connection}"`);
    console.log(`DEV_DATABASE_URL="${sorted[1].connection}"`);
  } else if (realServiceDbs.length === 1) {
    console.log('\nOnly found one Real Service database. Using it for production.');
    console.log(`PROD_DATABASE_URL="${realServiceDbs[0].connection}"`);
  } else {
    console.log('\nNo Real Service databases found. Check connection details and try again.');
  }
}

checkAllBranches();