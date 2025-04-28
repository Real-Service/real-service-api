import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

// Create a new pool with the connection string
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function listUsers() {
  const client = await pool.connect();
  
  try {
    console.log('Listing all users in the database:');
    console.log('=================================');
    
    // Get all users
    const userResult = await client.query(`
      SELECT id, username, email, full_name as "fullName", user_type as "userType", phone, created_at as "createdAt", updated_at as "updatedAt" 
      FROM users
      ORDER BY id
    `);
    
    if (userResult.rows.length === 0) {
      console.log('No users found in the database.');
      return;
    }
    
    // Display each user
    for (const user of userResult.rows) {
      console.log(`\nUser ID: ${user.id}`);
      console.log(`Username: ${user.username}`);
      console.log(`Email: ${user.email}`);
      console.log(`Full Name: ${user.fullName}`);
      console.log(`User Type: ${user.userType}`);
      console.log(`Phone: ${user.phone || 'N/A'}`);
      console.log(`Created: ${user.createdAt}`);
      console.log(`Last Updated: ${user.updatedAt}`);
      
      // Get profile information based on user type
      if (user.userType === 'landlord') {
        const profileResult = await client.query(
          `SELECT 
            id, 
            user_id as "userId", 
            wallet_balance as "walletBalance", 
            average_rating as "averageRating", 
            total_ratings as "totalRatings"
          FROM landlord_profiles 
          WHERE user_id = $1`,
          [user.id]
        );
        
        if (profileResult.rows.length > 0) {
          const profile = profileResult.rows[0];
          console.log('Landlord Profile:');
          console.log(`  Profile ID: ${profile.id}`);
          console.log(`  Wallet Balance: $${profile.walletBalance}`);
          console.log(`  Average Rating: ${profile.averageRating || 'No ratings yet'}`);
          console.log(`  Total Ratings: ${profile.totalRatings}`);
        } else {
          console.log('No landlord profile found for this user.');
        }
      } else if (user.userType === 'contractor') {
        const profileResult = await client.query(
          `SELECT 
            id, 
            user_id as "userId", 
            wallet_balance as "walletBalance", 
            average_rating as "averageRating", 
            total_ratings as "totalRatings",
            business_name as "businessName",
            service_radius as "serviceRadius"
          FROM contractor_profiles 
          WHERE user_id = $1`,
          [user.id]
        );
        
        if (profileResult.rows.length > 0) {
          const profile = profileResult.rows[0];
          console.log('Contractor Profile:');
          console.log(`  Profile ID: ${profile.id}`);
          console.log(`  Business Name: ${profile.businessName || 'Not set'}`);
          console.log(`  Wallet Balance: $${profile.walletBalance}`);
          console.log(`  Average Rating: ${profile.averageRating || 'No ratings yet'}`);
          console.log(`  Total Ratings: ${profile.totalRatings}`);
          console.log(`  Service Radius: ${profile.serviceRadius} miles`);
        } else {
          console.log('No contractor profile found for this user.');
        }
      }
      
      console.log('=================================');
    }
    
    console.log(`\nTotal users: ${userResult.rows.length}`);
    
  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the query
listUsers();