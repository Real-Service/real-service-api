import { 
  users, type User, type InsertUser, 
  waitlistEntries, type WaitlistEntry, type InsertWaitlistEntry,
  landlordProfiles, type LandlordProfile, type InsertLandlordProfile,
  contractorProfiles, type ContractorProfile, type InsertContractorProfile,
  jobs, type Job, type InsertJob,
  bids, type Bid, type InsertBid,
  transactions, type Transaction, type InsertTransaction,
  chatRooms, chatParticipants, messages, type Message, type InsertMessage,
  reviews, type Review, type InsertReview,
  passwordResetTokens, type PasswordResetToken, type InsertPasswordResetToken,
  quotes, type Quote, type InsertQuote,
  quoteLineItems, type QuoteLineItem, type InsertQuoteLineItem,
  invoices, type Invoice, type InsertInvoice,
  invoiceLineItems, type InvoiceLineItem, type InsertInvoiceLineItem
} from "@shared/schema";
import { authDb } from "./auth-db";
import { eq, and, desc, inArray, count, sql } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
import { Pool } from 'pg';
// Note: We import connect-pg-simple dynamically inside the production setup method
// because it's a CommonJS module and requires special handling

// Create a dedicated TCP/SSL pool for session store that is always safe for production
// This ensures we're never using the Neon serverless WebSocket driver for session operations
const pgSessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10, // Smaller pool just for sessions
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// IStorage interface with all CRUD methods
export interface IStorage {
  // Session store
  sessionStore: session.Store;
  
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  
  // Landlord profiles
  getLandlordProfile(userId: number): Promise<LandlordProfile | undefined>;
  createLandlordProfile(profile: InsertLandlordProfile): Promise<LandlordProfile>;
  updateLandlordProfile(userId: number, updates: Partial<LandlordProfile>): Promise<LandlordProfile | undefined>;
  
  // Contractor profiles
  getContractorProfile(userId: number): Promise<ContractorProfile | undefined>;
  createContractorProfile(profile: InsertContractorProfile): Promise<ContractorProfile>;
  updateContractorProfile(userId: number, updates: Partial<ContractorProfile>): Promise<ContractorProfile | undefined>;
  getAllContractorProfiles(): Promise<ContractorProfile[]>;
  
