import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

// Create a new pool with the connection string
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// Generate a unique invoice number
function generateInvoiceNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${timestamp}-${random}`;
}

async function importInvoices() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting invoice import...');
    
    // Check if invoices table exists, if not create it
    const checkTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'invoices'
      )
    `);
    
    // Get quotes to convert to invoices
    const quoteResult = await client.query(`
      SELECT q.id, q.landlord_id, q.contractor_id, q.job_id, q.title, q.subtotal, q.total, q.tax_rate, q.tax_amount,
             q.discount, q.notes, q.terms
      FROM quotes q
      WHERE q.id = 1  -- Just convert the first quote for now
    `);
    
    if (quoteResult.rows.length === 0) {
      console.log('No quotes found to convert to invoices.');
      return;
    }
    
    // Get line items for the quotes
    const quoteIds = quoteResult.rows.map(row => row.id);
    const lineItemsResult = await client.query(`
      SELECT qli.quote_id, qli.description, qli.quantity, qli.unit_price, qli.total, qli.sort_order
      FROM quote_line_items qli
      WHERE qli.quote_id = ANY($1)
    `, [quoteIds]);
    
    // Group line items by quote_id
    const lineItemsByQuoteId = {};
    for (const item of lineItemsResult.rows) {
      if (!lineItemsByQuoteId[item.quote_id]) {
        lineItemsByQuoteId[item.quote_id] = [];
      }
      lineItemsByQuoteId[item.quote_id].push(item);
    }
    
    // Create invoices from quotes
    for (const quote of quoteResult.rows) {
      const invoiceNumber = generateInvoiceNumber();
      
      // Insert invoice
      const result = await client.query(
        `INSERT INTO invoices (
          title, landlord_id, contractor_id, job_id, quote_id, status,
          invoice_number, subtotal, tax_rate, tax_amount, total,
          notes, terms, due_date, created_at, updated_at,
          amount_paid, issued_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW(), $15, NOW())
        RETURNING id`,
        [
          quote.title,
          quote.landlord_id,
          quote.contractor_id,
          quote.job_id,
          quote.id,
          'sent',
          invoiceNumber,
          quote.subtotal,
          quote.tax_rate,
          quote.tax_amount,
          quote.total,
          quote.notes,
          quote.terms,
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Due in 14 days
          0 // amount_paid
        ]
      );
      
      const invoiceId = result.rows[0].id;
      
      // Get line items for this quote
      const lineItems = lineItemsByQuoteId[quote.id] || [];
      
      // Insert line items for the invoice
      for (const item of lineItems) {
        await client.query(
          `INSERT INTO invoice_line_items (
            description, invoice_id, quantity, unit_price, total, sort_order, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            item.description,
            invoiceId,
            item.quantity,
            item.unit_price,
            item.total,
            item.sort_order
          ]
        );
      }
      
      console.log(`Created invoice '${quote.title}' with ID ${invoiceId} for contractor ${quote.contractor_id} and landlord ${quote.landlord_id}`);
    }
    
    await client.query('COMMIT');
    console.log('Invoice import completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing invoices:', error);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
importInvoices();