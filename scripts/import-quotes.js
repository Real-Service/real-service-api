import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

// Create a new pool with the connection string
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// Generate a unique quote number
function generateQuoteNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `Q-${timestamp}-${random}`;
}

async function importQuotes() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting quote import...');
    
    // Get landlord and contractor IDs
    const usersResult = await client.query(`
      SELECT id, user_type FROM users WHERE id IN (11, 12, 13, 14)
    `);
    
    if (usersResult.rows.length === 0) {
      console.log('Required users not found in the database. Cannot import quotes.');
      return;
    }
    
    const users = {};
    for (const row of usersResult.rows) {
      if (!users[row.user_type]) {
        users[row.user_type] = [];
      }
      users[row.user_type].push(row.id);
    }
    
    // Get job IDs
    const jobResult = await client.query(`
      SELECT id, landlord_id FROM jobs WHERE id IN (8, 9, 10, 11)
    `);
    
    if (jobResult.rows.length === 0) {
      console.log('Required jobs not found in the database. Cannot import quotes.');
      return;
    }
    
    const jobs = jobResult.rows;
    
    // Sample quote data for our contractors
    const quotesToCreate = [
      {
        title: 'Bathroom Faucet Repair',
        contractorId: 13, // mikeplumber
        landlordId: 11,  // johnlandlord
        jobId: 8, // Fix leaking bathroom faucet
        status: 'sent',
        quoteNumber: generateQuoteNumber(),
        subtotal: 125,
        taxRate: 0.08,
        taxAmount: 10,
        discountAmount: 0,
        total: 135,
        notes: 'This quote includes all materials needed for the repair. The work will be completed within 2-3 hours.',
        terms: 'Payment due within 30 days of invoice date. 1.5% monthly interest charged on late payments.',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        sentAt: new Date(),
        lineItems: [
          {
            description: 'Faucet repair labor',
            quantity: 1,
            unitPrice: 90,
            total: 90,
            sortOrder: 1
          },
          {
            description: 'Replacement parts',
            quantity: 1,
            unitPrice: 35,
            total: 35,
            sortOrder: 2
          }
        ]
      },
      {
        title: 'Ceiling Fan Installation',
        contractorId: 14, // electricianbob
        landlordId: 12,  // sarahlandlord
        jobId: 9, // Install ceiling fan in bedroom
        status: 'draft',
        quoteNumber: generateQuoteNumber(),
        subtotal: 180,
        taxRate: 0.08,
        taxAmount: 14.4,
        discountAmount: 10,
        total: 184.4,
        notes: 'This quote assumes existing wiring is in good condition and properly installed.',
        terms: 'Payment due within 14 days of invoice date. Work will be completed according to local electrical codes.',
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        lineItems: [
          {
            description: 'Electrician labor',
            quantity: 1.5,
            unitPrice: 100,
            total: 150,
            sortOrder: 1
          },
          {
            description: 'Mounting hardware',
            quantity: 1,
            unitPrice: 30,
            total: 30,
            sortOrder: 2
          }
        ]
      }
    ];
    
    // Import each quote
    for (const quote of quotesToCreate) {
      // Insert quote
      const result = await client.query(
        `INSERT INTO quotes (
          title, landlord_id, contractor_id, job_id, status, quote_number,
          subtotal, tax_rate, tax_amount, discount, total,
          notes, terms, valid_until, viewed_at, created_at, updated_at,
          payment_methods
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW(), $16)
        RETURNING id`,
        [
          quote.title,
          quote.landlordId,
          quote.contractorId,
          quote.jobId,
          quote.status,
          quote.quoteNumber,
          quote.subtotal,
          quote.taxRate,
          quote.taxAmount,
          quote.discountAmount,
          quote.total,
          quote.notes,
          quote.terms,
          quote.validUntil,
          null, // viewed_at
          '[]' // payment_methods
        ]
      );
      
      const quoteId = result.rows[0].id;
      
      // Insert line items
      for (const item of quote.lineItems) {
        await client.query(
          `INSERT INTO quote_line_items (
            description, quote_id, quantity, unit_price, total, sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            item.description,
            quoteId,
            item.quantity,
            item.unitPrice,
            item.total,
            item.sortOrder
          ]
        );
      }
      
      console.log(`Created quote '${quote.title}' with ID ${quoteId} for contractor ${quote.contractorId} and landlord ${quote.landlordId}`);
    }
    
    await client.query('COMMIT');
    console.log('Quote import completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing quotes:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
importQuotes();