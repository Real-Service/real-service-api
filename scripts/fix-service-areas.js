/**
 * Script to properly fix service areas for contractor profiles
 * Handles all JSON formatting properly
 */

import pg from 'pg';
const { Pool } = pg;

async function fixServiceAreas() {
  // Create pool for production database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get all contractor profiles
    console.log('CHECKING ALL CONTRACTOR PROFILES');
    const profilesResult = await pool.query(`
      SELECT cp.id, cp."userId", cp."serviceArea", cp."serviceAreas", u.username
      FROM contractor_profiles cp
      JOIN users u ON cp."userId" = u.id
      WHERE u."userType" = 'contractor'
    `);
    
    if (profilesResult.rows.length === 0) {
      console.log('No contractor profiles found');
      return;
    }
    
    console.log(`Found ${profilesResult.rows.length} contractor profiles`);
    
    for (const profile of profilesResult.rows) {
      console.log(`\nChecking contractor: ${profile.username} (User ID: ${profile.userId})`);
      console.log(`Profile ID: ${profile.id}`);
      
      // Inspect the service area data
      const hasServiceArea = profile.serviceArea && typeof profile.serviceArea === 'object' && Object.keys(profile.serviceArea).length > 0;
      const hasServiceAreas = profile.serviceAreas && Array.isArray(profile.serviceAreas) && profile.serviceAreas.length > 0;
      
      console.log(`Service Area: ${JSON.stringify(profile.serviceArea)}`);
      console.log(`Service Areas: ${JSON.stringify(profile.serviceAreas)}`);
      console.log(`Has service area: ${hasServiceArea}, Has service areas: ${hasServiceAreas}`);
      
      // Create default service area if needed
      const defaultServiceArea = {
        id: 1,
        city: 'Toronto',
        state: 'ON',
        latitude: 43.6532,
        longitude: -79.3832,
        radius: 25
      };
      
      // Fix problems based on data state
      if (!hasServiceArea && !hasServiceAreas) {
        // Case 1: No service area data at all
        console.log('No service area data at all. Creating defaults...');
        
        const defaultServiceAreas = [defaultServiceArea];
        
        await pool.query(`
          UPDATE contractor_profiles 
          SET "serviceArea" = $1::jsonb, "serviceAreas" = $2::jsonb
          WHERE id = $3
        `, [
          JSON.stringify(defaultServiceArea),
          JSON.stringify(defaultServiceAreas),
          profile.id
        ]);
        
        console.log('Created default service area data');
      } 
      else if (hasServiceArea && !hasServiceAreas) {
        // Case 2: Has serviceArea but no serviceAreas
        console.log('Has service area but no service areas. Creating serviceAreas from serviceArea...');
        
        const serviceAreasArray = [profile.serviceArea];
        
        await pool.query(`
          UPDATE contractor_profiles 
          SET "serviceAreas" = $1::jsonb
          WHERE id = $2
        `, [
          JSON.stringify(serviceAreasArray),
          profile.id
        ]);
        
        console.log(`Created serviceAreas: ${JSON.stringify(serviceAreasArray)}`);
      }
      else if (!hasServiceArea && hasServiceAreas) {
        // Case 3: Has serviceAreas but no serviceArea
        console.log('Has service areas but no service area. Creating serviceArea from first serviceAreas entry...');
        
        const firstArea = profile.serviceAreas[0];
        
        await pool.query(`
          UPDATE contractor_profiles 
          SET "serviceArea" = $1::jsonb
          WHERE id = $2
        `, [
          JSON.stringify(firstArea),
          profile.id
        ]);
        
        console.log(`Created serviceArea: ${JSON.stringify(firstArea)}`);
      }
      else {
        console.log('Both service area fields are set. No updates needed.');
      }
    }
    
    // Verify all profiles after updates
    console.log('\nVERIFYING ALL CONTRACTOR PROFILES AFTER UPDATES');
    const updatedProfilesResult = await pool.query(`
      SELECT cp.id, cp."userId", cp."serviceArea", cp."serviceAreas", u.username
      FROM contractor_profiles cp
      JOIN users u ON cp."userId" = u.id
      WHERE u."userType" = 'contractor'
    `);
    
    let allValid = true;
    
    for (const profile of updatedProfilesResult.rows) {
      const hasServiceArea = profile.serviceArea && typeof profile.serviceArea === 'object' && Object.keys(profile.serviceArea).length > 0;
      const hasServiceAreas = profile.serviceAreas && Array.isArray(profile.serviceAreas) && profile.serviceAreas.length > 0;
      
      if (!hasServiceArea || !hasServiceAreas) {
        console.log(`❌ Contractor ${profile.username} (ID: ${profile.userId}) still has incomplete service area data`);
        console.log(`   Service Area: ${JSON.stringify(profile.serviceArea)}`);
        console.log(`   Service Areas: ${JSON.stringify(profile.serviceAreas)}`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log('✅ SUCCESS: All contractor profiles now have valid service area data');
    } else {
      console.log('❌ Some profiles still have invalid service area data');
    }
    
  } catch (error) {
    console.error('Error fixing service areas:', error);
  } finally {
    await pool.end();
  }
}

fixServiceAreas();