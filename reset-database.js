// Simple utility script to reset the database
const fetch = require('node-fetch');

async function resetDatabase() {
  try {
    console.log('Attempting to reset database...');
    
    // Get the current hostname (works in both development and production)
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/reset-database`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (response.ok) {
      console.log('✅ Database reset successful! All jobs and bids have been deleted.');
    } else {
      console.error('❌ Failed to reset database:', data.message);
    }
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
  }
}

resetDatabase();