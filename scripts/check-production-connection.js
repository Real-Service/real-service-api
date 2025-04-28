/**
 * Test production database connection
 */

import pg from 'pg';
const { Pool } = pg;

// Create production pool with correct settings
const productionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkProductionConnection() {
  console.log('Checking production database connection...');
  console.log('URL:', process.env.DATABASE_URL.replace(/\/\/(.+?):/g, '//[USERNAME]:'));

  try {
    // Test basic connection
    const result = await productionPool.query('SELECT NOW() as time');
    console.log('✅ Connection successful. Database time:', result.rows[0].time);
    
    // Count users
    const usersCount = await productionPool.query('SELECT COUNT(*) FROM users');
    console.log('✅ Total users:', usersCount.rows[0].count);
    
    // Count user types
    const userTypes = await productionPool.query(`
      SELECT "userType", COUNT(*) 
      FROM users 
      GROUP BY "userType"
    `);
    
    console.log('User types:');
    userTypes.rows.forEach(type => {
      console.log(`- ${type.userType}: ${type.count}`);
    });
    
    // Check for contractor 10
    const contractor = await productionPool.query(`
      SELECT id, username, email, "userType" 
      FROM users 
      WHERE username = $1
    `, ['contractor 10']);
    
    if (contractor.rows.length > 0) {
      console.log('✅ Found contractor 10:', {
        id: contractor.rows[0].id,
        username: contractor.rows[0].username,
        email: contractor.rows[0].email,
        userType: contractor.rows[0].usertype
      });
    } else {
      console.log('❌ Contractor 10 not found');
    }
    
    await productionPool.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('❌ Error connecting to production database:', error);
  }
}

// Run the check
checkProductionConnection();