/**
 * Test script to check production database connectivity
 * Verifies tables and test users exist
 */

import pg from 'pg';
const { Pool } = pg;

async function testProductionDb() {
  // Create a connection pool
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    return;
  }
  
  console.log(`Testing production database connection: ${connectionString.split('@')[1]}`);
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Test basic connectivity
    const clientRes = await pool.query('SELECT NOW() as time');
    console.log(`✅ Connected to database at: ${clientRes.rows[0].time}`);
    
    // Check for users table
    try {
      const userTableRes = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      if (userTableRes.rows[0].exists) {
        console.log('✅ Users table exists');
        
        // Count users
        const userCountRes = await pool.query('SELECT COUNT(*) FROM users');
        console.log(`✅ Found ${userCountRes.rows[0].count} users in the database`);
        
        // Check for specific user (contractor 10)
        const testUserRes = await pool.query(`
          SELECT * FROM users 
          WHERE username = 'contractor 10'
        `);
        
        if (testUserRes.rows.length > 0) {
          const user = testUserRes.rows[0];
          console.log(`✅ Found test user: contractor 10 (ID: ${user.id})`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Type: ${user.usertype || user.userType}`);
          console.log(`   Created: ${user.createdat || user.createdAt}`);
        } else {
          console.log('❌ Test user "contractor 10" not found');
        }
      } else {
        console.log('❌ Users table does not exist');
      }
    } catch (error) {
      console.error('❌ Error checking users table:', error.message);
    }
    
    // Check for session table
    try {
      const sessionTableRes = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'session'
        );
      `);
      
      if (sessionTableRes.rows[0].exists) {
        console.log('✅ Session table exists');
        
        // Count sessions
        const sessionCountRes = await pool.query('SELECT COUNT(*) FROM session');
        console.log(`✅ Found ${sessionCountRes.rows[0].count} sessions in the database`);
      } else {
        console.log('❌ Session table does not exist');
        console.log('   Note: This is expected if you are using memory session store');
      }
    } catch (error) {
      console.error('❌ Error checking session table:', error.message);
    }
    
    // Check for contractor profiles table
    try {
      const profileTableRes = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'contractor_profiles'
        );
      `);
      
      if (profileTableRes.rows[0].exists) {
        console.log('✅ Contractor profiles table exists');
        
        // Count profiles
        const profileCountRes = await pool.query('SELECT COUNT(*) FROM contractor_profiles');
        console.log(`✅ Found ${profileCountRes.rows[0].count} contractor profiles in the database`);
        
        // Check if all contractors have profiles
        const missingProfilesRes = await pool.query(`
          SELECT u.id, u.username 
          FROM users u 
          LEFT JOIN contractor_profiles cp ON u.id = cp."userId" 
          WHERE u."userType" = 'contractor' AND cp.id IS NULL
        `);
        
        if (missingProfilesRes.rows.length > 0) {
          console.log('❌ Found contractors missing profiles:');
          missingProfilesRes.rows.forEach(row => {
            console.log(`   - ${row.username} (ID: ${row.id})`);
          });
        } else {
          console.log('✅ All contractors have profile records');
        }
      } else {
        console.log('❌ Contractor profiles table does not exist');
      }
    } catch (error) {
      console.error('❌ Error checking contractor profiles table:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

testProductionDb();