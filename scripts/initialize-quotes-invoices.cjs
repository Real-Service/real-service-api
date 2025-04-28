const { Pool } = require('pg');
require('dotenv').config();

// Target DB connection
const targetPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initializeQuotesInvoices() {
  console.log('Initializing quotes and invoices tables...');
  
  try {
    // Drop existing tables if they exist
    console.log('Checking for existing tables...');
    await targetPool.query('DROP TABLE IF EXISTS invoice_line_items CASCADE');
    await targetPool.query('DROP TABLE IF EXISTS invoices CASCADE');
    await targetPool.query('DROP TABLE IF EXISTS quote_line_items CASCADE');
    await targetPool.query('DROP TABLE IF EXISTS quotes CASCADE');
    
    // Create the quotes table
    console.log('Creating quotes table...');
    await targetPool.query(`
      CREATE TABLE quotes (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        landlord_id INTEGER NOT NULL REFERENCES users(id),
        contractor_id INTEGER NOT NULL REFERENCES users(id),
        job_id INTEGER REFERENCES jobs(id),
        total NUMERIC NOT NULL,
        subtotal NUMERIC NOT NULL,
        tax_rate NUMERIC DEFAULT 0,
        tax_amount NUMERIC DEFAULT 0,
        discount_amount NUMERIC DEFAULT 0,
        quote_number TEXT,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        payment_terms TEXT,
        terms_and_conditions TEXT,
        valid_until TIMESTAMP,
        sent_at TIMESTAMP,
        viewed_at TIMESTAMP,
        payment_methods JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create the quote_line_items table
    console.log('Creating quote_line_items table...');
    await targetPool.query(`
      CREATE TABLE quote_line_items (
        id SERIAL PRIMARY KEY,
        quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity NUMERIC DEFAULT 1,
        unit_price NUMERIC NOT NULL,
        total NUMERIC NOT NULL,
        sort_order INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create the invoices table
    console.log('Creating invoices table...');
    await targetPool.query(`
      CREATE TABLE invoices (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        landlord_id INTEGER NOT NULL REFERENCES users(id),
        contractor_id INTEGER NOT NULL REFERENCES users(id),
        job_id INTEGER REFERENCES jobs(id),
        quote_id INTEGER REFERENCES quotes(id),
        total NUMERIC NOT NULL,
        subtotal NUMERIC NOT NULL,
        tax_rate NUMERIC DEFAULT 0,
        tax_amount NUMERIC DEFAULT 0,
        amount_paid NUMERIC DEFAULT 0,
        discount_amount NUMERIC DEFAULT 0,
        invoice_number TEXT,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        due_date TIMESTAMP,
        payment_terms TEXT,
        payment_details TEXT,
        sent_at TIMESTAMP,
        paid_at TIMESTAMP,
        viewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create the invoice_line_items table
    console.log('Creating invoice_line_items table...');
    await targetPool.query(`
      CREATE TABLE invoice_line_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity NUMERIC DEFAULT 1,
        unit_price NUMERIC NOT NULL,
        total NUMERIC NOT NULL,
        sort_order INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('Quotes and invoices tables initialized successfully!');
  } catch (error) {
    console.error('Error initializing quotes and invoices tables:', error);
  } finally {
    await targetPool.end();
  }
}

initializeQuotesInvoices();