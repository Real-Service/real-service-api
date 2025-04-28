import pg from 'pg';
const { Pool } = pg;

async function checkUserProfiles() {
  // Create pool for production database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get user table structure
    console.log('CHECKING USER TABLE STRUCTURE');
    const tableStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    console.log('User table columns:');
    tableStructure.rows.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type})`);
    });
    
    // Check for related profile tables
    console.log('\nCHECKING OTHER PROFILE-RELATED TABLES');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Find tables that might contain profile information
    const profileTables = tables.rows
      .map(t => t.table_name)
      .filter(t => 
        t.includes('profile') || 
        t.includes('contractor') || 
        t.includes('landlord') || 
        t.includes('address') ||
        t.includes('bio')
      );
    
    console.log('Potential profile-related tables:');
    if (profileTables.length > 0) {
      profileTables.forEach(table => console.log(`- ${table}`));
      
      // For each table, get its structure
      for (const table of profileTables) {
        const tableColumns = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [table]);
        
        console.log(`\nColumns in ${table}:`);
        tableColumns.rows.forEach(col => {
          console.log(`- ${col.column_name} (${col.data_type})`);
        });
      }
    } else {
      console.log('No additional profile tables found');
    }
    
    // Get sample user data
    console.log('\nCHECKING USER PROFILE DATA');
    const users = await pool.query(`
      SELECT * FROM users LIMIT 5
    `);
    
    console.log('Sample user data:');
    users.rows.forEach(user => {
      console.log(`\nUser ID: ${user.id}, Username: ${user.username}`);
      
      // Print all user fields
      for (const [key, value] of Object.entries(user)) {
        if (key !== 'password') { // Don't print passwords
          console.log(`- ${key}: ${value}`);
        }
      }
    });
    
    // Check for any related profile records
    if (profileTables.length > 0) {
      for (const table of profileTables) {
        // Check if the table has userId column
        const tableColumns = await pool.query(`
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [table]);
        
        const columns = tableColumns.rows.map(c => c.column_name);
        
        // Find the user ID column (could be userId, user_id, etc.)
        const userIdColumn = columns.find(c => 
          c.toLowerCase().includes('user') && c.toLowerCase().includes('id')
        );
        
        if (userIdColumn) {
          console.log(`\nChecking ${table} records using ${userIdColumn}:`);
          
          // Get sample records
          const relatedRecords = await pool.query(`
            SELECT * FROM "${table}" LIMIT 5
          `);
          
          if (relatedRecords.rows.length > 0) {
            relatedRecords.rows.forEach(record => {
              console.log(`\nRecord for User ID: ${record[userIdColumn]}`);
              for (const [key, value] of Object.entries(record)) {
                console.log(`- ${key}: ${value}`);
              }
            });
          } else {
            console.log(`No records found in ${table}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking user profiles:', error);
  } finally {
    await pool.end();
  }
}

checkUserProfiles();