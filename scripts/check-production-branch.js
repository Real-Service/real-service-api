import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Parse the DATABASE_URL to modify it for production
const originalUrl = new URL(process.env.DATABASE_URL);
const hostname = originalUrl.hostname;

// Convert to production pooler if needed
let productionUrl;
if (hostname.includes('pooler')) {
  console.log('Current connection is already using a pooler endpoint');
  productionUrl = process.env.DATABASE_URL;
} else {
  // Example conversion: 
  // from: ep-cool-fire-12345.us-east-1.aws.neon.tech
  // to:   ep-cool-fire-12345-pooler.us-east-1.aws.neon.tech
  const hostParts = hostname.split('.');
  const baseName = hostParts[0];
  hostParts[0] = `${baseName}-pooler`;
  const poolerHostname = hostParts.join('.');
  
  // Create new URL with pooler hostname
  const newUrl = new URL(process.env.DATABASE_URL);
  newUrl.hostname = poolerHostname;
  productionUrl = newUrl.toString();
  
  console.log('Converted development endpoint to production pooler endpoint');
}

console.log('Production URL (redacted):', productionUrl.replace(/:[^:]*@/, ':***@'));

// Create pool with production URL
const pool = new pg.Pool({
  connectionString: productionUrl,
  ssl: { rejectUnauthorized: false }
});

async function checkProductionBranch() {
  try {
    console.log('\nChecking production branch database:');
    
    // Test connection
    const connectionTest = await pool.query('SELECT 1 as test');
    console.log('Connection successful:', connectionTest.rows[0].test === 1 ? 'Yes' : 'No');
    
    // Count users
    const userResult = await pool.query('SELECT COUNT(*) FROM users');
    console.log('Total users in production database:', userResult.rows[0].count);
    
    if (parseInt(userResult.rows[0].count) === 0) {
      console.log('\n🚨 CONFIRMED: Production database has 0 users.');
      console.log('This is why login fails in production deployment.');
    } else {
      console.log('\n✅ Found users in production database. Listing first 5:');
      const sampleUsers = await pool.query('SELECT id, email, username, "userType" FROM users ORDER BY id LIMIT 5');
      sampleUsers.rows.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Type: ${user.userType}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking production database:', error);
  } finally {
    await pool.end();
  }
}

checkProductionBranch();