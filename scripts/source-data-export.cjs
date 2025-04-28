const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

// Get connection string from environment variables
const sourceConnStr = process.env.SOURCE_DATABASE_URL || 
  "postgres://neondb_owner:UbM0xnPgitxO@ep-sparkling-sound-a6f8kyru.us-west-2.aws.neon.tech/neondb";

// Source DB connection
const sourcePool = new Pool({
  connectionString: sourceConnStr,
  ssl: {
    rejectUnauthorized: false
  }
});

async function exportSourceData() {
  console.log('Exporting data from source database...');
  
  try {
    const data = {
      users: [],
      contractor_profiles: [],
      landlord_profiles: [],
      jobs: [],
      bids: [],
      chat_rooms: [],
      chat_participants: [],
      messages: [],
      quotes: [],
      quote_line_items: [],
      invoices: [],
      invoice_line_items: []
    };
    
    // Get all users
    console.log('Fetching users...');
    const { rows: users } = await sourcePool.query('SELECT * FROM users');
    data.users = users;
    
    // Get all contractor profiles
    console.log('Fetching contractor profiles...');
    const { rows: contractorProfiles } = await sourcePool.query('SELECT * FROM contractor_profiles');
    data.contractor_profiles = contractorProfiles;
    
    // Get all landlord profiles
    console.log('Fetching landlord profiles...');
    const { rows: landlordProfiles } = await sourcePool.query('SELECT * FROM landlord_profiles');
    data.landlord_profiles = landlordProfiles;
    
    // Get all jobs
    console.log('Fetching jobs...');
    const { rows: jobs } = await sourcePool.query('SELECT * FROM jobs');
    data.jobs = jobs;
    
    // Get all bids
    console.log('Fetching bids...');
    const { rows: bids } = await sourcePool.query('SELECT * FROM bids');
    data.bids = bids;
    
    // Get all chat rooms
    console.log('Fetching chat rooms...');
    const { rows: chatRooms } = await sourcePool.query('SELECT * FROM chat_rooms');
    data.chat_rooms = chatRooms;
    
    // Get all chat participants
    console.log('Fetching chat participants...');
    const { rows: chatParticipants } = await sourcePool.query('SELECT * FROM chat_participants');
    data.chat_participants = chatParticipants;
    
    // Get all messages
    console.log('Fetching messages...');
    const { rows: messages } = await sourcePool.query('SELECT * FROM messages');
    data.messages = messages;
    
    // Get all quotes
    console.log('Fetching quotes...');
    const { rows: quotes } = await sourcePool.query('SELECT * FROM quotes');
    data.quotes = quotes;
    
    // Get all quote line items
    console.log('Fetching quote line items...');
    const { rows: quoteLineItems } = await sourcePool.query('SELECT * FROM quote_line_items');
    data.quote_line_items = quoteLineItems;
    
    // Get all invoices
    console.log('Fetching invoices...');
    const { rows: invoices } = await sourcePool.query('SELECT * FROM invoices');
    data.invoices = invoices;
    
    // Get all invoice line items
    console.log('Fetching invoice line items...');
    const { rows: invoiceLineItems } = await sourcePool.query('SELECT * FROM invoice_line_items');
    data.invoice_line_items = invoiceLineItems;
    
    // Write to file
    console.log('Writing data to file...');
    fs.writeFileSync('./source-data.json', JSON.stringify(data, null, 2));
    
    console.log('Data export completed successfully!');
    console.log('Summary:');
    console.log(`- Users: ${data.users.length}`);
    console.log(`- Contractor profiles: ${data.contractor_profiles.length}`);
    console.log(`- Landlord profiles: ${data.landlord_profiles.length}`);
    console.log(`- Jobs: ${data.jobs.length}`);
    console.log(`- Bids: ${data.bids.length}`);
    console.log(`- Chat rooms: ${data.chat_rooms.length}`);
    console.log(`- Chat participants: ${data.chat_participants.length}`);
    console.log(`- Messages: ${data.messages.length}`);
    console.log(`- Quotes: ${data.quotes.length}`);
    console.log(`- Quote line items: ${data.quote_line_items.length}`);
    console.log(`- Invoices: ${data.invoices.length}`);
    console.log(`- Invoice line items: ${data.invoice_line_items.length}`);
  } catch (error) {
    console.error('Error exporting data:', error);
  } finally {
    await sourcePool.end();
  }
}

exportSourceData();