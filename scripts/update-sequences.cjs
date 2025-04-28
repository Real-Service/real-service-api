const { Pool } = require('pg');
require('dotenv').config();

// Target DB connection
const targetPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateSequences() {
  console.log('Updating sequences for all tables...');
  
  try {
    // Get all tables with ID columns
    const { rows: tables } = await targetPool.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE column_name = 'id'
      AND table_schema = 'public'
    `);
    
    for (const { table_name } of tables) {
      console.log(`Updating sequence for table: ${table_name}`);
      
      // Get the max ID from the table
      const { rows: maxIdResult } = await targetPool.query(`
        SELECT COALESCE(MAX(id), 0) as max_id
        FROM "${table_name}"
      `);
      
      const maxId = maxIdResult[0].max_id;
      
      // Update the sequence
      if (maxId > 0) {
        await targetPool.query(`
          SELECT setval(pg_get_serial_sequence('"${table_name}"', 'id'), ${maxId})
        `);
        console.log(`Set sequence for table "${table_name}" to ${maxId}`);
      } else {
        console.log(`No data in table "${table_name}", skipping sequence update`);
      }
    }
    
    console.log('All sequences updated successfully!');
  } catch (error) {
    console.error('Error updating sequences:', error);
  } finally {
    await targetPool.end();
  }
}

updateSequences();