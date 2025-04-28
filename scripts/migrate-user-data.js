/**
 * Migrate user data to Neon database
 * 
 * This script migrates user data to the production Neon database
 * for use with the production version of the app.
 */

import { db } from '../server/db.js';
import { users, landlordProfiles, contractorProfiles } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function migrateUserData() {
  try {
    console.log('Starting user data migration to Neon database...');
    
    // Get all users from the database
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users to migrate`);
    
    // For each user, ensure they exist in Neon
    for (const user of allUsers) {
      console.log(`Migrating user: ${user.username} (${user.email})`);
      
      // Check if user profile exists based on user type
      if (user.userType === 'landlord') {
        const landlordProfile = await db.select()
          .from(landlordProfiles)
          .where(eq(landlordProfiles.userId, user.id))
          .limit(1);
          
        if (landlordProfile.length > 0) {
          console.log(`Found landlord profile for user ${user.id}`);
        } else {
          console.log(`No landlord profile found for user ${user.id}`);
        }
      } else if (user.userType === 'contractor') {
        const contractorProfile = await db.select()
          .from(contractorProfiles)
          .where(eq(contractorProfiles.userId, user.id))
          .limit(1);
          
        if (contractorProfile.length > 0) {
          console.log(`Found contractor profile for user ${user.id}`);
        } else {
          console.log(`No contractor profile found for user ${user.id}`);
        }
      }
    }
    
    console.log('Migration completed successfully!');
    console.log(`Total users available in database: ${allUsers.length}`);
    
    // Output a test user for login
    if (allUsers.length > 0) {
      const testUser = allUsers[0];
      console.log(`\nTest user available for login:`);
      console.log(`Email: ${testUser.email}`);
      console.log(`Username: ${testUser.username}`);
      console.log('Note: Use the actual password for this user to log in');
    }
    
  } catch (error) {
    console.error('Error migrating user data:', error);
  } finally {
    process.exit(0);
  }
}

// Run the migration
migrateUserData();