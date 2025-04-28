import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

// Configure neonConfig
neonConfig.webSocketConstructor = ws;

// Create a new pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateContractorProfilesSchema() {
  const client = await pool.connect();
  console.log('Connected to database');
  
  try {
    await client.query('BEGIN');
    
    // Check if columns already exist to prevent errors
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contractor_profiles' 
      AND column_name IN ('trades', 'experience', 'hourly_rate', 'has_liability_insurance', 
                          'insurance_coverage', 'payment_methods', 'warranty', 'languages', 'portfolio');
    `;
    
    const { rows } = await client.query(checkColumnsQuery);
    const existingColumns = rows.map(row => row.column_name);
    
    console.log('Existing columns:', existingColumns);
    
    // Add each column if it doesn't exist
    const columnsToAdd = [
      { name: 'trades', type: 'jsonb', default: '[]' },
      { name: 'experience', type: 'text', default: null },
      { name: 'hourly_rate', type: 'double precision', default: null },
      { name: 'has_liability_insurance', type: 'boolean', default: false },
      { name: 'insurance_coverage', type: 'text', default: null },
      { name: 'payment_methods', type: 'jsonb', default: '[]' },
      { name: 'warranty', type: 'text', default: null },
      { name: 'languages', type: 'jsonb', default: '[]' },
      { name: 'portfolio', type: 'jsonb', default: '[]' }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`Adding column ${column.name}`);
        const defaultValue = column.default === null ? 'NULL' : 
                            (column.type === 'jsonb' || column.type === 'json') ? `'${column.default}'::${column.type}` : 
                            column.type === 'boolean' ? column.default : 
                            column.default === null ? 'NULL' : `'${column.default}'`;
        
        await client.query(`
          ALTER TABLE contractor_profiles 
          ADD COLUMN ${column.name} ${column.type} DEFAULT ${defaultValue}
        `);
        console.log(`Column ${column.name} added successfully`);
      } else {
        console.log(`Column ${column.name} already exists, skipping`);
      }
    }
    
    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    console.log('Database connection released');
  }
}

// Execute the migration
updateContractorProfilesSchema()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });