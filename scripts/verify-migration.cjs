const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

// Source and target DB connections
const sourceConnStr = process.env.SOURCE_DATABASE_URL || 
  "postgres://neondb_owner:UbM0xnPgitxO@ep-sparkling-sound-a6f8kyru.us-west-2.aws.neon.tech/neondb";

const sourcePool = new Pool({
  connectionString: sourceConnStr,
  ssl: {
    rejectUnauthorized: false
  }
});

const targetPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// List of tables to verify
const tablesToVerify = [
  'users',
  'contractor_profiles',
  'landlord_profiles',
  'jobs',
  'bids',
  'chat_rooms',
  'chat_participants',
  'messages',
  'quotes',
  'quote_line_items',
  'invoices',
  'invoice_line_items',
  'reviews',
  'transactions',
  'waitlist_entries'
];

async function verifyMigration() {
  console.log('Verifying data migration...');
  let report = '# Data Migration Verification Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '| Table | Source Count | Target Count | Status |\n';
  report += '|-------|--------------|--------------|--------|\n';
  
  try {
    for (const tableName of tablesToVerify) {
      // Check if table exists in source
      const { rows: sourceTableExists } = await sourcePool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      // Check if table exists in target
      const { rows: targetTableExists } = await targetPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      if (!sourceTableExists[0].exists) {
        console.log(`Table ${tableName} does not exist in source database`);
        report += `| ${tableName} | N/A | N/A | ⚠️ Table not in source |\n`;
        continue;
      }
      
      if (!targetTableExists[0].exists) {
        console.log(`Table ${tableName} does not exist in target database`);
        report += `| ${tableName} | N/A | N/A | ❌ Table not in target |\n`;
        continue;
      }
      
      // Get count of records in source
      const { rows: sourceCount } = await sourcePool.query(`
        SELECT COUNT(*) as count FROM "${tableName}"
      `);
      
      // Get count of records in target
      const { rows: targetCount } = await targetPool.query(`
        SELECT COUNT(*) as count FROM "${tableName}"
      `);
      
      const sourceRecords = parseInt(sourceCount[0].count);
      const targetRecords = parseInt(targetCount[0].count);
      const status = sourceRecords === targetRecords ? '✅ Complete' : 
                    (targetRecords > 0 ? '⚠️ Partial' : '❌ Missing');
      
      console.log(`Table ${tableName}: Source=${sourceRecords}, Target=${targetRecords}, Status=${status}`);
      report += `| ${tableName} | ${sourceRecords} | ${targetRecords} | ${status} |\n`;
    }
    
    // Write report to file
    fs.writeFileSync('./migration-verification-report.md', report);
    console.log('Verification complete! Report saved to migration-verification-report.md');
  } catch (error) {
    console.error('Error verifying migration:', error);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

verifyMigration();