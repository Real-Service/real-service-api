import pg from 'pg';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Development database (the one with users)
const DEV_DATABASE_URL = process.env.DATABASE_URL;

// Production database (the one without users)
const PROD_DATABASE_URL = 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Create pools for both databases
const devPool = new pg.Pool({
  connectionString: DEV_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const prodPool = new pg.Pool({
  connectionString: PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrateUsersToProd() {
  try {
    console.log('Starting user migration from development to production database...');
    console.log('Dev DB (redacted):', DEV_DATABASE_URL.replace(/:[^:]*@/, ':***@'));
    console.log('Prod DB (redacted):', PROD_DATABASE_URL.replace(/:[^:]*@/, ':***@'));
    
    // 1. Test both connections
    console.log('\nTesting connections...');
    const devTest = await devPool.query('SELECT 1 as test');
    const prodTest = await prodPool.query('SELECT 1 as test');
    console.log('Development DB connection:', devTest.rows[0].test === 1 ? 'Success' : 'Failed');
    console.log('Production DB connection:', prodTest.rows[0].test === 1 ? 'Success' : 'Failed');
    
    // 2. Get users from development database
    console.log('\nQuerying users from development database...');
    const devUsers = await devPool.query(`
      SELECT * FROM users ORDER BY id
    `);
    console.log(`Found ${devUsers.rows.length} users in development database`);
    
    // 3. Insert each user into production database
    console.log('\nInserting users into production database...');
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of devUsers.rows) {
      try {
        // Check if user already exists in production
        const existingUser = await prodPool.query(
          'SELECT id FROM users WHERE username = $1 OR email = $2',
          [user.username, user.email]
        );
        
        if (existingUser.rows.length > 0) {
          console.log(`User ${user.username} (${user.email}) already exists in production. Skipping.`);
          continue;
        }
        
        // Get all column names excluding id (which is auto-generated)
        const columns = Object.keys(user).filter(col => col !== 'id');
        
        // Build the query
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = columns.map(col => `"${col}"`).join(', ');
        const values = columns.map(col => user[col]);
        
        const query = `
          INSERT INTO users (${columnNames})
          VALUES (${placeholders})
          RETURNING id
        `;
        
        const result = await prodPool.query(query, values);
        console.log(`✓ Migrated user ${user.username} (${user.email}) with ID ${result.rows[0].id}`);
        successCount++;
        
      } catch (err) {
        console.error(`Error migrating user ${user.username}:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`\nMigration complete: ${successCount} users successfully migrated, ${errorCount} failures`);
    
    // 4. Verify users in production database
    const prodUsers = await prodPool.query('SELECT COUNT(*) FROM users');
    console.log(`Total users in production database after migration: ${prodUsers.rows[0].count}`);
    
    // 5. List sample users from production
    if (parseInt(prodUsers.rows[0].count) > 0) {
      const sampleUsers = await prodPool.query('SELECT id, username, email, "userType" FROM users ORDER BY id LIMIT 5');
      console.log('\nSample users from production database:');
      sampleUsers.rows.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Type: ${user.userType}`);
      });
    }
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

migrateUsersToProd();