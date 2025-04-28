import pg from 'pg';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Get the current DATABASE_URL from environment
const currentDbUrl = process.env.DATABASE_URL;

// Production database URL from .env
const prodDbUrl = 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Function to identify database type from URL
function identifyDatabaseType(url) {
  const dbUrl = new URL(url);
  const hostname = dbUrl.hostname;
  
  if (hostname.includes('dark-bird-a4xtgivw')) {
    return 'PRODUCTION (us-east-1)';
  } else if (hostname.includes('sparkling-sound-a6f8kyru')) {
    return 'DEVELOPMENT (us-west-2)';
  } else {
    return 'UNKNOWN';
  }
}

async function checkCurrentConnection() {
  // Create pool with current environment URL
  const pool = new pg.Pool({
    connectionString: currentDbUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 Checking current database connection...');
    console.log('\nCurrent DATABASE_URL (redacted):', currentDbUrl.replace(/:[^:]*@/, ':***@'));
    console.log('Database Type:', identifyDatabaseType(currentDbUrl));
    
    if (currentDbUrl === prodDbUrl) {
      console.log('\n✅ Your application is correctly using the PRODUCTION database.');
    } else {
      console.log('\n⚠️ Your application is using a DIFFERENT database than the production one.');
      console.log('This means login credentials from one environment will not work in the other.');
    }
    
    // Test connection and get user count
    await pool.query('SELECT 1');
    const userResult = await pool.query('SELECT COUNT(*) FROM users');
    
    console.log(`\nUsers in current database: ${userResult.rows[0].count}`);
    
    if (parseInt(userResult.rows[0].count) === 0) {
      console.log('⚠️ WARNING: Current database has 0 users. Login will not work!');
    } else {
      // Show sample users from current database
      let usersQuery;
      try {
        usersQuery = await pool.query('SELECT id, username, email, "userType" AS type FROM users ORDER BY id LIMIT 5');
      } catch (err) {
        usersQuery = await pool.query('SELECT id, username, email, user_type AS type FROM users ORDER BY id LIMIT 5');
      }
      
      console.log('\nSample users from current database:');
      usersQuery.rows.forEach(user => {
        console.log(`- Username: ${user.username}, Email: ${user.email}, Type: ${user.type}`);
      });
      
      if (currentDbUrl !== prodDbUrl) {
        console.log('\n🔄 To use the production database with test users:');
        console.log('1. Update your .env file with the following connection string:');
        console.log('export DATABASE_URL=postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require');
        console.log('2. Restart your application');
        console.log('3. Use these credentials to login:');
        console.log('   - Username: testuser, Password: password123');
        console.log('   - Username: contractor, Password: password123');
        console.log('   - Username: landlord, Password: password123');
        console.log('   - Username: contractor10, Password: password');
      }
    }
    
  } catch (error) {
    console.error('Error checking database connection:', error);
  } finally {
    await pool.end();
  }
}

checkCurrentConnection();