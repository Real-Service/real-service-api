// Simple script to reset the database
import { storage } from './server/storage.ts';

async function resetDatabase() {
  try {
    console.log('Starting database reset...');
    
    // Delete all bids first (due to foreign key constraints)
    await storage.deleteAllBids();
    console.log('All bids deleted successfully');
    
    // Then delete all jobs
    await storage.deleteAllJobs();
    console.log('All jobs deleted successfully');
    
    console.log('Database reset successful! All jobs and bids have been deleted.');
  } catch (error) {
    console.error('Error resetting database:', error);
  }
}

// Run the reset function
resetDatabase();