  // Jobs
  getJob(id: number): Promise<Job | undefined>;
  getJobsByLandlord(landlordId: number): Promise<Job[]>;
  getAvailableJobs(): Promise<Job[]>;
  getAllJobs(): Promise<Job[]>;
  getJobsByContractor(contractorId: number): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, updates: Partial<Job>): Promise<Job | undefined>;
  
  // Bids
  getBid(id: number): Promise<Bid | undefined>;
  getBidsByJob(jobId: number): Promise<Bid[]>;
  getBidsByContractor(contractorId: number): Promise<Bid[]>;
  getBidByJobAndContractor(jobId: number, contractorId: number): Promise<Bid | undefined>;
  createBid(bid: InsertBid): Promise<Bid>;
  updateBid(id: number, updates: Partial<Bid>): Promise<Bid | undefined>;
  
  // Transactions
  getTransaction(id: number): Promise<Transaction | undefined>;
  getTransactionsByUser(userId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, updates: Partial<Transaction>): Promise<Transaction | undefined>;
  
  // Chat system
  getChatRoom(id: number): Promise<any>;
  getChatRoomByJob(jobId: number): Promise<any>;
  createChatRoom(jobId: number, participants: number[]): Promise<any>;
  getChatRoomParticipants(chatRoomId: number): Promise<any[]>;
  addChatRoomParticipant(chatRoomId: number, userId: number): Promise<any>;
  getChatMessages(chatRoomId: number): Promise<any[]>;
  createChatMessage(message: InsertMessage): Promise<Message>;
  getUnreadMessageCount(userId: number): Promise<number>;
  markMessagesAsRead(chatRoomId: number, userId: number): Promise<void>;
  
  // Reviews
  getReview(id: number): Promise<Review | undefined>;
  getReviewsByUser(userId: number): Promise<Review[]>;
  getReviewsByReviewer(reviewerId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  
  // Password reset
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<boolean>;
  
  // Waitlist
  addToWaitlist(entry: InsertWaitlistEntry): Promise<WaitlistEntry>;
  getWaitlistEntries(): Promise<WaitlistEntry[]>;
  
  // Quotes
  getQuote(id: number): Promise<Quote | undefined>;
  getQuotesByLandlord(landlordId: number): Promise<Quote[]>;
  getQuotesByContractor(contractorId: number): Promise<Quote[]>;
  getQuoteByJob(jobId: number): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: number, updates: Partial<Quote>): Promise<Quote | undefined>;
  deleteQuote(id: number): Promise<boolean>;
  
  // Quote line items
  getQuoteLineItems(quoteId: number): Promise<QuoteLineItem[]>;
  createQuoteLineItem(lineItem: InsertQuoteLineItem): Promise<QuoteLineItem>;
  updateQuoteLineItem(id: number, updates: Partial<QuoteLineItem>): Promise<QuoteLineItem | undefined>;
  deleteQuoteLineItem(id: number): Promise<boolean>;
  
  // Invoices
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoicesByLandlord(landlordId: number): Promise<Invoice[]>;
  getInvoicesByContractor(contractorId: number): Promise<Invoice[]>;
  getInvoiceByJob(jobId: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;
  
  // Invoice line items
  getInvoiceLineItems(invoiceId: number): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(lineItem: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  updateInvoiceLineItem(id: number, updates: Partial<InvoiceLineItem>): Promise<InvoiceLineItem | undefined>;
  deleteInvoiceLineItem(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Access isProduction from the global property set in db.ts
    const isProduction = globalThis.isProductionEnv || process.env.NODE_ENV === 'production';
    
    // Initialize temporary memory store to avoid "this.sessionStore is undefined" issues
    // This will be replaced with a proper store below if initialization succeeds
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });

    // Production mode setup is async, so we need to handle this differently
    if (isProduction) {
      console.log('Production mode: Initializing session store with pg.Pool (TCP)');
      
      // Immediately setup direct pg-based session store
      this._setupProductionSessionStore();
    } else {
      // Development mode can use the same approach but with auto-table creation enabled
      console.log('Development mode: Using TCP/SSL pool for session store');
      // We'll use the same dynamic import approach for consistency
      this._setupDevelopmentSessionStore();
    }
  }
  
  // Method to set up production session store
  /**
   * Verify that the session table exists in the database
   * @param testPool - A pg.Pool instance to use for verification
   * @returns true if the table exists, false otherwise
   */
  private async verifySessionTable(testPool) {
    try {
      console.log('🔍 Verifying session table exists using pg.Pool...');
      const result = await testPool.query(`SELECT 1 FROM session LIMIT 1;`);
      console.log('✅ Session table verified - exists in database');
      return true;
    } catch (error) {
      // Check if the error indicates the table doesn't exist
      if (error.message.includes('relation "session" does not exist')) {
        console.error('❌ Session table is missing from database:', error.message);
        return false;
      } else {
        console.error('❌ Error checking session table:', error.message);
        return false;
      }
    }
  }

  private async _setupProductionSessionStore() {
    try {
      console.log('🔄 Setting up production session store with dedicated pg.Pool (TCP/SSL)');
      
      // Simple test of connection
      try {
        const result = await pgSessionPool.query('SELECT NOW()');
        console.log('✅ Session pool connection test successful:', result.rows[0].now);
      } catch (err) {
        console.error('❌ Session pool connection test failed:', err);
        throw err;
      }
      
      // Import connect-pg-simple dynamically - this is a CJS module
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const connectPgSimple = require('connect-pg-simple');
      const PgSession = connectPgSimple(session);
      
      // Create the store with the dedicated pg.Pool
      // Note: We NEVER use drizzle-orm or any Neon WebSocket connections 
      // for session table operations in production
      const pgStore = new PgSession({
        pool: pgSessionPool, // ALWAYS use the dedicated TCP/SSL pool
        tableName: 'session',
        createTableIfMissing: false, // Table must exist before app startup
        pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 min
        errorLog: console.error.bind(console)
      });
      
      console.log('✅ Production session store created with dedicated pg.Pool');
      
      // Check if session table exists - but don't use drizzle-orm,
      // use the pgSessionPool (pure pg)
      try {
        await pgSessionPool.query('SELECT 1 FROM session LIMIT 1');
        console.log('✅ Session table exists and is accessible');
      } catch (error) {
        if (error.message.includes('relation "session" does not exist')) {
          console.error('❌ Session table missing from database!');
          console.error('Please run: node scripts/create-session-table.js');
          console.error('Attempting to continue, but session persistence will fail');
        } else {
          console.error('❌ Error accessing session table:', error.message);
          throw error;
        }
      }
      
      // Assign the pg session store
      this.sessionStore = pgStore;
      console.log('✅ Production session store initialized successfully');
    } catch (err) {
      console.error('❌ Failed to initialize production session store:', err);
      console.error('Using memory store as fallback. Sessions will be lost on restart!');
      this._setupMemoryStore('production');
    }
  }
  
  // Helper method to set up memory store
  private _setupMemoryStore(env = 'production') {
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    if (env === 'production') {
      console.warn('⚠️ Using memory store in production! Sessions will be lost on restart.');
    } else {
      console.warn('Using in-memory session store as fallback. Sessions will be lost on restart.');
    }
  }
  
  private async _setupDevelopmentSessionStore() {
    try {
      console.log('🔄 Setting up development session store with dedicated pg.Pool (TCP/SSL)');
      
      // Simple test of connection
      try {
        const result = await pgSessionPool.query('SELECT NOW()');
        console.log('✅ Session pool connection test successful:', result.rows[0].now);
      } catch (err) {
        console.error('❌ Session pool connection test failed:', err);
        throw err;
      }
      
      // Import connect-pg-simple dynamically - this is a CJS module
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const connectPgSimple = require('connect-pg-simple');
      const PgSession = connectPgSimple(session);
      
      // Create the store with the dedicated pg.Pool, but with auto table creation
      const pgStore = new PgSession({
        pool: pgSessionPool, // ALWAYS use the dedicated TCP/SSL pool
        tableName: 'session',
        createTableIfMissing: true, // Auto-create in development
        pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 min
        errorLog: console.error.bind(console)
      });
      
      console.log('✅ Development session store created with dedicated pg.Pool');
      
      // Assign the pg session store
      this.sessionStore = pgStore;
      console.log('✅ Development session store initialized successfully');
    } catch (err) {
      console.error('❌ Failed to initialize development session store:', err);
      console.error('Using memory store as fallback. Sessions will be lost on restart!');
      this._setupMemoryStore('development');
    }
  }
  
  // User methods - ALWAYS use authDb for authentication-related operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      console.log("Getting user by ID:", id);
      // Import auth-db for reliable TCP/SSL connection for auth operations
      const { authDb } = await import('./auth-db');
      const [user] = await authDb.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error getting user by ID:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      // Import auth-db for reliable TCP/SSL connection for auth operations
      const { authDb } = await import('./auth-db');
      const [user] = await authDb
        .select()
        .from(users)
        .where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      // Import auth-db for reliable TCP/SSL connection for auth operations
      const { authDb } = await import('./auth-db');
      const [user] = await authDb
        .select()
        .from(users)
        .where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error("Error getting user by email:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Import auth-db for reliable TCP/SSL connection for auth operations
    const { authDb } = await import('./auth-db');
    const [user] = await authDb
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    // Import auth-db for reliable TCP/SSL connection for auth operations
    const { authDb } = await import('./auth-db');
    const [user] = await authDb
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Landlord profile methods
  async getLandlordProfile(userId: number): Promise<LandlordProfile | undefined> {
    const [profile] = await authDb
      .select()
      .from(landlordProfiles)
      .where(eq(landlordProfiles.userId, userId));
    return profile;
  }

  async createLandlordProfile(profile: InsertLandlordProfile): Promise<LandlordProfile> {
    const [newProfile] = await authDb
      .insert(landlordProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  async updateLandlordProfile(userId: number, updates: Partial<LandlordProfile>): Promise<LandlordProfile | undefined> {
    const [profile] = await authDb
      .update(landlordProfiles)
      .set(updates)
      .where(eq(landlordProfiles.userId, userId))
      .returning();
    return profile;
  }

  // Contractor profile methods
  async getContractorProfile(userId: number): Promise<ContractorProfile | undefined> {
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
        ssl: { rejectUnauthorized: false }
      });
      
      console.log(`Fetching contractor profile for user ${userId} using direct SQL`);
      
      // Query using snake_case column names to match the database
      const result = await pool.query(`
        SELECT * FROM contractor_profiles WHERE user_id = $1
      `, [userId]);
      
      // Log raw results for debugging
      console.log(`Raw result for user ${userId}: ${JSON.stringify(result.rows)}`);
      
      await pool.end(); // Close the pool when done
      
      if (result.rows.length === 0) {
        console.log(`No contractor profile found for user ${userId}`);
        return undefined;
      }
      
      // Map snake_case fields to camelCase to match the application schema
      const profile = result.rows[0];
      console.log(`Found profile for user ${userId}: ${JSON.stringify(profile)}`);
      
      // Make sure to include the bio and skills fields
      return {
        id: profile.id,
        userId: profile.user_id,
        businessName: profile.business_name,
        description: profile.description,
        phoneNumber: profile.phone_number,
        website: profile.website,
        yearsOfExperience: profile.years_of_experience,
        licenseNumber: profile.license_number,
        insuranceProvider: profile.insurance_provider,
        insurancePolicyNumber: profile.insurance_policy_number,
        hasLiabilityInsurance: profile.has_liability_insurance,
        trades: profile.trades || [],
        skills: profile.skills || [],
        bio: profile.bio || null,
        serviceRadius: profile.service_radius,
        walletBalance: profile.wallet_balance,
        averageRating: profile.average_rating,
        totalReviews: profile.total_reviews,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      };
    } catch (error) {
      console.error(`Error fetching contractor profile for user ${userId}:`, error);
      return undefined;
    }
  }

  async getAllContractorProfiles(): Promise<ContractorProfile[]> {
    return authDb.select().from(contractorProfiles);
  }

  async createContractorProfile(profile: InsertContractorProfile): Promise<ContractorProfile> {
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
        ssl: { rejectUnauthorized: false }
      });
      
      console.log(`Creating contractor profile for user ${profile.userId}`);
      
      // Map camelCase to snake_case field names for the insert
      const insertFields = ['user_id'];
      const placeholders = ['$1'];
      const values = [profile.userId];
      let valueCounter = 2;
      
      if (profile.businessName !== undefined) {
        insertFields.push('business_name');
        placeholders.push(`$${valueCounter}`);
        values.push(profile.businessName);
        valueCounter++;
      }
      
      if (profile.description !== undefined) {
        insertFields.push('description');
        placeholders.push(`$${valueCounter}`);
        values.push(profile.description);
        valueCounter++;
      }
      
      if (profile.trades !== undefined) {
        insertFields.push('trades');
        placeholders.push(`$${valueCounter}`);
        values.push(profile.trades);
        valueCounter++;
      }
      
      if (profile.skills !== undefined) {
        insertFields.push('skills');
        placeholders.push(`$${valueCounter}`);
        values.push(profile.skills);
        valueCounter++;
      }
      
      if (profile.bio !== undefined) {
        insertFields.push('bio');
        placeholders.push(`$${valueCounter}`);
        values.push(profile.bio);
        valueCounter++;
      }
      
      // Add created_at and updated_at timestamps
      const now = new Date();
      insertFields.push('created_at', 'updated_at');
      placeholders.push(`$${valueCounter}`, `$${valueCounter + 1}`);
      values.push(now, now);
      
      const query = `
        INSERT INTO contractor_profiles (${insertFields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
      
      console.log("Executing insert query:", query);
      console.log("With values:", values);
      
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        console.log("No profile was created");
        throw new Error("Failed to create contractor profile");
      }
      
      // Map the result back to camelCase for the application
      const newProfile = result.rows[0];
      
      await pool.end(); // Close the pool when done
      
      // Map database fields (snake_case) to application fields (camelCase)
      // and make sure to include skills and bio fields
      return {
        id: newProfile.id,
        userId: newProfile.user_id,
        businessName: newProfile.business_name,
        description: newProfile.description,
        phoneNumber: newProfile.phone_number,
        website: newProfile.website,
        yearsOfExperience: newProfile.years_of_experience,
        licenseNumber: newProfile.license_number,
        insuranceProvider: newProfile.insurance_provider,
        insurancePolicyNumber: newProfile.insurance_policy_number,
        hasLiabilityInsurance: newProfile.has_liability_insurance,
        trades: newProfile.trades || [],
        skills: newProfile.skills || [],
        bio: newProfile.bio || null,
        serviceRadius: newProfile.service_radius,
        walletBalance: newProfile.wallet_balance,
        averageRating: newProfile.average_rating,
        totalReviews: newProfile.total_reviews,
        createdAt: newProfile.created_at,
        updatedAt: newProfile.updated_at
      };
    } catch (error) {
      console.error(`Error creating contractor profile for user ${profile.userId}:`, error);
      throw error;
    }
  }

  async updateContractorProfile(userId: number, updates: Partial<ContractorProfile>): Promise<ContractorProfile | undefined> {
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
        ssl: { rejectUnauthorized: false }
      });
      
      console.log(`Using userId: ${userId}`);
      
      // Map camelCase to snake_case field names for the update
      const updateFields = [];
      const values = [];
      let valueCounter = 1;
      
      if (updates.businessName !== undefined) {
        updateFields.push(`business_name = $${valueCounter}`);
        values.push(updates.businessName);
        valueCounter++;
      }
      
      if (updates.description !== undefined) {
        updateFields.push(`description = $${valueCounter}`);
        values.push(updates.description);
        valueCounter++;
      }
      
      if (updates.trades !== undefined) {
        updateFields.push(`trades = $${valueCounter}`);
        values.push(updates.trades);
        valueCounter++;
      }
      
      if (updates.skills !== undefined) {
        updateFields.push(`skills = $${valueCounter}`);
        values.push(updates.skills);
        valueCounter++;
      }
      
      if (updates.bio !== undefined) {
        updateFields.push(`bio = $${valueCounter}`);
        values.push(updates.bio);
        valueCounter++;
      }
      
      if (updates.hasLiabilityInsurance !== undefined) {
        updateFields.push(`has_liability_insurance = $${valueCounter}`);
        values.push(updates.hasLiabilityInsurance);
        valueCounter++;
      }
      
      if (updates.serviceRadius !== undefined) {
        updateFields.push(`service_radius = $${valueCounter}`);
        values.push(updates.serviceRadius);
        valueCounter++;
      }
      
      // Add other fields as needed
      
      if (updateFields.length === 0) {
        console.log("No fields to update");
        return undefined;
      }
      
      // Add the user_id to the values array for the WHERE clause
      values.push(userId);
      
      const query = `
        UPDATE contractor_profiles
        SET ${updateFields.join(', ')}
        WHERE user_id = $${valueCounter}
        RETURNING *
      `;
      
      console.log("Executing update query:", query);
      console.log("With values:", values);
      
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        console.log("No profile was updated");
        return undefined;
      }
      
      // Map the result back to camelCase for the application
      const updatedProfile = result.rows[0];
      // Map database fields (snake_case) to application fields (camelCase) 
      // and make sure to include skills and bio fields for consistency
      return {
        id: updatedProfile.id,
        userId: updatedProfile.user_id,
        businessName: updatedProfile.business_name,
        description: updatedProfile.description,
        phoneNumber: updatedProfile.phone_number,
        website: updatedProfile.website,
        yearsOfExperience: updatedProfile.years_of_experience,
        licenseNumber: updatedProfile.license_number,
        insuranceProvider: updatedProfile.insurance_provider,
        insurancePolicyNumber: updatedProfile.insurance_policy_number,
        hasLiabilityInsurance: updatedProfile.has_liability_insurance,
        trades: updatedProfile.trades || [],
        skills: updatedProfile.skills || [],
        bio: updatedProfile.bio || null,
        serviceRadius: updatedProfile.service_radius,
        walletBalance: updatedProfile.wallet_balance,
        averageRating: updatedProfile.average_rating,
        totalReviews: updatedProfile.total_reviews,
        createdAt: updatedProfile.created_at,
        updatedAt: updatedProfile.updated_at
      };
    } catch (error) {
      console.error("Error updating contractor profile:", error);
      return undefined;
    }
  }

  // Job methods
  async getJob(id: number): Promise<Job | undefined> {
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      console.log(`Fetching job ${id} using direct SQL`);
      
      // Query using snake_case column names to match the database
      const result = await pool.query(`
        SELECT * FROM jobs WHERE id = $1
      `, [id]);
      
      await pool.end(); // Close the pool when done
      
      if (result.rowCount === 0) {
        console.log(`No job found with ID ${id}`);
        return undefined;
      }
      
      // Map snake_case fields to camelCase using the helper method
      const job = this.mapJobFromDatabase(result.rows[0]);
      
      return job;
    } catch (error) {
      console.error(`Error fetching job ${id}:`, error);
      return undefined;
    }
  }

  async getJobsByLandlord(landlordId: number): Promise<Job[]> {
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      console.log(`Fetching jobs for landlord ${landlordId} using direct SQL`);
      
      // Query using snake_case column names to match the database
      const result = await pool.query(`
        SELECT * FROM jobs WHERE landlord_id = $1
      `, [landlordId]);
      
      console.log(`Found ${result.rowCount} jobs for landlord ${landlordId}`);
      
      // Map snake_case fields to camelCase using the helper method
      const mappedJobs = result.rows.map(job => this.mapJobFromDatabase(job));
      
      await pool.end(); // Close the pool when done
      
      return mappedJobs;
    } catch (error) {
      console.error(`Error fetching jobs for landlord ${landlordId}:`, error);
      return [];
    }
  }

  async getAvailableJobs(): Promise<Job[]> {
    console.log('Fetching available jobs from production database...');
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
        ssl: { rejectUnauthorized: false }
      });
      
      // Query open jobs directly using SQL to avoid ORM field mapping issues
      // Get the actual production jobs with a more detailed query
      const result = await pool.query(`
        SELECT j.*, 
               COUNT(b.id) AS bid_count 
        FROM jobs j 
        LEFT JOIN bids b ON j.id = b.job_id 
        WHERE j.status = 'open' 
        GROUP BY j.id
        ORDER BY j.id
      `);
      
      console.log(`Found ${result.rowCount} available jobs via direct SQL`);
      
      // Log first job for debugging
      if (result.rowCount > 0) {
        console.log('First job sample from database:', JSON.stringify(result.rows[0], null, 2));
      }
      
      // Map snake_case fields to camelCase to match the application schema
      // and ensure all required fields are properly handled
      const mappedJobs = result.rows.map(job => {
        // Make sure to handle all fields, including those that might be nested in location
        const locationData = job.location || {};
        
        // Handle any potential missing location information
        const location = {
          address: locationData.address || '',
          city: locationData.city || '',
          state: locationData.state || '',
          zipCode: locationData.zip_code || locationData.zipCode || '',
          latitude: locationData.latitude || 0,
          longitude: locationData.longitude || 0
        };
        
        return {
          id: job.id,
          title: job.title,
          description: job.description,
          landlordId: job.landlord_id,
          contractorId: job.contractor_id,
          status: job.status,
          pricingType: job.pricing_type || 'fixed',
          budget: parseFloat(job.budget) || 0,
          location: location,
          categoryTags: job.category_tags || [],
          images: job.images || [],
          isUrgent: job.is_urgent || false,
          deadline: job.deadline || null,
          startDate: job.start_date || null,
          completionDate: job.completion_date || null,
          progress: job.progress || 0,
          createdAt: job.created_at,
          updatedAt: job.updated_at,
          bidCount: parseInt(job.bid_count) || 0
        };
      });
      
      console.log(`Returning ${mappedJobs.length} mapped jobs to client`);
      if (mappedJobs.length > 0) {
        console.log('First mapped job sample:', JSON.stringify(mappedJobs[0], null, 2));
      }
      
      await pool.end(); // Close the pool when done
      
      return mappedJobs;
    } catch (error) {
      console.error('Error fetching available jobs:', error);
      return [];
    }
  }
  
  async getAllJobs(): Promise<Job[]> {
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      console.log('Fetching all jobs using direct SQL');
      
      // Query all jobs directly using SQL
      const result = await pool.query(`
        SELECT * FROM jobs
      `);
      
      console.log(`Found ${result.rowCount} total jobs via direct SQL`);
      
      // Map all jobs to the expected format using our helper method
      const mappedJobs = result.rows.map(job => this.mapJobFromDatabase(job));
      
      await pool.end(); // Close the pool when done
      
      return mappedJobs;
    } catch (error) {
      console.error('Error fetching all jobs:', error);
      return [];
    }
  }

  async getJobsByContractor(contractorId: number): Promise<Job[]> {
    // Get jobs where the contractor is directly assigned using direct SQL to handle snake_case
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
        ssl: { rejectUnauthorized: false }
      });
      
      console.log(`Fetching jobs for contractor ${contractorId} using direct SQL`);
      
      // First get jobs directly assigned to the contractor
      const directJobsResult = await pool.query(`
        SELECT * FROM jobs WHERE contractor_id = $1
      `, [contractorId]);
      
      console.log(`Found ${directJobsResult.rowCount} directly assigned jobs for contractor ${contractorId}`);
      
      // Get accepted bids for this contractor
      const acceptedBidsResult = await pool.query(`
        SELECT * FROM bids WHERE contractor_id = $1 AND status = 'accepted'
      `, [contractorId]);
      
      // If no accepted bids, return only directly assigned jobs
      if (acceptedBidsResult.rowCount === 0) {
        // Map jobs to the expected format
        const mappedJobs = directJobsResult.rows.map(job => this.mapJobFromDatabase(job));
        await pool.end();
        return mappedJobs;
      }
      
      // Extract job IDs from accepted bids
      const acceptedJobIds = acceptedBidsResult.rows.map(bid => bid.job_id);
      
      // Get jobs from accepted bids
      const bidJobsResult = await pool.query(`
        SELECT * FROM jobs WHERE id = ANY($1)
      `, [acceptedJobIds]);
      
      // Combine both sets of jobs
      const allJobs = [...directJobsResult.rows];
      
      // Add jobs from bids only if they're not already in the list
      for (const job of bidJobsResult.rows) {
        if (!allJobs.some(existingJob => existingJob.id === job.id)) {
          allJobs.push(job);
        }
      }
      
      // Map all jobs to the expected format
      const mappedJobs = allJobs.map(job => this.mapJobFromDatabase(job));
      
      await pool.end(); // Close the pool when done
      
      return mappedJobs;
    } catch (error) {
      console.error(`Error getting jobs for contractor ${contractorId}:`, error);
      return [];
    }
  }
  
  // Helper method to map job fields from database (snake_case) to application (camelCase)
  private mapJobFromDatabase(job: any): Job {
    return {
      id: job.id,
      title: job.title,
      description: job.description,
      landlordId: job.landlord_id,
      contractorId: job.contractor_id,
      status: job.status,
      pricingType: job.pricing_type,
      budget: job.budget,
      location: job.location,
      categoryTags: job.category_tags,
      images: job.images,
      startDate: job.start_date,
      startTime: job.start_time,
      completionDate: job.completion_date,
      createdAt: job.created_at,
      updatedAt: job.updated_at
    };
  }

  async createJob(job: InsertJob): Promise<Job> {
    const now = new Date();
    
    // Ensure we're only using valid fields expected by the schema
    const defaultJob = {
      title: job.title,
      description: job.description,
      landlordId: job.landlordId,
      location: job.location,
      budget: job.budget,
      categoryTags: job.categoryTags || [],
      images: job.images || [],
      status: "draft",
      progress: 0,
      startDate: job.startDate || null,
      deadlineDate: job.deadlineDate || null,
      contractorId: null,
      createdAt: now,
      updatedAt: now
    };
    
    const [newJob] = await authDb
      .insert(jobs)
      .values(defaultJob)
      .returning();
    
    return newJob;
  }

  async updateJob(id: number, updates: Partial<Job>): Promise<Job | undefined> {
    const updateWithTimestamp = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [job] = await authDb
      .update(jobs)
      .set(updateWithTimestamp)
      .where(eq(jobs.id, id))
      .returning();
    
    return job;
  }

  // Bid methods
  async getBid(id: number): Promise<Bid | undefined> {
    const [bid] = await authDb.select().from(bids).where(eq(bids.id, id));
    return bid;
  }

  async getBidsByJob(jobId: number): Promise<Bid[]> {
    return authDb.select().from(bids).where(eq(bids.jobId, jobId));
  }

  async getBidsForJob(jobId: number): Promise<Bid[]> {
    // Get bids for a specific job using direct SQL to handle snake_case
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      // Query using snake_case column names to match the database
      const result = await pool.query(`
        SELECT * FROM bids WHERE job_id = $1
      `, [jobId]);
      
      // Map snake_case fields to camelCase to match the application schema
      const mappedBids = result.rows.map(bid => {
        return {
          id: bid.id,
          jobId: bid.job_id,
          contractorId: bid.contractor_id,
          amount: parseFloat(bid.amount),
          status: bid.status,
          message: bid.message,
          createdAt: bid.created_at,
          updatedAt: bid.updated_at
        };
      });
      
      await pool.end(); // Close the pool when done
      
      return mappedBids;
    } catch (error) {
      console.error(`Error getting bids for job ${jobId}:`, error);
      return [];
    }
  }

  async getBidCountForJob(jobId: number): Promise<number> {
    // Get the count of bids for a specific job using direct SQL to handle snake_case
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      // Query using snake_case column names to match the database
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM bids WHERE job_id = $1
      `, [jobId]);
      
      await pool.end(); // Close the pool when done
      
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      console.error(`Error getting bid count for job ${jobId}:`, error);
      return 0;
    }
  }

  async getBidsByContractor(contractorId: number): Promise<Bid[]> {
    // Get bids for a specific contractor using direct SQL to handle snake_case
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
        ssl: { rejectUnauthorized: false }
      });
      
      console.log(`Fetching bids for contractor ${contractorId} using direct SQL`);
      
      // Query using snake_case column names to match the database
      const result = await pool.query(`
        SELECT * FROM bids WHERE contractor_id = $1
      `, [contractorId]);
      
      console.log(`Found ${result.rowCount} bids for contractor ${contractorId} via direct SQL`);
      
      // Map snake_case fields to camelCase to match the application schema
      const mappedBids = result.rows.map(bid => {
        return {
          id: bid.id,
          jobId: bid.job_id,
          contractorId: bid.contractor_id,
          amount: parseFloat(bid.amount),
          status: bid.status,
          message: bid.message,
          createdAt: bid.created_at,
          updatedAt: bid.updated_at
        };
      });
      
      await pool.end(); // Close the pool when done
      
      return mappedBids;
    } catch (error) {
      console.error(`Error getting bids for contractor ${contractorId}:`, error);
      return [];
    }
  }

  async getBidByJobAndContractor(jobId: number, contractorId: number): Promise<Bid | undefined> {
    try {
      // Use direct SQL query to avoid field mapping issues between camelCase and snake_case
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
        ssl: { rejectUnauthorized: false }
      });
      
      // Query using snake_case column names to match the database
      const result = await pool.query(`
        SELECT * FROM bids WHERE job_id = $1 AND contractor_id = $2
      `, [jobId, contractorId]);
      
      await pool.end(); // Close the pool when done
      
      if (result.rowCount === 0) {
        return undefined;
      }
      
      // Map snake_case fields to camelCase to match the application schema
      const bid = result.rows[0];
      return {
        id: bid.id,
        jobId: bid.job_id,
        contractorId: bid.contractor_id,
        amount: parseFloat(bid.amount),
        status: bid.status,
        message: bid.message,
        createdAt: bid.created_at,
        updatedAt: bid.updated_at
      };
    } catch (error) {
      console.error(`Error getting bid for job ${jobId} and contractor ${contractorId}:`, error);
      return undefined;
    }
  }

  async createBid(bid: InsertBid): Promise<Bid> {
    const now = new Date();
    const bidWithDefaults = {
      ...bid,
      status: bid.status || "pending",
      createdAt: now,
      updatedAt: now
    };
    
    const [newBid] = await authDb
      .insert(bids)
      .values(bidWithDefaults)
      .returning();
    
    return newBid;
  }

  async updateBid(id: number, updates: Partial<Bid>): Promise<Bid | undefined> {
    const updateWithTimestamp = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [bid] = await authDb
      .update(bids)
      .set(updateWithTimestamp)
      .where(eq(bids.id, id))
      .returning();
    
    return bid;
  }

  // Transaction methods
  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await authDb.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async getTransactionsByUser(userId: number): Promise<Transaction[]> {
    return authDb.select().from(transactions).where(eq(transactions.userId, userId));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const now = new Date();
    const transactionWithDefaults = {
      ...transaction,
      createdAt: now,
      updatedAt: now
    };
    
    const [newTransaction] = await authDb
      .insert(transactions)
      .values(transactionWithDefaults)
      .returning();
    
    return newTransaction;
  }

  async updateTransaction(id: number, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const updateWithTimestamp = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [transaction] = await authDb
      .update(transactions)
      .set(updateWithTimestamp)
      .where(eq(transactions.id, id))
      .returning();
    
    return transaction;
  }

  // Chat methods
  async getChatRoom(id: number): Promise<any> {
    const [room] = await authDb.select().from(chatRooms).where(eq(chatRooms.id, id));
    return room;
  }

  async getChatRoomByJob(jobId: number): Promise<any> {
    // Use raw SQL query with snake_case column names for compatibility with production DB
    // Import dynamically to avoid require() which is not supported in ESM
    const { db } = await import('./db');
    
    const result = await db.query(
      'SELECT * FROM chat_rooms WHERE job_id = $1 LIMIT 1',
      [jobId]
    );
    
    return result.rows?.[0];
  }

  async createChatRoom(jobId: number, participants: number[]): Promise<any> {
    // Use raw SQL query with snake_case column names for compatibility with production DB
    // Import dynamically to avoid require() which is not supported in ESM
    const { db } = await import('./db');
    
    const now = new Date();
    
    // Insert the chat room using snake_case column names
    const result = await db.query(
      'INSERT INTO chat_rooms (job_id, created_at) VALUES ($1, $2) RETURNING *',
      [jobId, now]
    );
    
    const room = result.rows?.[0];
    
    // Add participants
    for (const userId of participants) {
      await authDb
        .insert(chatParticipants)
        .values({
          chatRoomId: room.id,
          userId,
          createdAt: now,
          updatedAt: now
        });
    }
    
    return room;
  }

  async getChatRoomParticipants(chatRoomId: number): Promise<any[]> {
    return db
      .select()
      .from(chatParticipants)
      .where(eq(chatParticipants.chatRoomId, chatRoomId));
  }

  async addChatRoomParticipant(chatRoomId: number, userId: number): Promise<any> {
    const now = new Date();
    
    const [participant] = await authDb
      .insert(chatParticipants)
      .values({
        chatRoomId,
        userId,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    
    return participant;
  }

  async getChatMessages(chatRoomId: number): Promise<any[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.chatRoomId, chatRoomId))
      .orderBy(messages.createdAt);
  }

  async createChatMessage(message: InsertMessage): Promise<Message> {
    const now = new Date();
    const messageWithDefaults = {
      ...message,
      createdAt: now,
      updatedAt: now
    };
    
    const [newMessage] = await authDb
      .insert(messages)
      .values(messageWithDefaults)
      .returning();
    
    return newMessage;
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    // Get all chat rooms this user is in
    const userChatRooms = await authDb
      .select()
      .from(chatParticipants)
      .where(eq(chatParticipants.userId, userId));
    
    if (userChatRooms.length === 0) {
      return 0;
    }
    
    const chatRoomIds = userChatRooms.map(p => p.chatRoomId);
    
    // Count messages in these rooms that are newer than the last time the user accessed them
    let unreadCount = 0;
    for (const participant of userChatRooms) {
      const lastRead = participant.lastReadAt || new Date(0); // If never read, use epoch
      
      // Count messages newer than lastRead
      const [result] = await authDb
        .select({ count: count() })
        .from(messages)
        .where(and(
          eq(messages.chatRoomId, participant.chatRoomId),
          eq(messages.chatRoomId, participant.chatRoomId),
          sql`${messages.createdAt} > ${lastRead}`
        ));
      
      unreadCount += result?.count || 0;
    }
    
    return unreadCount;
  }

  async markMessagesAsRead(chatRoomId: number, userId: number): Promise<void> {
    const now = new Date();
    
    await authDb
      .update(chatParticipants)
      .set({ lastReadAt: now, updatedAt: now })
      .where(and(
        eq(chatParticipants.chatRoomId, chatRoomId),
        eq(chatParticipants.userId, userId)
      ));
  }

  // Review methods
  async getReview(id: number): Promise<Review | undefined> {
    const [review] = await authDb.select().from(reviews).where(eq(reviews.id, id));
    return review;
  }

  async getReviewsByUser(userId: number): Promise<Review[]> {
    return authDb.select().from(reviews).where(eq(reviews.userId, userId));
  }

  async getReviewsByReviewer(reviewerId: number): Promise<Review[]> {
    return authDb.select().from(reviews).where(eq(reviews.reviewerId, reviewerId));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const now = new Date();
    const reviewWithDefaults = {
      ...review,
      createdAt: now,
      updatedAt: now
    };
    
    const [newReview] = await authDb
      .insert(reviews)
      .values(reviewWithDefaults)
      .returning();
    
    return newReview;
  }

  // Password reset methods
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    // Import auth-db for reliable TCP/SSL connection for auth operations
    const { authDb } = await import('./auth-db');
    
    const now = new Date();
    const tokenWithDefaults = {
      ...token,
      createdAt: now,
      updatedAt: now
    };
    
    const [newToken] = await authDb
      .insert(passwordResetTokens)
      .values(tokenWithDefaults)
      .returning();
    
    return newToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    // Import auth-db for reliable TCP/SSL connection for auth operations
    const { authDb } = await import('./auth-db');
    
    const [resetToken] = await authDb
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    
    return resetToken;
  }
  
  // Added method to match what's being called in routes.ts
  async getPasswordResetTokenByToken(token: string): Promise<PasswordResetToken | undefined> {
    // This is just an alias to getPasswordResetToken
    return this.getPasswordResetToken(token);
  }

  async deletePasswordResetToken(token: string): Promise<boolean> {
    // Import auth-db for reliable TCP/SSL connection for auth operations
    const { authDb } = await import('./auth-db');
    
    const result = await authDb
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    
    return result.count > 0;
  }
  
  // Add method to mark password reset token as used
  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    // Import auth-db for reliable TCP/SSL connection for auth operations
    const { authDb } = await import('./auth-db');
    
    const result = await authDb
      .update(passwordResetTokens)
      .set({ used: true, updatedAt: new Date() })
      .where(eq(passwordResetTokens.token, token))
      .returning();
    
    return result.length > 0;
  }

  // Waitlist methods
  async addToWaitlist(entry: InsertWaitlistEntry): Promise<WaitlistEntry> {
    const now = new Date();
    const entryWithDefaults = {
      ...entry,
      createdAt: now,
      updatedAt: now
    };
    
    const [newEntry] = await authDb
      .insert(waitlistEntries)
      .values(entryWithDefaults)
      .returning();
    
    return newEntry;
  }

  async getWaitlistEntries(): Promise<WaitlistEntry[]> {
    return authDb.select().from(waitlistEntries);
  }
  
  // Quote methods
  async getQuote(id: number): Promise<Quote | undefined> {
    const [quote] = await authDb.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }
  
  async getQuotesByLandlord(landlordId: number): Promise<Quote[]> {
    return db
      .select()
      .from(quotes)
      .where(eq(quotes.landlordId, landlordId))
      .orderBy(desc(quotes.createdAt));
  }
  
  async getQuotesByContractor(contractorId: number): Promise<Quote[]> {
    return db
      .select()
      .from(quotes)
      .where(eq(quotes.contractorId, contractorId))
      .orderBy(desc(quotes.createdAt));
  }
  
  async getQuoteByJob(jobId: number): Promise<Quote | undefined> {
    const [quote] = await authDb
      .select()
      .from(quotes)
      .where(eq(quotes.jobId, jobId))
      .orderBy(desc(quotes.createdAt));
    
    return quote;
  }
  
  async createQuote(quote: InsertQuote): Promise<Quote> {
    const now = new Date();
    
    // Default values
    const defaultQuote = {
      ...quote,
      status: quote.status || "draft",
      subtotal: quote.subtotal || 0,
      total: quote.total || 0,
      paymentMethods: quote.paymentMethods || ["credit_card", "bank_transfer"],
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      viewedAt: null,
      responseAt: null
    };
    
    const [newQuote] = await authDb
      .insert(quotes)
      .values(defaultQuote)
      .returning();
    
    return newQuote;
  }
  
  async updateQuote(id: number, updates: Partial<Quote>): Promise<Quote | undefined> {
    const updateWithTimestamp = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [quote] = await authDb
      .update(quotes)
      .set(updateWithTimestamp)
      .where(eq(quotes.id, id))
      .returning();
    
    return quote;
  }
  
  async deleteQuote(id: number): Promise<boolean> {
    // First delete associated line items
    await authDb
      .delete(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, id));
    
    // Then delete the quote
    const result = await authDb
      .delete(quotes)
      .where(eq(quotes.id, id));
    
    return result.count > 0;
  }
  
  // Quote line item methods
  async getQuoteLineItems(quoteId: number): Promise<QuoteLineItem[]> {
    return db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quoteId))
      .orderBy(quoteLineItems.sortOrder);
  }
  
  async createQuoteLineItem(lineItem: InsertQuoteLineItem): Promise<QuoteLineItem> {
    const now = new Date();
    
    // Default values
    const defaultLineItem = {
      ...lineItem,
      quantity: lineItem.quantity || 1,
      sortOrder: lineItem.sortOrder || 0,
      createdAt: now,
      updatedAt: now
    };
    
    const [newLineItem] = await authDb
      .insert(quoteLineItems)
      .values(defaultLineItem)
      .returning();
    
    return newLineItem;
  }
  
  async updateQuoteLineItem(id: number, updates: Partial<QuoteLineItem>): Promise<QuoteLineItem | undefined> {
    const updateWithTimestamp = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [lineItem] = await authDb
      .update(quoteLineItems)
      .set(updateWithTimestamp)
      .where(eq(quoteLineItems.id, id))
      .returning();
    
    return lineItem;
  }
  
  async deleteQuoteLineItem(id: number): Promise<boolean> {
    const result = await authDb
      .delete(quoteLineItems)
      .where(eq(quoteLineItems.id, id));
    
    return result.count > 0;
  }
  
  // Invoice methods
  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await authDb.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }
  
  async getInvoicesByLandlord(landlordId: number): Promise<Invoice[]> {
    return db
      .select()
      .from(invoices)
      .where(eq(invoices.landlordId, landlordId))
      .orderBy(desc(invoices.createdAt));
  }
  
  async getInvoicesByContractor(contractorId: number): Promise<Invoice[]> {
    return db
      .select()
      .from(invoices)
      .where(eq(invoices.contractorId, contractorId))
      .orderBy(desc(invoices.createdAt));
  }
  
  async getInvoiceByJob(jobId: number): Promise<Invoice | undefined> {
    const [invoice] = await authDb
      .select()
      .from(invoices)
      .where(eq(invoices.jobId, jobId))
      .orderBy(desc(invoices.createdAt));
    
    return invoice;
  }
  
  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const now = new Date();
    
    // Default values
    const defaultInvoice = {
      ...invoice,
      status: invoice.status || "draft",
      subtotal: invoice.subtotal || 0,
      total: invoice.total || 0,
      amountPaid: invoice.amountPaid || 0,
      taxRate: invoice.taxRate || 0,
      taxAmount: invoice.taxAmount || 0,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      viewedAt: null,
      paidAt: null,
      overdueAt: null
    };
    
    const [newInvoice] = await authDb
      .insert(invoices)
      .values(defaultInvoice)
      .returning();
    
    return newInvoice;
  }
  
  async updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    const updateWithTimestamp = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [invoice] = await authDb
      .update(invoices)
      .set(updateWithTimestamp)
      .where(eq(invoices.id, id))
      .returning();
    
    return invoice;
  }
  
  async deleteInvoice(id: number): Promise<boolean> {
    // First delete associated line items
    await authDb
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id));
    
    // Then delete the invoice
    const result = await authDb
      .delete(invoices)
      .where(eq(invoices.id, id));
    
    return result.count > 0;
  }
  
  // Invoice line item methods
  async getInvoiceLineItems(invoiceId: number): Promise<InvoiceLineItem[]> {
    return db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(invoiceLineItems.sortOrder);
  }
  
  async createInvoiceLineItem(lineItem: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const now = new Date();
    
    // Default values
    const defaultLineItem = {
      ...lineItem,
      quantity: lineItem.quantity || 1,
      sortOrder: lineItem.sortOrder || 0,
      createdAt: now,
      updatedAt: now
    };
    
    const [newLineItem] = await authDb
      .insert(invoiceLineItems)
      .values(defaultLineItem)
      .returning();
    
    return newLineItem;
  }
  
  async updateInvoiceLineItem(id: number, updates: Partial<InvoiceLineItem>): Promise<InvoiceLineItem | undefined> {
    const updateWithTimestamp = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [lineItem] = await authDb
      .update(invoiceLineItems)
      .set(updateWithTimestamp)
      .where(eq(invoiceLineItems.id, id))
      .returning();
    
    return lineItem;
  }
  
  async deleteInvoiceLineItem(id: number): Promise<boolean> {
    const result = await authDb
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.id, id));
    
    return result.count > 0;
  }
}

// Export a single instance
export const storage = new DatabaseStorage();