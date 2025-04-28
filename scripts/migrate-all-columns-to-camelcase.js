import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function migrateAllColumnsToCamelCase() {
  try {
    console.log("Connecting to Neon database...");
    
    // Create TCP/SSL pg.Pool for guaranteed direct connection
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Test the connection
    const dbTest = await pool.query('SELECT NOW() as now');
    console.log(`Connected to database at: ${dbTest.rows[0].now}`);
    
    // Get all tables and their columns
    const allColumnsQuery = await pool.query(`
      SELECT 
        table_name,
        column_name 
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' AND
        table_name NOT IN ('users')  -- Skip users table as it's already migrated
      ORDER BY 
        table_name, column_name
    `);
    
    console.log(`Found ${allColumnsQuery.rows.length} columns to check across all tables.`);
    
    // Group columns by table
    const tableColumns = {};
    allColumnsQuery.rows.forEach(row => {
      if (!tableColumns[row.table_name]) {
        tableColumns[row.table_name] = [];
      }
      tableColumns[row.table_name].push(row.column_name);
    });
    
    // Process each table
    for (const [tableName, columns] of Object.entries(tableColumns)) {
      console.log(`\nProcessing table: ${tableName}`);
      
      // Look for snake_case columns to convert to camelCase
      const columnsToRename = columns.filter(col => col.includes('_'));
      
      if (columnsToRename.length === 0) {
        console.log(`  No columns to rename in ${tableName}`);
        continue;
      }
      
      console.log(`  Found ${columnsToRename.length} column(s) to rename in ${tableName}`);
      
      for (const snakeCaseColumn of columnsToRename) {
        // Convert snake_case to camelCase
        const camelCaseColumn = snakeCaseColumn.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        
        if (snakeCaseColumn === camelCaseColumn) {
          console.log(`  Skipping ${snakeCaseColumn} - already in correct format`);
          continue;
        }
        
        console.log(`  Renaming ${snakeCaseColumn} to ${camelCaseColumn}`);
        
        try {
          // Rename the column
          await pool.query(`
            ALTER TABLE "${tableName}" 
            RENAME COLUMN "${snakeCaseColumn}" TO "${camelCaseColumn}"
          `);
          console.log(`    ✓ Successfully renamed ${snakeCaseColumn} to ${camelCaseColumn}`);
        } catch (error) {
          console.error(`    ✗ Error renaming ${snakeCaseColumn}: ${error.message}`);
        }
      }
    }
    
    console.log("\nColumn renaming completed!");
    
    // Close the connection
    await pool.end();
    
  } catch (error) {
    console.error("Error migrating columns:", error);
    process.exit(1);
  }
}

migrateAllColumnsToCamelCase().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});