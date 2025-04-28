import pg from 'pg';

const PROD_DATABASE_URL = 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Create pool with production URL
const pool = new pg.Pool({
  connectionString: PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkProductionDatabase() {
  try {
    console.log('Checking the .env production database:');
    console.log('Connection URL (redacted):', PROD_DATABASE_URL.replace(/:[^:]*@/, ':***@'));
    
    // Test connection
    const connectionTest = await pool.query('SELECT 1 as test');
    console.log('Connection successful:', connectionTest.rows[0].test === 1 ? 'Yes' : 'No');
    
    // Count and list tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`\nFound ${tablesResult.rows.length} tables in the database:`);
    console.log(tablesResult.rows.map(row => row.table_name).join(', '));
    
    // Check for users table
    const userTableExists = tablesResult.rows.some(row => row.table_name === 'users');
    if (userTableExists) {
      // Count users
      const userResult = await pool.query('SELECT COUNT(*) FROM users');
      console.log('\nTotal users in production database:', userResult.rows[0].count);
      
      if (parseInt(userResult.rows[0].count) === 0) {
        console.log('\n🚨 CONFIRMED: Production database in .env has 0 users.');
      } else {
        console.log('\n✅ Found users in production database. Listing first 5:');
        try {
          const sampleUsers = await pool.query('SELECT id, email, username, "userType" FROM users ORDER BY id LIMIT 5');
          sampleUsers.rows.forEach(user => {
            console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Type: ${user.userType}`);
          });
        } catch (columnError) {
          // Try with different column name format
          try {
            const sampleUsers = await pool.query('SELECT id, email, username, user_type FROM users ORDER BY id LIMIT 5');
            sampleUsers.rows.forEach(user => {
              console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Type: ${user.user_type}`);
            });
          } catch (secondError) {
            console.error('Error querying users:', secondError);
            // Just get basic info without type
            const sampleUsers = await pool.query('SELECT id, email, username FROM users ORDER BY id LIMIT 5');
            sampleUsers.rows.forEach(user => {
              console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
            });
          }
        }
      }
    } else {
      console.log('\n🚨 CRITICAL: No "users" table found in the production database!');
    }
    
  } catch (error) {
    console.error('Error checking production database:', error);
  } finally {
    await pool.end();
  }
}

checkProductionDatabase();