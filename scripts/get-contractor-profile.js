/**
 * Script to check if we can access the contractor profile data for a specific user
 */

import pg from 'pg';
const { Pool } = pg;

async function getContractorProfile() {
  // Create pool for production database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get contractor with username 'contractor 10'
    console.log('Getting user with username "contractor 10"...');
    const userResult = await pool.query(`
      SELECT * FROM users WHERE username = $1
    `, ['contractor 10']);
    
    if (userResult.rows.length === 0) {
      console.log('User not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('User found:');
    console.log(`- ID: ${user.id}`);
    console.log(`- Username: ${user.username}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Full Name: ${user.fullName}`);
    console.log(`- User Type: ${user.userType}`);
    
    // Get contractor profile
    console.log('\nGetting contractor profile...');
    const profileResult = await pool.query(`
      SELECT * FROM contractor_profiles WHERE "userId" = $1
    `, [user.id]);
    
    if (profileResult.rows.length === 0) {
      console.log('Profile not found. Creating default profile...');
      
      // Create contractor profile with default data
      const createResult = await pool.query(`
        INSERT INTO contractor_profiles 
        ("userId", bio, skills, "serviceArea", "walletBalance", "averageRating", 
         "totalRatings", "serviceRadius", "hasLiabilityInsurance", "businessName")
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
      
      console.log(`Created profile with ID: ${createResult.rows[0].id}`);
      
      // Get the newly created profile
      const newProfileResult = await pool.query(`
        SELECT * FROM contractor_profiles WHERE "userId" = $1
      `, [user.id]);
      
      if (newProfileResult.rows.length > 0) {
        const profile = newProfileResult.rows[0];
        console.log('\nNew Profile Data:');
        console.log(`- Profile ID: ${profile.id}`);
        console.log(`- Bio: ${profile.bio}`);
        console.log(`- Skills: ${JSON.stringify(profile.skills)}`);
        console.log(`- Service Area: ${JSON.stringify(profile.serviceArea)}`);
        console.log(`- Business Name: ${profile.businessName}`);
      }
    } else {
      const profile = profileResult.rows[0];
      console.log('Profile found:');
      console.log(`- Profile ID: ${profile.id}`);
      console.log(`- Bio: ${profile.bio || 'Not set'}`);
      console.log(`- Skills: ${JSON.stringify(profile.skills) || 'Not set'}`);
      console.log(`- Service Area: ${JSON.stringify(profile.serviceArea) || 'Not set'}`);
      console.log(`- Business Name: ${profile.businessName || 'Not set'}`);
      
      // Update some profile fields if needed
      if (!profile.bio || !profile.skills || !profile.businessName) {
        console.log('\nUpdating missing profile fields...');
        
        const updates = {};
        if (!profile.bio) updates.bio = `Professional contractor with experience in home renovation and repairs.`;
        if (!profile.skills) updates.skills = JSON.stringify(['General Contracting', 'Repairs', 'Maintenance']);
        if (!profile.businessName) updates.businessName = `${user.username} Services`;
        
        if (Object.keys(updates).length > 0) {
          let updateQuery = 'UPDATE contractor_profiles SET ';
          const values = [];
          let i = 1;
          
          for (const [key, value] of Object.entries(updates)) {
            updateQuery += `"${key}" = $${i}${i < Object.keys(updates).length ? ', ' : ''}`;
            values.push(value);
            i++;
          }
          
          updateQuery += ` WHERE "userId" = $${i} RETURNING id`;
          values.push(user.id);
          
          const updateResult = await pool.query(updateQuery, values);
          console.log(`Updated profile with ID: ${updateResult.rows[0].id}`);
          
          // Get the updated profile
          const updatedProfileResult = await pool.query(`
            SELECT * FROM contractor_profiles WHERE "userId" = $1
          `, [user.id]);
          
          if (updatedProfileResult.rows.length > 0) {
            const updatedProfile = updatedProfileResult.rows[0];
            console.log('\nUpdated Profile Data:');
            console.log(`- Profile ID: ${updatedProfile.id}`);
            console.log(`- Bio: ${updatedProfile.bio}`);
            console.log(`- Skills: ${JSON.stringify(updatedProfile.skills)}`);
            console.log(`- Service Area: ${JSON.stringify(updatedProfile.serviceArea)}`);
            console.log(`- Business Name: ${updatedProfile.businessName}`);
          }
        } else {
          console.log('No fields need updating.');
        }
      } else {
        console.log('All profile fields are set. No updates needed.');
      }
    }
  } catch (error) {
    console.error('Error getting contractor profile:', error);
  } finally {
    await pool.end();
  }
}

getContractorProfile();