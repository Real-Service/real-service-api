/**
 * Script to check and update service areas for contractor profiles
 */

import pg from 'pg';
const { Pool } = pg;

async function checkServiceAreas() {
  // Create pool for production database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get all contractor profiles
    console.log('CHECKING ALL CONTRACTOR SERVICE AREAS');
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
      console.log(`Service Area: ${JSON.stringify(profile.serviceArea)}`);
      console.log(`Service Areas: ${JSON.stringify(profile.serviceAreas)}`);
      
      // If serviceArea is empty but serviceAreas is not, update serviceArea
      if ((!profile.serviceArea || Object.keys(profile.serviceArea).length === 0) && 
          profile.serviceAreas && Array.isArray(profile.serviceAreas) && profile.serviceAreas.length > 0) {
        
        console.log('Service area is empty but serviceAreas exists. Updating...');
        
        // Get first service area from serviceAreas array
        const firstArea = profile.serviceAreas[0];
        
        await pool.query(`
          UPDATE contractor_profiles 
          SET "serviceArea" = $1
          WHERE id = $2
        `, [firstArea, profile.id]);
        
        console.log(`Updated serviceArea to: ${JSON.stringify(firstArea)}`);
      }
      // If serviceAreas is empty but serviceArea is not, update serviceAreas
      else if ((!profile.serviceAreas || !Array.isArray(profile.serviceAreas) || profile.serviceAreas.length === 0) && 
               profile.serviceArea && Object.keys(profile.serviceArea).length > 0) {
        
        console.log('serviceAreas is empty but serviceArea exists. Updating...');
        
        // Create serviceAreas array using the single serviceArea
        // Make sure we're sending valid JSON
        const serviceAreasArray = [profile.serviceArea];
        
        await pool.query(`
          UPDATE contractor_profiles 
          SET "serviceAreas" = $1::jsonb
          WHERE id = $2
        `, [JSON.stringify(serviceAreasArray), profile.id]);
        
        console.log(`Updated serviceAreas to: ${JSON.stringify(serviceAreasArray)}`);
      }
      // If both are empty, create default values
      else if ((!profile.serviceArea || Object.keys(profile.serviceArea).length === 0) && 
               (!profile.serviceAreas || !Array.isArray(profile.serviceAreas) || profile.serviceAreas.length === 0)) {
        
        console.log('Both serviceArea and serviceAreas are empty. Creating defaults...');
        
        const defaultServiceArea = {
          id: 1,
          city: 'Toronto',
          state: 'ON',
          latitude: 43.6532,
          longitude: -79.3832,
          radius: 25
        };
        
        const defaultServiceAreas = [defaultServiceArea];
        
        await pool.query(`
          UPDATE contractor_profiles 
          SET "serviceArea" = $1::jsonb, "serviceAreas" = $2::jsonb
          WHERE id = $3
        `, [JSON.stringify(defaultServiceArea), JSON.stringify(defaultServiceAreas), profile.id]);
        
        console.log(`Updated both fields with default values`);
      } else {
        console.log('Service area data is properly set. No updates needed.');
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
      const hasServiceArea = profile.serviceArea && Object.keys(profile.serviceArea).length > 0;
      const hasServiceAreas = profile.serviceAreas && Array.isArray(profile.serviceAreas) && profile.serviceAreas.length > 0;
      
      if (!hasServiceArea || !hasServiceAreas) {
        console.log(`❌ Contractor ${profile.username} (ID: ${profile.userId}) still has incomplete service area data`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log('✅ SUCCESS: All contractor profiles now have valid service area data');
    }
    
  } catch (error) {
    console.error('Error checking service areas:', error);
  } finally {
    await pool.end();
  }
}

checkServiceAreas();