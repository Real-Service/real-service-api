/**
 * Script to create profile data for migrated users in the production database
 */

import pg from 'pg';
const { Pool } = pg;

async function migrateUserProfiles() {
  // Create pool for production database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get users without profile data
    console.log('CHECKING FOR USERS WITHOUT PROFILE DATA');
    
    // 1. First check contractors
    const contractors = await pool.query(`
      SELECT u.id, u.username, u."userType" 
      FROM users u
      LEFT JOIN contractor_profiles cp ON u.id = cp."userId"
      WHERE u."userType" = 'contractor' AND cp.id IS NULL
    `);
    
    if (contractors.rows.length > 0) {
      console.log(`Found ${contractors.rows.length} contractors without profile data:`);
      
      for (const user of contractors.rows) {
        console.log(`- User ${user.id}: ${user.username}`);
        
        // Create contractor profile with default data
        const result = await pool.query(`
          INSERT INTO contractor_profiles 
          (userId, bio, skills, serviceArea, walletBalance, averageRating, 
           totalRatings, serviceRadius, hasLiabilityInsurance, businessName)
          VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          user.id, 
          `Professional contractor with experience in home renovation and repairs.`, 
          JSON.stringify(['General Contracting', 'Repairs', 'Maintenance']),
          JSON.stringify({ city: 'Toronto', state: 'ON', radius: 50 }),
          0,
          4.5,
          10,
          25,
          true,
          `${user.username} Services`
        ]);
        
        console.log(`✅ Created contractor profile (ID: ${result.rows[0].id}) for user ${user.id}: ${user.username}`);
      }
    } else {
      console.log('All contractors have profile data.');
    }
    
    // 2. Then check landlords
    const landlords = await pool.query(`
      SELECT u.id, u.username, u."userType" 
      FROM users u
      LEFT JOIN landlord_profiles lp ON u.id = lp."userId"
      WHERE u."userType" = 'landlord' AND lp.id IS NULL
    `);
    
    if (landlords.rows.length > 0) {
      console.log(`Found ${landlords.rows.length} landlords without profile data:`);
      
      for (const user of landlords.rows) {
        console.log(`- User ${user.id}: ${user.username}`);
        
        // Create landlord profile with default data
        const propertyData = JSON.stringify([
          {
            address: "123 Main St",
            city: "Toronto",
            state: "ON",
            postalCode: "M5V 2T6",
            type: "Residential"
          }
        ]);
        
        const result = await pool.query(`
          INSERT INTO landlord_profiles 
          (userId, bio, properties, walletBalance, averageRating, totalRatings)
          VALUES 
          ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          user.id, 
          `Property owner managing residential and commercial units.`, 
          propertyData,
          0,
          4.7,
          8
        ]);
        
        console.log(`✅ Created landlord profile (ID: ${result.rows[0].id}) for user ${user.id}: ${user.username}`);
      }
    } else {
      console.log('All landlords have profile data.');
    }
    
    // 3. Verify all user profiles
    console.log('\nVERIFYING ALL USER PROFILES');
    
    const allUsers = await pool.query(`
      SELECT 
        u.id, 
        u.username, 
        u."userType",
        CASE 
          WHEN u."userType" = 'contractor' THEN EXISTS(SELECT 1 FROM contractor_profiles WHERE "userId" = u.id)
          WHEN u."userType" = 'landlord' THEN EXISTS(SELECT 1 FROM landlord_profiles WHERE "userId" = u.id)
          ELSE false
        END as has_profile
      FROM users u
      WHERE u."userType" IN ('contractor', 'landlord')
    `);
    
    const usersWithoutProfiles = allUsers.rows.filter(u => !u.has_profile);
    
    if (usersWithoutProfiles.length === 0) {
      console.log('✅ SUCCESS: All users have appropriate profile data.');
    } else {
      console.log(`❌ WARNING: ${usersWithoutProfiles.length} users still missing profile data:`);
      usersWithoutProfiles.forEach(u => {
        console.log(`- User ${u.id}: ${u.username} (${u.userType})`);
      });
    }
    
  } catch (error) {
    console.error('Error migrating user profiles:', error);
  } finally {
    await pool.end();
  }
}

migrateUserProfiles();