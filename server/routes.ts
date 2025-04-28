import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage as dbStorage } from "./storage";
import { authDb } from "./auth-db";
import { 
  insertUserSchema, registerSchema, loginSchema, 
  insertWaitlistSchema, waitlistSchema,
  insertJobSchema, jobSchema,
  insertBidSchema, bidSchema,
  insertTransactionSchema,
  insertMessageSchema,
  insertReviewSchema, reviewSchema,
  insertPasswordResetTokenSchema, forgotPasswordSchema, resetPasswordSchema,
  insertQuoteSchema, quoteApiSchema, quoteLineItemSchema, 
  insertQuoteLineItemSchema, invoiceSchema, invoiceLineItemSchema,
  insertInvoiceSchema, insertInvoiceLineItemSchema,
  Transaction, messages, chatParticipants
} from "@shared/schema";
import calendarRouter from './calendar/routes';
import { contractorProfileFixRouter } from './contract-profile-fix';
import templatesRouter from './templates/routes';
import { contractorProfileRouter } from './contractorProfile';
import { simpleProfileRouter } from './simple-profile';
import simpleAuthRouter from './simple-auth';
import { handleDirectLogin } from './direct-login-fixed';
import { jobsFixRouter } from './jobs-fix';
// Import our new snake_case-compatible auth router
import { eq, ne, gt, and, count, sql } from "drizzle-orm";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import Stripe from "stripe";
import crypto, { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Extend Express Request to include session
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    serviceAreaLastUpdated?: string;
    mapAuthToken?: string;
    authTimestamp?: number;
    lastUpdated?: string;
    lastAccess?: string;
    userType?: string;
  }
}

// Set up crypto helpers for password hashing
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  try {
    // Check if it's a bcrypt format password (starts with $2b$)
    if (stored.startsWith('$2b$')) {
      console.log('Using bcrypt for password comparison');
      // Use bcrypt's compare function
      const bcrypt = await import('bcrypt');
      return await bcrypt.compare(supplied, stored);
    }
    
    // Otherwise, process as our scrypt format
    if (!stored || !stored.includes('.')) {
      console.log('Invalid password format - not scrypt or bcrypt');
      return false;
    }
    
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    
    // Handle different hash lengths
    const hashByteLength = hashedBuf.length;
    const suppliedBuf = await scryptAsync(supplied, salt, hashByteLength);
    
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Password comparison error:', error.message);
    return false;
  }
}

// Enhanced authentication helper function to get userId from various sources
async function getUserId(req: Request): Promise<number | null> {
  let userId: number | null = null;
  
  // SPECIAL NOTICE: Cookie authentication is temporarily disabled
  // We're now prioritizing token-based authentication over cookie-based auth
  
  // APPROACH 1: Parse auth token (from x-auth-token or authorization header)
  try {
    const authToken = req.headers['x-auth-token'] as string || 
                    (req.headers['authorization'] as string)?.replace('Bearer ', '');
    
    if (authToken && authToken.startsWith('user-')) {
      const tokenParts = authToken.split('-');
      if (tokenParts.length >= 2) {
        userId = parseInt(tokenParts[1]);
        if (!isNaN(userId)) {
          // Verify user exists - use authDb for consistent TCP connection
          // Import the users schema first
          const { users } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          
          const [user] = await authDb.select().from(users).where(eq(users.id, userId));
          if (user) {
            console.log(`User authenticated via token: ${userId}`);
            return userId;
          }
        }
      }
    }
  } catch (err) {
    console.error("Error processing auth token:", err);
  }
  
  // APPROACH 2: Try X-User-ID header (direct approach)
  const headerUserId = req.headers['x-user-id'];
  if (headerUserId && typeof headerUserId === 'string') {
    try {
      userId = parseInt(headerUserId);
      if (!isNaN(userId)) {
        // Verify user exists using authDb for reliable connection
        const { users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        
        const [user] = await authDb.select().from(users).where(eq(users.id, userId));
        if (user) {
          console.log(`User authenticated via header: ${userId}`);
          return userId;
        }
      }
    } catch (err) {
      console.error("Error processing header userId:", err);
    }
  }
  
  // APPROACH 3: Fallback to session for backward compatibility
  const sessionUserId = req.session?.userId;
  if (sessionUserId) {
    try {
      // Verify the session user still exists - use authDb
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [user] = await authDb.select().from(users).where(eq(users.id, sessionUserId));
      if (user) {
        console.log(`Using existing session user ID: ${sessionUserId} (fallback method)`);
        return sessionUserId;
      }
    } catch (err) {
      console.error("Error verifying session user:", err);
    }
  }
  
  // APPROACH 4: Try user_id from query string (fallback)
  try {
    if (req.query.user_id) {
      userId = parseInt(req.query.user_id as string);
      if (!isNaN(userId)) {
        // Verify user exists with authDb
        const { users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        
        const [user] = await authDb.select().from(users).where(eq(users.id, userId));
        if (user) {
          // Save to session for future requests
          if (req.session) {
            req.session.userId = userId;
            req.session.userType = user.userType;
            
            // Ensure the session is saved
            await new Promise<void>((resolve) => {
              req.session.save(() => resolve());
            });
          }
          
          return userId;
        }
      }
    }
  } catch (err) {
    console.error("Error processing query userId:", err);
  }
  
  return null;
}

// Initialize Stripe if secret key exists
let stripe: Stripe | undefined;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16" as any, // Type cast to allow any API version
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Register the contractor profile router for all /api/contractor-profile routes
  app.use('/api/contractor-profile', contractorProfileRouter);
  
  // Register the contractor profile fix router for direct DB access
  app.use('/api/contractor-profile-fix', contractorProfileFixRouter);
  
  // Register our simple profile creation endpoint (most reliable)
  app.use('/api/simple-profile', simpleProfileRouter);
  
  // Register our simple auth router with snake_case column support
  app.use('/api/auth', simpleAuthRouter);
  
  // Register our fixed jobs/bids router with snake_case column support
  app.use('/api/jobs-fix', jobsFixRouter);
  
  // Direct contractor profile endpoint for emergencies
  app.get('/api/direct-contractor-profile/:userId', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Use direct database connection
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
        ssl: { rejectUnauthorized: false }
      });
      
      // Check if the user exists and is a contractor
      const userResult = await pool.query(`
        SELECT * FROM users WHERE id = $1
      `, [userId]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const user = userResult.rows[0];
      if (user.user_type !== 'contractor') {
        return res.status(400).json({ message: "User is not a contractor" });
      }
      
      // Simple query using double quotes for column names
      const result = await pool.query(`
        SELECT * FROM contractor_profiles 
        WHERE user_id = $1
        ORDER BY id DESC
        LIMIT 1
      `, [userId]);
      
      // If profile doesn't exist, create a default one
      if (result.rows.length === 0) {
        console.log(`No profile found for contractor ${userId}. Creating a default profile...`);
        
        // Create a default profile with minimal information
        const defaultProfile = {
          user_id: userId,
          business_name: user.full_name ? `${user.full_name}'s Business` : 'New Business',
          description: 'Professional contractor services',
          phone_number: user.phone || null,
          trades: ['General Contractor'],
          service_radius: 25,
          has_liability_insurance: false,
          wallet_balance: 0,
          average_rating: 0,
          total_reviews: 0,
          skills: [],
          bio: null
        };
        
        // Insert the default profile - using double quotes to handle column names properly
        const insertResult = await pool.query(`
          INSERT INTO contractor_profiles (
            "user_id", "business_name", "description", "phone_number", "trades", 
            "service_radius", "has_liability_insurance", "wallet_balance",
            "average_rating", "total_reviews", "skills", "bio", "created_at", "updated_at"
          ) 
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
          )
          RETURNING *
        `, [
          defaultProfile.user_id,
          defaultProfile.business_name,
          defaultProfile.description,
          defaultProfile.phone_number,
          defaultProfile.trades,
          defaultProfile.service_radius,
          defaultProfile.has_liability_insurance,
          defaultProfile.wallet_balance,
          defaultProfile.average_rating,
          defaultProfile.total_reviews,
          defaultProfile.skills,
          defaultProfile.bio
        ]);
        
        if (insertResult.rows.length === 0) {
          return res.status(500).json({ message: "Failed to create default contractor profile" });
        }
        
        // Use the newly created profile
        const profile = insertResult.rows[0];
        const transformedProfile = {
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
          serviceRadius: profile.service_radius,
          walletBalance: parseFloat(profile.wallet_balance) || 0,
          averageRating: parseFloat(profile.average_rating) || 0,
          totalReviews: profile.total_reviews || 0,
          skills: profile.skills || [],
          bio: profile.bio
        };
        
        return res.json({
          profile: transformedProfile,
          isNew: true,
          message: "Created new contractor profile successfully"
        });
      }
      
      // Profile exists, return it
      const profile = result.rows[0];
      const transformedProfile = {
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
        serviceRadius: profile.service_radius,
        walletBalance: parseFloat(profile.wallet_balance) || 0,
        averageRating: parseFloat(profile.average_rating) || 0,
        totalReviews: profile.total_reviews || 0,
        skills: profile.skills || [],
        bio: profile.bio
      };
      
      return res.json({
        profile: transformedProfile,
        isNew: false
      });
    } catch (error) {
      console.error("Error in direct contractor profile endpoint:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the contractor profile",
        error: String(error)
      });
    }
  });
  
  // Direct contractor profile update endpoint
  app.post('/api/direct-contractor-profile/:userId', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Get authenticated user ID
      let authenticatedUserId = req.session?.userId;
      
      // Try from headers if not in session
      if (!authenticatedUserId && req.headers['x-user-id']) {
        authenticatedUserId = parseInt(req.headers['x-user-id'] as string);
      }
      
      // Try from cookies if not in headers
      if (!authenticatedUserId && req.cookies && req.cookies.user_id) {
        try {
          authenticatedUserId = parseInt(req.cookies.user_id);
        } catch (e) {
          console.error("Error parsing user_id from cookies:", e);
        }
      }
      
      if (!authenticatedUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Only allow users to update their own profile
      if (authenticatedUserId !== userId) {
        return res.status(403).json({ message: "You do not have permission to update this profile" });
      }
      
      // Use direct database connection
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
        ssl: { rejectUnauthorized: false }
      });
      
      // Check if user exists and is a contractor
      const userResult = await pool.query(`
        SELECT * FROM users WHERE id = $1
      `, [userId]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const user = userResult.rows[0];
      if (user.user_type !== 'contractor') {
        return res.status(400).json({ message: "User is not a contractor" });
      }
      
      // Check if profile already exists
      const profileResult = await pool.query(`
        SELECT * FROM contractor_profiles WHERE user_id = $1
      `, [userId]);
      
      const profileData = req.body;
      console.log('Processing profile data for update:', JSON.stringify(profileData));
      
      let result;
      
      if (profileResult.rows.length === 0) {
        // Create a new profile
        console.log(`Creating new contractor profile for user ${userId}`);
        
        // Add default values if not provided
        const defaultProfile = {
          user_id: userId,
          business_name: profileData.businessName || `${user.full_name || user.username}'s Business`,
          description: profileData.description || 'Professional contractor services',
          phone_number: profileData.phoneNumber || user.phone || null,
          website: profileData.website || null,
          years_of_experience: profileData.yearsOfExperience || null,
          license_number: profileData.licenseNumber || null,
          insurance_provider: profileData.insuranceProvider || null,
          insurance_policy_number: profileData.insurancePolicyNumber || null,
          has_liability_insurance: profileData.hasLiabilityInsurance || false,
          trades: profileData.trades || ['General Contractor'],
          service_radius: profileData.serviceRadius || 25,
          skills: profileData.skills || [],
          bio: profileData.bio || null,
          wallet_balance: 0,
          average_rating: 0,
          total_reviews: 0
        };
        
        // Insert the new profile
        const insertResult = await pool.query(`
          INSERT INTO contractor_profiles (
            user_id, business_name, description, phone_number, website,
            years_of_experience, license_number, insurance_provider, 
            insurance_policy_number, has_liability_insurance, trades,
            service_radius, skills, bio, wallet_balance, average_rating, 
            total_reviews, created_at, updated_at
          ) 
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
          )
          RETURNING *
        `, [
          defaultProfile.user_id,
          defaultProfile.business_name,
          defaultProfile.description,
          defaultProfile.phone_number,
          defaultProfile.website,
          defaultProfile.years_of_experience,
          defaultProfile.license_number,
          defaultProfile.insurance_provider,
          defaultProfile.insurance_policy_number,
          defaultProfile.has_liability_insurance,
          defaultProfile.trades,
          defaultProfile.service_radius,
          defaultProfile.skills,
          defaultProfile.bio,
          defaultProfile.wallet_balance,
          defaultProfile.average_rating,
          defaultProfile.total_reviews
        ]);
        
        result = insertResult;
        
        console.log(`New contractor profile created for user ${userId}:`, result.rows[0]);
      } else {
        // Update the existing profile
        console.log(`Updating existing contractor profile for user ${userId}`);
        
        // Build dynamic update query
        const updates = [];
        const values = [userId]; // userId will be $1
        let paramIndex = 2;
        
        // Map camelCase keys from request to snake_case columns in DB
        const fieldMappings = {
          businessName: 'business_name',
          description: 'description',
          phoneNumber: 'phone_number',
          website: 'website',
          yearsOfExperience: 'years_of_experience',
          licenseNumber: 'license_number',
          insuranceProvider: 'insurance_provider',
          insurancePolicyNumber: 'insurance_policy_number',
          hasLiabilityInsurance: 'has_liability_insurance',
          trades: 'trades',
          serviceRadius: 'service_radius',
          skills: 'skills',
          bio: 'bio'
        };
        
        // Add each provided field to the update query
        for (const [key, value] of Object.entries(profileData)) {
          const dbField = fieldMappings[key];
          if (dbField) {
            updates.push(`${dbField} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
          }
        }
        
        // Only update if there are fields to update
        if (updates.length > 0) {
          // Add updated_at field
          updates.push(`updated_at = NOW()`);
          
          // Execute update query
          const updateQuery = `
            UPDATE contractor_profiles 
            SET ${updates.join(', ')} 
            WHERE user_id = $1
            RETURNING *
          `;
          
          console.log('Executing update query:', updateQuery);
          console.log('With values:', values);
          
          const updateResult = await pool.query(updateQuery, values);
          result = updateResult;
          
          console.log(`Updated contractor profile for user ${userId}:`, result.rows[0]);
        } else {
          // No updates needed, just return the current profile
          result = profileResult;
          console.log(`No changes needed for contractor profile for user ${userId}`);
        }
      }
      
      // Transform the result to camelCase for frontend
      const profile = result.rows[0];
      const transformedProfile = {
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
        serviceRadius: profile.service_radius,
        walletBalance: parseFloat(profile.wallet_balance) || 0,
        averageRating: parseFloat(profile.average_rating) || 0,
        totalReviews: profile.total_reviews || 0,
        skills: profile.skills || [],
        bio: profile.bio
      };
      
      return res.json({
        message: profileResult.rows.length === 0 ? 
          "Contractor profile created successfully" : 
          "Contractor profile updated successfully",
        profile: transformedProfile,
        isNew: profileResult.rows.length === 0
      });
    } catch (error) {
      console.error("Error in direct contractor profile update endpoint:", error);
      return res.status(500).json({ 
        message: "An error occurred while updating the contractor profile",
        error: String(error)
      });
    }
  });
  
  // Simple endpoint to test case-insensitive implementation
  app.get("/api/case-sensitivity-info", (req: Request, res: Response) => {
    const testUsername = req.query.username as string || 'TestUser';
    const testEmail = req.query.email as string || 'Test@example.com';
    
    // Create lowercase versions for comparison
    const lowerUsername = testUsername.toLowerCase();
    const upperUsername = testUsername.toUpperCase();
    
    res.json({
      input: {
        username: testUsername,
        email: testEmail
      },
      variations: {
        lowercase: lowerUsername,
        uppercase: upperUsername
      },
      caseInsensitiveMethods: {
        javaScript: "String.toLowerCase() comparison",
        database: "LOWER(column_name) = LOWER($1) in SQL queries"
      },
      implementedIn: [
        "getUserByUsername()",
        "getUserByEmail()",
        "getWaitlistEntryByEmail()"
      ]
    });
  });
  
  // Auto-login endpoint for testing - DO NOT USE IN PRODUCTION
  app.get("/api/auto-login", async (req: Request, res: Response) => {
    try {
      // Find the contractor user (ID 3) using authDb for reliable connection
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [user] = await authDb.select().from(users).where(eq(users.id, 3));
      
      if (!user) {
        return res.status(404).json({ message: "Test user not found" });
      }
      
      if (req.session) {
        // Set the user in the session
        req.session.userId = user.id;
        req.session.userType = user.userType;
        
        // Return user data (without password)
        const { password, ...userData } = user;
        return res.json(userData);
      } else {
        return res.status(500).json({ message: "Session not available" });
      }
    } catch (error) {
      console.error("Auto-login error:", error);
      return res.status(500).json({ message: "Auto-login failed" });
    }
  });
  
  // Special deployment test login endpoint for contractor 10
  app.get("/api/contractor10-login", async (req: Request, res: Response) => {
    console.log("Contractor 10 login attempt via debugging endpoint");
    
    try {
      // Try to find contractor 10 by username using authDb
      const { users } = await import("@shared/schema");
      const { eq, sql } = await import("drizzle-orm");
      
      // Case-insensitive search for reliability
      const [user] = await authDb.select()
        .from(users)
        .where(sql`LOWER(${users.username}) = LOWER(${"contractor 10"})`);
      
      if (!user) {
        return res.status(404).json({
          message: "Contractor 10 not found",
          searchResults: {
            usernameSearch: "contractor 10",
            result: "not found"
          }
        });
      }
      
      // Set session data
      req.session.userId = user.id;
      req.session.userType = user.userType;
      req.session.lastAccess = new Date().toISOString();
      req.session.authTimestamp = Date.now();
      
      // Save the session immediately
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Error saving session:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      // Return user data without password
      const { password, ...userWithoutPassword } = user;
      
      return res.status(200).json({
        message: "Contractor 10 login successful via debug endpoint",
        user: userWithoutPassword,
        sessionInfo: {
          id: req.session.id,
          userId: req.session.userId,
          userType: req.session.userType,
          cookie: req.session.cookie ? {
            maxAge: req.session.cookie.maxAge,
            secure: req.session.cookie.secure,
            httpOnly: req.session.cookie.httpOnly
          } : null
        }
      });
    } catch (error) {
      console.error("Contractor 10 debug login error:", error);
      return res.status(500).json({
        message: "Debug login failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Admin endpoint to reset database (delete all jobs and related data)
  app.delete("/api/reset-database", async (req: Request, res: Response) => {
    try {
      console.log("Starting database reset sequence...");
      
      // Using direct SQL queries to handle foreign key constraints properly
      // 1. First delete messages
      await authDb.execute(sql`DELETE FROM messages`);
      console.log("Deleted all messages");
      
      // 2. Delete chat participants
      await authDb.execute(sql`DELETE FROM chat_participants`);
      console.log("Deleted all chat participants");
      
      // 3. Delete chat rooms
      await authDb.execute(sql`DELETE FROM chat_rooms`);
      console.log("Deleted all chat rooms");
      
      // 4. Delete bids
      await authDb.execute(sql`DELETE FROM bids`);
      console.log("Deleted all bids");
      
      // 5. Delete reviews
      await authDb.execute(sql`DELETE FROM reviews`);
      console.log("Deleted all reviews");
      
      // 6. Delete transactions related to jobs
      await authDb.execute(sql`DELETE FROM transactions WHERE "jobId" IS NOT NULL`);
      console.log("Deleted all job-related transactions");
      
      // 7. Finally delete jobs
      await authDb.execute(sql`DELETE FROM jobs`);
      console.log("Deleted all jobs");
      
      res.status(200).json({ message: "Database reset successful. All jobs and related data have been deleted." });
    } catch (error) {
      console.error("Error resetting database:", error);
      res.status(500).json({ message: "Error resetting database" });
    }
  });
  // Enhanced middleware to handle authentication via multiple methods
  app.use((req, res, next) => {
    // Log session info for debugging
    if (req.session) {
      console.log(`Request path: ${req.path} - Session ID: ${req.sessionID}, User ID in session: ${req.session.userId || 'undefined'}`);
    }
    
    // Skip if already authenticated via session
    if (req.session && req.session.userId) {
      console.log(`Using existing session user ID: ${req.session.userId}`);
      return next();
    }
    
    // Try to authenticate via X-User-ID header
    const headerUserId = req.headers['x-user-id'];
    if (headerUserId && typeof headerUserId === 'string') {
      const userId = parseInt(headerUserId);
      if (!isNaN(userId)) {
        console.log("Using backup userId from X-User-ID header for authentication:", userId);
        // Set the userId in the session
        if (req.session) {
          req.session.userId = userId;
          req.session.authTimestamp = Date.now();
          
          // Save the session to ensure it persists
          req.session.save((err) => {
            if (err) {
              console.error("Error saving session with X-User-ID:", err);
            } else {
              console.log("Session updated with X-User-ID header authentication");
            }
            // Always continue with request processing
            next();
          });
          return; // Don't call next() again
        }
      }
    }
    
    // Continue with the request if no auth method was used
    next();
    
    // Special handling for contractor profile updates
    if (req.path.includes('/contractor-profile/') && req.method === 'PATCH') {
      console.log("Processing contractor profile update:", req.path);
      
      // Check for contractor ID in header
      const contractorId = req.headers['x-contractor-id'];
      if (contractorId && typeof contractorId === 'string') {
        const userId = parseInt(contractorId);
        if (!isNaN(userId)) {
          console.log("Found contractor ID in header:", userId);
          if (req.session) {
            req.session.userId = userId;
            req.session.save();
          }
        }
      }
      
      // Check for service area update
      if (req.headers['x-service-area-update'] === 'true') {
        console.log("Processing service area update with headers:", req.headers);
      }
    }
  });

  // Set up upload directories
  const uploadsDir = 'public/uploads';
  const chatImageDir = `${uploadsDir}/chat`;
  const jobImageDir = `${uploadsDir}/jobs`;
  
  // Ensure upload directories exist
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(chatImageDir)) {
      fs.mkdirSync(chatImageDir, { recursive: true });
    }
    if (!fs.existsSync(jobImageDir)) {
      fs.mkdirSync(jobImageDir, { recursive: true });
    }
  } catch (err) {
    console.error("Error creating upload directories:", err);
  }
  
  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Different destinations based on upload type
      if (req.path.includes('/chat-image')) {
        cb(null, chatImageDir);
      } else if (req.path.includes('/job-image')) {
        cb(null, jobImageDir);
      } else {
        cb(null, uploadsDir);
      }
    },
    filename: (req, file, cb) => {
      // Generate unique filename with original extension
      const fileExt = path.extname(file.originalname);
      const uniqueId = uuidv4();
      cb(null, `${uniqueId}${fileExt}`);
    }
  });
  
  // File filter to only allow images
  const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  };
  
  const upload = multer({ 
    storage, 
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max size
    }
  });
  
  // Serve static files from public directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));
  
  // Error handler for file uploads
  const handleUploadError = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message || 'An unknown error occurred during file upload.' });
    }
    next();
  };
  
  // Image upload for chat messages
  app.post('/api/chat-image/upload', upload.single('image'), handleUploadError, (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Return the file path for the client to use
      const relativePath = `/uploads/chat/${req.file.filename}`;
      return res.status(200).json({ 
        message: 'Image uploaded successfully',
        filePath: relativePath
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      return res.status(500).json({ message: 'Server error uploading image' });
    }
  });
  
  // Profile picture upload
  app.post('/api/profile-picture/upload', upload.single('profilePicture'), handleUploadError, async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Get relative path to store in the database
      const relativePath = `/uploads/${req.file.filename}`;
      
      // Update user profile with the new picture path
      // Note: profilePicture field no longer supported in the database
      // Instead, we'll store the image URL in a different way in the future
      const updatedUser = await dbStorage.updateUser(userId, { });
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      return res.status(200).json({
        message: 'Profile picture updated successfully',
        filePath: relativePath,
        user: updatedUser
      });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      return res.status(500).json({ message: 'Server error uploading profile picture' });
    }
  });
  
  // Job image upload
  app.post('/api/job-image/upload', upload.single('jobImage'), handleUploadError, async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Get relative path to store in the database
      const relativePath = `/uploads/jobs/${req.file.filename}`;
      
      // Return the file path for the client to use when creating or updating a job
      return res.status(200).json({
        message: 'Job image uploaded successfully',
        filePath: relativePath
      });
    } catch (error) {
      console.error('Error uploading job image:', error);
      return res.status(500).json({ message: 'Server error uploading job image' });
    }
  });

  // Check if username is available
  app.get("/api/check-username/:username", async (req: Request, res: Response) => {
    try {
      const username = req.params.username;
      if (!username || username.trim() === '') {
        return res.status(400).json({ message: "Username is required" });
      }
      
      const existingUser = await dbStorage.getUserByUsername(username);
      return res.json({ available: !existingUser });
    } catch (error) {
      console.error("Error checking username availability:", error);
      return res.status(500).json({ message: "An error occurred" });
    }
  });
  
  // Check if email is available
  app.get("/api/check-email/:email", async (req: Request, res: Response) => {
    try {
      const email = req.params.email;
      if (!email || email.trim() === '') {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const existingUser = await dbStorage.getUserByEmail(email);
      return res.json({ available: !existingUser });
    } catch (error) {
      console.error("Error checking email availability:", error);
      return res.status(500).json({ message: "An error occurred" });
    }
  });

  // Auth routes
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Import users schema
      const { users } = await import("@shared/schema");
      
      // Check if username or email already exists using authDb
      const [existingUsername] = await authDb.select().from(users).where(eq(users.username, validatedData.username));
      if (existingUsername) {
        return res.status(409).json({ message: "Username already taken" });
      }
      
      const [existingEmail] = await authDb.select().from(users).where(eq(users.email, validatedData.email.toLowerCase()));
      if (existingEmail) {
        return res.status(409).json({ message: "Email already registered" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Create new user with only the fields that are in the database schema
      // Use snake_case for column names matching the database schema
      // Prepare the user data with the proper field mapping
      // Directly use the structure expected by createUser 
      // which handles both camelCase and snake_case behind the scenes
      const userData = {
        username: validatedData.username,
        password: hashedPassword,
        email: validatedData.email.toLowerCase(),
        fullName: validatedData.fullName,
        userType: validatedData.userType,
        phone: validatedData.phone,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('Registration: Prepared user data:', {
        ...userData,
        password: '[REDACTED]'
      });
      
      // Insert user directly with authDb
      const [newUser] = await authDb.insert(users).values(userData).returning();

      // Create profile based on user type
      if (validatedData.userType === "landlord") {
        await dbStorage.createLandlordProfile({
          userId: newUser.id,
          bio: "",
          properties: []
        });
      } else if (validatedData.userType === "contractor") {
        await dbStorage.createContractorProfile({
          userId: newUser.id,
          bio: "",
          skills: [],
          serviceArea: {},
          background: "",
          availability: "",
          city: "",
          state: "",
          serviceRadius: 25,
          serviceZipCodes: []
        });
      }
      
      // Store user in session
      req.session.userId = newUser.id;
      
      // Save the session explicitly with a promise to ensure it's saved before responding
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Error saving session:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      console.log("Registration successful for user:", newUser.id, "Session ID:", req.session.id, "User ID in session:", req.session.userId);
      
      // Exclude password from response
      const { password, ...userWithoutPassword } = newUser;
      
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      
      console.error("Registration error:", error);
      return res.status(500).json({ 
        message: "An error occurred during registration" 
      });
    }
  });

  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      console.log("Login attempt with body:", { ...req.body, password: '[REDACTED]' });
      const validatedData = loginSchema.parse(req.body);
      
      // Import users schema from shared schema
      const { users } = await import("@shared/schema");
      
      // Use the dedicated auth database client with guaranteed TCP/SSL connection
      // Find user by email (case insensitive)
      const [userByEmail] = await authDb.select().from(users).where(eq(users.email, validatedData.email.toLowerCase()));
      
      // Also try to find by username for backward compatibility
      const [userByUsername] = await authDb.select().from(users).where(eq(users.username, validatedData.email));
      
      const user = userByEmail || userByUsername;
      
      if (!user) {
        console.log("Login failed: User not found with email/username:", validatedData.email);
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Verify password
      const passwordValid = await comparePasswords(validatedData.password, user.password);
      if (!passwordValid) {
        console.log("Login failed: Invalid password for user:", user.id);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      console.log("Login successful for user:", user.id);
      
      // Generate token for authentication (instead of relying on cookies)
      const timestamp = Date.now();
      const randomId = randomBytes(8).toString('hex');
      const authToken = `user-${user.id}-${timestamp}-${randomId}`;
      
      // Check if the client wants to use cookies or not
      const noCookies = req.headers['x-no-cookies'] === 'true';
      
      // If cookies aren't explicitly disabled, still try to maintain session support
      // but this won't be the primary authentication method
      if (req.session && !noCookies) {
        try {
          // Set session data with token information
          req.session.userId = user.id;
          req.session.userType = user.userType;
          req.session.lastAccess = new Date().toISOString();
          req.session.authTimestamp = timestamp;
          req.session.mapAuthToken = authToken;
          
          // Save the session
          await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
              if (err) {
                console.warn("Session save failed, continuing with token auth:", err);
              }
              resolve(); // Always resolve, even if session save fails
            });
          });
        } catch (sessionError) {
          console.warn("Session handling error (non-critical):", sessionError);
          // Continue with token-based auth even if session fails
        }
      } else {
        console.log("Using token-only authentication (no cookies)");
      }
      
      // Exclude password from response
      const { password, ...userWithoutPassword } = user;
      
      console.log("Login successful for user:", user.id);
      
      // Send the response with auth token - primary authentication method
      return res
        .status(200)
        .json({
          ...userWithoutPassword,
          authToken,
          authTimestamp: timestamp,
          tokenType: 'bearer', 
          loginMode: noCookies ? 'token_only' : 'hybrid'
        });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      
      console.error("Login error:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "An error occurred during login"
      });
    }
  });
  
  // Direct Token Login - A completely separate auth system that doesn't rely on sessions
  app.post("/api/direct-login", async (req: Request, res: Response) => {
    try {
      console.log("Direct login attempt with:", { ...req.body, password: '[REDACTED]' });
      const validatedData = loginSchema.parse(req.body);
      
      // Import users schema from shared schema
      const { users } = await import("@shared/schema");
      
      // Use the dedicated auth database client with guaranteed TCP/SSL connection
      // Find user by email (case insensitive)
      const [userByEmail] = await authDb.select().from(users).where(eq(users.email, validatedData.email.toLowerCase()));
      
      // Also try to find by username for backward compatibility
      const [userByUsername] = await authDb.select().from(users).where(eq(users.username, validatedData.email));
      
      const user = userByEmail || userByUsername;
      
      if (!user) {
        console.log("Direct login failed: User not found with email/username:", validatedData.email);
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Verify password
      const passwordValid = await comparePasswords(validatedData.password, user.password);
      if (!passwordValid) {
        console.log("Direct login failed: Invalid password for user:", user.id);
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Generate a secure token with userId-timestamp-random
      const timestamp = Date.now();
      const randomPart = randomBytes(12).toString('hex');
      const authToken = `user-${user.id}-${timestamp}-${randomPart}`;
      
      // Try to set userId in session as fallback
      try {
        if (req.session) {
          req.session.userId = user.id;
          req.session.userType = user.user_type; // Use snake_case for production DB compatibility
          req.session.authTimestamp = timestamp;
          req.session.lastAccess = new Date().toISOString();
          
          // Don't await session save to avoid blocking if there are cookie issues
          req.session.save((err) => {
            if (err) {
              console.log("Session save failed during direct login (non-blocking):", err.message);
            } else {
              console.log("Session saved successfully during direct login");
            }
          });
        }
      } catch (sessionError) {
        console.log("Non-critical session error during direct login:", sessionError);
        // Continue without session - token auth will still work
      }
      
      // Exclude password from response
      const { password, ...userWithoutPassword } = user;
      
      console.log("Direct login successful for user:", user.id, "- Token created");
      
      // Set cookie headers directly for more reliability
      try {
        // Set a simple cookie with user ID that will serve as a fallback
        res.setHeader('Set-Cookie', [
          `user_id=${user.id}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`,
          `auth_timestamp=${timestamp}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`
        ]);
      } catch (cookieError) {
        console.log("Non-critical cookie error during direct login:", cookieError);
        // Continue without cookies - token auth will still work
      }
      
      // Return user data with auth token
      return res.status(200).json({
        ...userWithoutPassword,
        authToken,
        timestamp,
        loginMethod: 'direct'
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      
      console.error("Direct login error:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "An error occurred during login"
      });
    }
  });

  // Password reset request route - generates and stores a token
  app.post("/api/forgot-password", async (req: Request, res: Response) => {
    try {
      // Validate the request body
      const validatedData = forgotPasswordSchema.parse(req.body);
      const { email } = validatedData;
      
      // Import schemas
      const { users } = await import("@shared/schema");
      
      // Find user by email (case insensitive) using authDb
      const [user] = await authDb.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!user) {
        // For security reasons, don't reveal that the email doesn't exist
        // Instead, return a success response to prevent email enumeration
        console.log(`Password reset requested for non-existent email: ${email}`);
        return res.status(200).json({ 
          message: "If an account with that email exists, a password reset link has been sent." 
        });
      }
      
      // Generate a secure random token
      const token = randomBytes(32).toString('hex');
      
      // Set expiration time (1 hour from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      
      // Store the token in the database
      await dbStorage.createPasswordResetToken(user.id, token, expiresAt);
      
      // In a production environment, you would send an email with a reset link
      // For development purposes, we'll just return the token in the response
      console.log(`Password reset token generated for user ${user.id}: ${token}`);
      
      return res.status(200).json({ 
        message: "If an account with that email exists, a password reset link has been sent.",
        // In production, remove the following line and only send the token via email
        token: token,
        userId: user.id
      });
    } catch (error) {
      console.error("Error in forgot-password:", error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : "An error occurred" 
      });
    }
  });
  
  // Verify password reset token
  app.get("/api/verify-reset-token/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      // Find token in database
      const resetToken = await dbStorage.getPasswordResetTokenByToken(token);
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "Invalid or expired token" });
      }
      
      // Check if token is already used
      if (resetToken.usedAt !== null) {
        return res.status(400).json({ valid: false, message: "Token has already been used" });
      }
      
      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ valid: false, message: "Token has expired" });
      }
      
      // Token is valid
      return res.status(200).json({ valid: true, userId: resetToken.userId });
    } catch (error) {
      console.error("Error in verify-reset-token:", error);
      return res.status(400).json({ 
        valid: false, 
        message: error instanceof Error ? error.message : "An error occurred" 
      });
    }
  });
  
  // Reset password with token
  app.post("/api/reset-password", async (req: Request, res: Response) => {
    try {
      // Validate request data
      const validatedData = resetPasswordSchema.parse(req.body);
      const { token, password } = validatedData;
      
      // Find token in database
      const resetToken = await dbStorage.getPasswordResetTokenByToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Check if token is already used
      if (resetToken.usedAt !== null) {
        return res.status(400).json({ message: "Token has already been used" });
      }
      
      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Token has expired" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(password);
      
      // Update user's password
      const user = await dbStorage.updateUser(resetToken.userId, { password: hashedPassword });
      if (!user) {
        return res.status(400).json({ message: "Failed to update password" });
      }
      
      // Mark token as used
      await dbStorage.markPasswordResetTokenAsUsed(token);
      
      // Return success response
      return res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error in reset-password:", error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : "An error occurred" 
      });
    }
  });

  // Current user endpoint - Enhanced for more reliable authentication
  app.get("/api/user", async (req: Request, res: Response) => {
    try {
      // Try all available authentication methods in order using the helper function
      const userId = await getUserId(req);
      if (userId) {
        // Use authDb for reliable connection
        const { users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        
        const [user] = await authDb.select().from(users).where(eq(users.id, userId));
        if (user) {
          
          // Store user ID in session for future requests
          if (req.session) {
            req.session.userId = user.id;
            req.session.userType = user.userType;
            req.session.lastUpdated = new Date().toISOString();
            
            // Only call save if needed to avoid unnecessary writes
            if (req.session.userId !== user.id) {
              req.session.save();
            }
          }
          
          // Remove sensitive information before returning
          const { password, ...userWithoutPassword } = user;
          
          // Return the user data without password
          return res.status(200).json(userWithoutPassword);
        }
      }
      
      // Try an alternate approach with direct header if all else failed
      const headerUserId = req.headers['x-user-id'];
      if (headerUserId && typeof headerUserId === 'string') {
        const directUserId = parseInt(headerUserId);
        console.log("Using direct X-User-ID header as fallback:", directUserId);
        
        if (!isNaN(directUserId)) {
          // Get user data directly using the header ID with authDb
          const { users } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          
          const [user] = await authDb.select().from(users).where(eq(users.id, directUserId));
          if (user) {
            console.log("Found user from X-User-ID header:", user.id);
            
            // Also set the session for future requests
            req.session.userId = directUserId;
            req.session.userType = user.userType;
            req.session.save();
            
            // Return user data without password
            const { password, ...userWithoutPassword } = user;
            return res.status(200).json(userWithoutPassword);
          }
        }
      }
      
      // SECOND APPROACH: Use session with authDb
      if (req.session && req.session.userId) {
        console.log("Using session userId:", req.session.userId);
        
        // Use authDb for reliable connection
        const { users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        
        const [user] = await authDb.select().from(users).where(eq(users.id, req.session.userId));
        if (user) {
          console.log("Found user from session:", user.id);
          
          // Return user data without password
          const { password, ...userWithoutPassword } = user;
          return res.status(200).json(userWithoutPassword);
        }
      }
      
      // THIRD APPROACH: Use query parameter as fallback
      const queryUserId = req.query.user_id;
      if (queryUserId && typeof queryUserId === 'string') {
        const userId = parseInt(queryUserId);
        console.log("Using query param userId:", userId);
        
        if (!isNaN(userId)) {
          // Get user data using the query param ID with authDb
          const { users } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          
          const [user] = await authDb.select().from(users).where(eq(users.id, userId));
          if (user) {
            console.log("Found user from query param:", user.id);
            
            // Also set the session for future requests
            req.session.userId = userId;
            req.session.userType = user.userType;
            req.session.save();
            
            // Return user data without password
            const { password, ...userWithoutPassword } = user;
            return res.status(200).json(userWithoutPassword);
          }
        }
      }
      
      // If we get here, no valid authentication was found
      console.log("No valid authentication found");
      return res.status(401).json({ message: "Not authenticated" });
    } catch (error) {
      console.error("Current user error:", error);
      return res.status(500).json({ message: "An error occurred fetching user data" });
    }
  });
  

  
  // Logout endpoint
  app.post("/api/logout", (req: Request, res: Response) => {
    // Clear all cookies
    const cookies = Object.keys(req.cookies || {});
    cookies.forEach(cookie => {
      res.clearCookie(cookie, {
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
      });
    });

    // Clear specific session cookies
    res.clearCookie('sid', {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });
    
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });
    
    // Destroy the session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Error logging out" });
        }
        
        console.log("Session destroyed successfully");
        res.status(200).json({ message: "Logged out successfully" });
      });
    } else {
      console.log("No active session to destroy");
      res.status(200).json({ message: "No active session" });
    }
  });

  // User profile routes
  app.get("/api/user/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get profile based on user type
      let profile;
      if (user.userType === "landlord") {
        profile = await dbStorage.getLandlordProfile(user.id);
      } else if (user.userType === "contractor") {
        profile = await dbStorage.getContractorProfile(user.id);
      }
      
      // Exclude password from response
      const { password, ...userWithoutPassword } = user;
      
      return res.status(200).json({
        user: userWithoutPassword,
        profile
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the user profile" 
      });
    }
  });

  app.patch("/api/user/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Create a copy of the request body to modify it
      const updates = { ...req.body };
      
      // Handle password change request
      if (updates.currentPassword && updates.newPassword) {
        console.log("Password change requested - verifying current password");
        
        // Verify current password
        const isCurrentPasswordValid = await comparePasswords(updates.currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
        
        // Hash the new password
        updates.password = await hashPassword(updates.newPassword);
        
        // Remove temporary password fields
        delete updates.currentPassword;
        delete updates.newPassword;
        delete updates.confirmPassword;
        
        console.log("Password change verified - updating with new hashed password");
      }
      
      // Update user with the potentially modified updates
      const updatedUser = await dbStorage.updateUser(userId, updates);
      
      // Exclude password from response
      const { password, ...userWithoutPassword } = updatedUser!;
      
      return res.status(200).json({
        message: "User updated successfully",
        user: userWithoutPassword
      });
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ 
        message: "An error occurred while updating the user" 
      });
    }
  });
  
  // Contractor profile routes are now handled by contractorProfileRouter
  // which is registered at the beginning of registerRoutes with:
  // app.use('/api/contractor-profile', contractorProfileRouter);

  // Job routes
  app.post("/api/jobs", async (req: Request, res: Response) => {
    try {
      console.log("======== JOB CREATION REQUEST ========");
      console.log("Received job data:", JSON.stringify(req.body, null, 2));
      console.log("Headers for job creation:", {
        'x-user-id': req.headers['x-user-id'],
        'x-auth-token': req.headers['x-auth-token'] ? 'exists' : 'none',
        'x-auth-timestamp': req.headers['x-auth-timestamp'],
        'x-request-for': req.headers['x-request-for'],
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'request-path': req.path,
        'cookie': req.headers.cookie ? 'exists' : 'none',
        'session-id': req.sessionID,
        'session-user-id': req.session?.userId
      });
      
      // Try to create a valid Zod schema from the data
      let validatedData;
      try {
        validatedData = jobSchema.parse(req.body);
        console.log("Job data validation successful");
      } catch (validationError) {
        console.error("Job data validation failed:", validationError);
        throw validationError;
      }
      
      // Get the landlord ID - with enhanced debugging
      let landlordId = null;
      
      // Try multiple auth methods
      if (req.body.landlordId) {
        landlordId = req.body.landlordId;
        console.log("Using landlordId from request body:", landlordId);
      } else {
        landlordId = await getUserId(req);
        console.log("Using landlordId from auth methods:", landlordId);
      }
      
      if (!landlordId) {
        console.log("⚠️ No landlord ID found in request - authentication failed");
        return res.status(400).json({ 
          message: "Landlord ID is required. Please log in or provide a landlordId." 
        });
      }
      
      // Log the validated data to see what we're working with 
      console.log("Validated data structure:", JSON.stringify(validatedData, null, 2));
      
      // Create location object to store address data and category
      const location = {
        address: validatedData.address || "",
        city: validatedData.city || "",
        state: validatedData.state || "",
        zipCode: validatedData.zipCode || "",
        category: validatedData.category || "general" // Store category in location object since there's no category column
      };
      
      // Make sure budget is a number if provided
      let budget = null;
      if (validatedData.budget) {
        budget = typeof validatedData.budget === 'string' 
          ? parseFloat(validatedData.budget) 
          : validatedData.budget;
        
        // Ensure it's a valid number
        if (isNaN(budget)) budget = null;
      }
      
      // Prepare job data with location object
      const jobData = {
        title: validatedData.title,
        description: validatedData.description,
        landlordId: landlordId,
        pricingType: validatedData.pricingType || "fixed",
        location: location,
        budget: budget,
        isUrgent: validatedData.isUrgent || false,
        categoryTags: validatedData.categoryTags || [validatedData.category || "general"],
        // Convert string date to Date object if it exists
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        images: validatedData.images || []
      };
      
      console.log("Final job data to be inserted:", JSON.stringify(jobData, null, 2));
      
      console.log("Creating job with data:", JSON.stringify(jobData));
      
      // Create new job
      const newJob = await dbStorage.createJob(jobData);
      
      return res.status(201).json({
        message: "Job created successfully",
        job: newJob
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      
      console.error("Error creating job:", error);
      return res.status(500).json({ 
        message: "An error occurred while creating the job" 
      });
    }
  });

  app.get("/api/jobs", async (req: Request, res: Response) => {
    try {
      // Extract search query from query parameters
      const searchQuery = req.query.q as string | undefined;
      
      // Fetch all available jobs
      const availableJobs = await dbStorage.getAvailableJobs();
      
      // Augment jobs with bid counts
      const jobsWithBidCounts = await Promise.all(availableJobs.map(async (job) => {
        const bidCount = await dbStorage.getBidCountForJob(job.id);
        return {
          ...job,
          bidCount
        };
      }));
      
      // Apply search filter if query is provided
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const filteredJobs = jobsWithBidCounts.filter(job => {
          const matchesTitle = job.title.toLowerCase().includes(query);
          const matchesDescription = job.description.toLowerCase().includes(query);
          
          // Check if job has category tags that match
          const matchesTags = Array.isArray(job.categoryTags) && 
            job.categoryTags.some(tag => 
              typeof tag === 'string' && tag.toLowerCase().includes(query)
            );
          
          // Check if job has location data that matches
          const matchesLocation = typeof job.location === 'object' && 
            job.location !== null &&
            (
              ((job.location as any)?.city && (job.location as any).city.toLowerCase().includes(query)) ||
              ((job.location as any)?.state && (job.location as any).state.toLowerCase().includes(query))
            );
          
          return matchesTitle || matchesDescription || matchesTags || matchesLocation;
        });
        
        return res.status(200).json(filteredJobs);
      }
      
      // Return all jobs if no search query
      return res.status(200).json(jobsWithBidCounts);
    } catch (error) {
      console.error("Error fetching available jobs:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching available jobs" 
      });
    }
  });

  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      const job = await dbStorage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Get bid count for this job
      const bidCount = await dbStorage.getBidCountForJob(job.id);
      
      // Determine if the requester is authorized to see detailed bid information
      const userId = await getUserId(req);
      const isLandlord = userId && job.landlordId === userId;
      
      // Get bids for this job if user is the landlord or if job is assigned to this contractor
      let bids = [];
      if (userId && (isLandlord || (job.contractorId && job.contractorId === userId))) {
        // Get all bids for this job
        bids = await dbStorage.getBidsForJob(jobId);
        console.log(`Found ${bids.length} bids for job ${jobId} - showing to authorized user ${userId}`);
        
        // If the user is the landlord, enhance bids with contractor information
        if (isLandlord && bids.length > 0) {
          // Enhance each bid with contractor profile info
          for (let i = 0; i < bids.length; i++) {
            const bid = bids[i];
            // Get contractor basic info
            const contractor = await dbStorage.getUser(bid.contractorId);
            
            // Get contractor profile if available 
            const contractorProfile = await dbStorage.getContractorProfile(bid.contractorId);
            
            // Add contractor info to the bid
            bids[i] = {
              ...bid,
              contractor: {
                id: bid.contractorId,
                name: contractor?.name || contractor?.username || 'Unknown',
                ...(contractorProfile ? {
                  businessName: contractorProfile.businessName,
                  trades: contractorProfile.trades,
                  rating: contractorProfile.rating
                } : {})
              }
            };
          }
        }
      }
      
      // If job has a contractor assigned, try to get the chat room ID
      if (job.contractorId) {
        const chatRoom = await dbStorage.getChatRoomByJob(job.id);
        if (chatRoom) {
          (job as any).chatRoomId = chatRoom.id;
        }
      }
      
      // Check if viewing user has already bid on this job
      let userBid = null;
      if (userId && !isLandlord) {
        userBid = await dbStorage.getBidByJobAndContractor(jobId, userId);
      }
      
      // Return the job with bid information
      return res.status(200).json({
        job: {
          ...job,
          bidCount
        },
        bids: isLandlord ? bids : [], // Only show all bids to landlord
        userBid: userBid // Show user's own bid if applicable
      });
    } catch (error) {
      console.error("Error fetching job:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the job" 
      });
    }
  });

  app.patch("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      const job = await dbStorage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Process the request body before update
      // Remove startTime from the job data since it doesn't exist in database
      const { startTime, ...updateDataRaw } = req.body;
      
      // Process date fields to ensure they are Date objects
      const updateDataWithoutStartTime = { ...updateDataRaw };
      
      // Convert startDate string to Date if it exists
      if (updateDataWithoutStartTime.startDate && typeof updateDataWithoutStartTime.startDate === 'string') {
        updateDataWithoutStartTime.startDate = new Date(updateDataWithoutStartTime.startDate);
      }
      
      // Convert completionDate string to Date if it exists
      if (updateDataWithoutStartTime.completionDate && typeof updateDataWithoutStartTime.completionDate === 'string') {
        updateDataWithoutStartTime.completionDate = new Date(updateDataWithoutStartTime.completionDate);
      }
      
      // Update job (with startTime explicitly removed and dates converted)
      const updatedJob = await dbStorage.updateJob(jobId, updateDataWithoutStartTime);
      
      return res.status(200).json({
        message: "Job updated successfully",
        job: updatedJob
      });
    } catch (error) {
      console.error("Error updating job:", error);
      return res.status(500).json({ 
        message: "An error occurred while updating the job" 
      });
    }
  });
  
  // Separate endpoint for updating job progress
  app.patch("/api/jobs/:id/progress", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      // Get the job
      const job = await dbStorage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Validate progress value
      const { progress } = req.body;
      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        return res.status(400).json({ 
          message: "Invalid progress value. Must be a number between 0 and 100." 
        });
      }
      
      // Only the assigned contractor can update the progress
      const userId = await getUserId(req);
      if (!userId || userId !== job.contractorId) {
        return res.status(403).json({ 
          message: "Only the assigned contractor can update job progress" 
        });
      }
      
      // Update job progress
      const updatedJob = await dbStorage.updateJob(jobId, { progress });
      
      return res.status(200).json({
        message: "Job progress updated successfully",
        job: updatedJob
      });
    } catch (error) {
      console.error("Error updating job progress:", error);
      return res.status(500).json({ 
        message: "An error occurred while updating the job progress" 
      });
    }
  });
  
  // Endpoint for contractors to request job completion
  app.patch("/api/jobs/:id/completion-request", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      // Get the job
      const job = await dbStorage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Only the assigned contractor can request completion
      const userId = await getUserId(req);
      if (!userId || userId !== job.contractorId) {
        return res.status(403).json({ 
          message: "Only the assigned contractor can request job completion" 
        });
      }
      
      // Job must be in progress to request completion
      if (job.status !== "in_progress") {
        return res.status(400).json({ 
          message: "Only in-progress jobs can be marked for completion" 
        });
      }
      
      // Update job status to completed (since completion_requested isn't in the database enum)
      // Note: We're proceeding directly to completed since the status enum doesn't have completion_requested
      const updatedJob = await dbStorage.updateJob(jobId, { 
        status: "completed",
        progress: 100 // Also set progress to 100%
      });
      
      return res.status(200).json({
        message: "Job completion requested successfully",
        job: updatedJob
      });
    } catch (error) {
      console.error("Error requesting job completion:", error);
      return res.status(500).json({ 
        message: "An error occurred while requesting job completion" 
      });
    }
  });

  app.get("/api/users/:userId/jobs", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let userJobs: any[] = [];
      if (user.userType === "landlord") {
        userJobs = await dbStorage.getJobsByLandlord(userId);
      } else if (user.userType === "contractor") {
        userJobs = await dbStorage.getJobsByContractor(userId);
      }
      
      console.log(`Found ${userJobs.length} jobs for user ${userId} (${user.userType})`);
      
      // Process each job with promises that will be resolved together
      const processJobPromises = userJobs.map(async (job) => {
        try {
          // Create a copy of the job to avoid modifying the original
          const processedJob = { ...job };
          
          // Get bid count for this job
          const bidCount = await dbStorage.getBidCountForJob(job.id);
          processedJob.bidCount = bidCount;
          
          // Ensure location data is in expected format
          if (processedJob.location && typeof processedJob.location === 'string') {
            try {
              processedJob.location = JSON.parse(processedJob.location);
            } catch (e) {
              console.error(`Error parsing location for job ${processedJob.id}:`, e);
              // Provide a default structure if parsing fails
              processedJob.location = { address: "", city: "", state: "", zipCode: "" };
            }
          }
          
          // Add chat room ID if this job has a contractor assigned
          if (processedJob.contractorId) {
            try {
              const chatRoom = await dbStorage.getChatRoomByJob(processedJob.id);
              if (chatRoom) {
                processedJob.chatRoomId = chatRoom.id;
              }
            } catch (chatErr) {
              console.error(`Error getting chat room for job ${processedJob.id}:`, chatErr);
            }
          }
          
          return processedJob;
        } catch (jobErr) {
          console.error(`Error processing job ${job.id}:`, jobErr);
          return job; // Return the job even if there's an error
        }
      });
      
      // Wait for all jobs to be processed
      const processedJobs = await Promise.all(processJobPromises);
      
      return res.status(200).json(processedJobs);
    } catch (error) {
      console.error("Error fetching user jobs:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the user's jobs",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Bid routes
  app.post("/api/bids", async (req: Request, res: Response) => {
    try {
      // Get the user ID from the session
      const userId = await getUserId(req);
      
      console.log("Creating bid - Auth user ID:", userId);
      console.log("Bid request body:", req.body);
      
      if (!userId) {
        return res.status(401).json({ message: "You must be logged in to submit a bid" });
      }
      
      // Get the user to ensure they're a contractor
      const user = await dbStorage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.userType !== 'contractor') {
        return res.status(403).json({ message: "Only contractors can submit bids" });
      }
      
      console.log("User validated for bid creation:", user.id, user.username);
      
      const validatedData = bidSchema.parse(req.body);
      console.log("Validated bid data:", validatedData);
      
      // Process date fields if they're not already Date objects
      const processedData = { ...validatedData };
      
      // proposedStartDate already gets transformed to a Date object by Zod schema
      // but let's ensure it's valid in case someone bypasses the schema
      if (processedData.proposedStartDate && typeof processedData.proposedStartDate === 'string') {
        processedData.proposedStartDate = new Date(processedData.proposedStartDate);
      }
      
      // Create new bid, always using the authenticated contractor's ID
      const bidData = {
        ...processedData,
        jobId: req.body.jobId,
        contractorId: userId, // Use the authenticated user's ID
      };
      
      console.log("Final bid data to be stored:", bidData);
      
      const newBid = await dbStorage.createBid(bidData);
      
      console.log("Bid created successfully:", newBid);
      
      return res.status(201).json({
        message: "Bid created successfully",
        bid: newBid
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      
      console.error("Error creating bid:", error);
      return res.status(500).json({ 
        message: "An error occurred while creating the bid" 
      });
    }
  });

  app.get("/api/jobs/:jobId/bids", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      if (isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      const bids = await dbStorage.getBidsForJob(jobId);
      return res.status(200).json(bids);
    } catch (error) {
      console.error("Error fetching job bids:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the job bids" 
      });
    }
  });
  
  // Get bid count for a job
  app.get("/api/jobs/:jobId/bid-count", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      if (isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      const count = await dbStorage.getBidCountForJob(jobId);
      return res.status(200).json({ count });
    } catch (error) {
      console.error("Error fetching bid count:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the bid count" 
      });
    }
  });
  
  // Get bids by contractor ID
  app.get("/api/bids/contractor", async (req: Request, res: Response) => {
    try {
      // Get contractor ID from session, query params, or headers
      let contractorId: number | null = null;
      
      // First try to get from session
      if (req.session.userId) {
        contractorId = parseInt(req.session.userId.toString());
      }
      
      // Then try from query param
      if (!contractorId && req.query.contractorId) {
        contractorId = parseInt(req.query.contractorId as string);
      }
      
      // Finally, try from header
      if (!contractorId && req.headers['x-user-id']) {
        contractorId = parseInt(req.headers['x-user-id'] as string);
      }
      
      if (!contractorId || isNaN(contractorId)) {
        return res.status(400).json({ message: "Invalid or missing contractor ID" });
      }
      
      console.log(`Fetching bids for contractor ID: ${contractorId}`);
      
      // Force cache invalidation to get the latest bids
      const bids = await dbStorage.getBidsByContractor(contractorId);
      console.log(`Found ${bids.length} bids for contractor ${contractorId}:`, bids);
      
      // Get job details for each bid - use Promise.all for parallel requests
      const jobPromises = bids.map(bid => dbStorage.getJob(bid.jobId));
      const jobs = await Promise.all(jobPromises);
      
      // Create a map of jobId to job
      const jobMap: Record<number, any> = {};
      jobs.forEach(job => {
        if (job) {
          jobMap[job.id] = job;
        }
      });
      
      // Add job details directly to bids with proper typing and error handling
      const enrichedBids = bids.map(bid => {
        const job = jobMap[bid.jobId];
        return {
          ...bid,
          job: job || { 
            id: bid.jobId,
            title: "Unknown Job",
            status: "unknown"
          },
          timeEstimate: bid.timeEstimate || "1-2 days", // Add default time estimate if missing
          // Add additional fields for better UI rendering
          formattedDate: new Date(bid.createdAt).toLocaleDateString(),
          formattedAmount: `$${bid.amount.toFixed(2)}`
        };
      });
      
      // Sort by creation date (newest first)
      enrichedBids.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Return the enhanced bids with job details
      return res.json(enrichedBids);
    } catch (error) {
      console.error("[API Error] Get Contractor Bids:", error);
      return res.status(500).json({ message: "Failed to fetch contractor bids" });
    }
  });
  
  // Get all bids for a specific job
  app.get("/api/bids/job/:jobId", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      if (isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      const bids = await dbStorage.getBidsForJob(jobId);
      return res.json(bids);
    } catch (error) {
      console.error(`Error fetching bids for job:`, error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/bids", async (req: Request, res: Response) => {
    try {
      const contractorId = req.query.contractorId ? parseInt(req.query.contractorId as string) : undefined;
      
      if (contractorId !== undefined) {
        if (isNaN(contractorId)) {
          return res.status(400).json({ message: "Invalid contractor ID" });
        }
        
        const bids = await dbStorage.getBidsByContractor(contractorId);
        
        // Get all job IDs from bids
        const jobIds = [...new Set(bids.map(bid => bid.jobId))];
        
        // Get job details for all these jobs with bid counts
        const bidJobs = [];
        for (const jobId of jobIds) {
          try {
            const job = await dbStorage.getJob(jobId);
            if (job) {
              // Get bid count for this job
              const bidCount = await dbStorage.getBidCountForJob(job.id);
              bidJobs.push({
                ...job,
                bidCount
              });
            }
          } catch (err) {
            console.error(`Error fetching job ${jobId}:`, err);
          }
        }
        
        // Return both bids and related jobs
        return res.status(200).json({
          bids,
          jobs: bidJobs
        });
      } else {
        return res.status(400).json({ message: "Contractor ID is required" });
      }
    } catch (error) {
      console.error("Error fetching contractor bids:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the contractor's bids" 
      });
    }
  });
  
  // Get all bids for a landlord's jobs
  app.get("/api/landlord/:landlordId/bids", async (req: Request, res: Response) => {
    try {
      const landlordId = parseInt(req.params.landlordId);
      if (isNaN(landlordId)) {
        return res.status(400).json({ message: "Invalid landlord ID" });
      }
      
      // First get all of the landlord's jobs
      const landlordJobs = await dbStorage.getJobsByLandlord(landlordId);
      
      if (!landlordJobs || landlordJobs.length === 0) {
        return res.status(200).json([]);
      }
      
      // Then collect all bids for each job
      const jobIds = landlordJobs.map(job => job.id);
      
      // Use Promise.all to fetch bids for all jobs in parallel
      const bidPromises = jobIds.map(jobId => dbStorage.getBidsForJob(jobId));
      const bidsArrays = await Promise.all(bidPromises);
      
      // Flatten the array of arrays into a single array of bids
      const allBids = bidsArrays.flat();
      
      return res.status(200).json(allBids);
    } catch (error) {
      console.error("Error fetching landlord bids:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the landlord's bids" 
      });
    }
  });

  app.patch("/api/bids/:id", async (req: Request, res: Response) => {
    try {
      const bidId = parseInt(req.params.id);
      if (isNaN(bidId)) {
        return res.status(400).json({ message: "Invalid bid ID" });
      }
      
      const bid = await dbStorage.getBid(bidId);
      if (!bid) {
        return res.status(404).json({ message: "Bid not found" });
      }
      
      // Process the request body before update
      const updateData = { ...req.body };
      
      // Convert any date fields from strings to Date objects
      if (updateData.proposedStartDate && typeof updateData.proposedStartDate === 'string') {
        updateData.proposedStartDate = new Date(updateData.proposedStartDate);
      }
      
      // Update bid with processed data
      const updatedBid = await dbStorage.updateBid(bidId, updateData);
      
      // If bid is accepted, update the job with the contractor
      if (req.body.status === "accepted") {
        const job = await dbStorage.getJob(bid.jobId);
        if (job) {
          await dbStorage.updateJob(job.id, {
            status: "in_progress",
            contractorId: bid.contractorId
          });
          
          // Create a chat room for the job if it doesn't exist
          let chatRoom = await dbStorage.getChatRoomByJob(job.id);
          if (!chatRoom) {
            chatRoom = await dbStorage.createChatRoom(job.id);
            await dbStorage.addParticipantToChat(chatRoom.id, job.landlordId);
            await dbStorage.addParticipantToChat(chatRoom.id, bid.contractorId);
          }
        }
      }
      
      return res.status(200).json({
        message: "Bid updated successfully",
        bid: updatedBid
      });
    } catch (error) {
      console.error("Error updating bid:", error);
      return res.status(500).json({ 
        message: "An error occurred while updating the bid" 
      });
    }
  });

  // Transaction routes (for Stripe integration)
  app.post("/api/payment-intent", async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe is not configured" });
      }
      
      const { amount, userId, jobId, description } = req.body;
      
      // Calculate 2% fee (minimum $1)
      const fee = Math.max(amount * 0.02, 1);
      const totalAmount = amount + fee;
      
      // Create a PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          userId,
          jobId,
          fee,
        },
      });

      // Record the transaction
      await dbStorage.createTransaction({
        userId,
        amount: totalAmount,
        fee,
        type: "deposit",
        status: "pending",
        reference: paymentIntent.id,
        jobId,
        description
      });
      
      return res.status(200).json({
        clientSecret: paymentIntent.client_secret
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      return res.status(500).json({ 
        message: "An error occurred while creating the payment intent" 
      });
    }
  });

  app.post("/api/payment-success", async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe is not configured" });
      }
      
      const { paymentIntentId } = req.body;
      
      // Verify the payment was successful
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status === "succeeded") {
        // Retrieve all transactions
        const allTransactions = Array.from((storage as any).transactions.values()) as Transaction[];
        // Find the transaction by reference
        const matchingTransactions = allTransactions.filter(
          (t: Transaction) => t.reference === paymentIntentId
        );
        
        if (matchingTransactions.length > 0) {
          const transaction: Transaction = matchingTransactions[0];
          
          // Update the transaction status directly instead of via user
          const updatedTransaction: Transaction = {
            ...transaction,
            status: "completed"
          };
          
          (storage as any).transactions.set(transaction.id, updatedTransaction);
          
          // Update the user's wallet balance
          const user = await dbStorage.getUser(transaction.userId);
          if (user) {
            if (user.userType === "landlord") {
              const profile = await dbStorage.getLandlordProfile(user.id);
              if (profile) {
                await dbStorage.updateLandlordProfile(user.id, {
                  walletBalance: profile.walletBalance + (transaction.amount - transaction.fee)
                });
              }
            } else if (user.userType === "contractor") {
              const profile = await dbStorage.getContractorProfile(user.id);
              if (profile) {
                await dbStorage.updateContractorProfile(user.id, {
                  walletBalance: profile.walletBalance + (transaction.amount - transaction.fee)
                });
              }
            }
          }
          
          return res.status(200).json({
            message: "Payment successful and balance updated"
          });
        } else {
          return res.status(404).json({ message: "Transaction not found" });
        }
      } else {
        return res.status(400).json({ 
          message: "Payment was not successful" 
        });
      }
    } catch (error) {
      console.error("Error processing payment success:", error);
      return res.status(500).json({ 
        message: "An error occurred while processing the payment success" 
      });
    }
  });

  // Messaging routes
  // Get or create a chat room by job ID
  app.get("/api/chat/job/:jobId", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      if (isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      // Get user ID for potentially adding a contractor
      const userId = await getUserId(req);
      
      // Get or create a chat room for the job
      let chatRoom = await dbStorage.getChatRoomByJob(jobId);
      if (!chatRoom) {
        const job = await dbStorage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }
        
        // Create the chat room
        chatRoom = await dbStorage.createChatRoom(jobId);
        
        // Always add the landlord
        await dbStorage.addParticipantToChat(chatRoom.id, job.landlordId);
        
        // If the job has an assigned contractor, add them
        if (job.contractorId) {
          await dbStorage.addParticipantToChat(chatRoom.id, job.contractorId);
        } 
        // If the current user is not the landlord, add them as a participant (they're inquiring)
        else if (userId && userId !== job.landlordId) {
          await dbStorage.addParticipantToChat(chatRoom.id, userId);
          console.log(`Added user ${userId} as participant to chat room ${chatRoom.id} for job ${jobId}`);
        }
      }
      
      // Get messages for the chat room
      const messages = await dbStorage.getMessages(chatRoom.id);
      
      // Return the chat room and messages
      return res.status(200).json(chatRoom);
    } catch (error) {
      console.error("Error fetching chat:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the chat" 
      });
    }
  });
  
  // This endpoint was removed to eliminate duplicate routes

  app.get("/api/chat/room/:chatRoomId", async (req: Request, res: Response) => {
    try {
      const chatRoomId = parseInt(req.params.chatRoomId);
      if (isNaN(chatRoomId)) {
        return res.status(400).json({ message: "Invalid chat room ID" });
      }
      
      // Get the chat room
      const chatRoom = await dbStorage.getChatRoom(chatRoomId);
      if (!chatRoom) {
        return res.status(404).json({ message: "Chat room not found" });
      }
      
      // Get messages for the chat room
      const messages = await dbStorage.getMessages(chatRoomId);
      
      return res.status(200).json({
        chatRoom,
        messages
      });
    } catch (error) {
      console.error("Error fetching chat room:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the chat room" 
      });
    }
  });

  // Get unread message count for a user across all chat rooms
  app.get("/api/chat/unread", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get all chat rooms for this user
      const participants = await db
        .select()
        .from(chatParticipants)
        .where(eq(chatParticipants.userId, userId));
      
      if (participants.length === 0) {
        return res.status(200).json({ unreadCounts: [] });
      }
      
      // For each chat room, get unread message count
      const unreadCounts = await Promise.all(
        participants.map(async (participant) => {
          // Get messages newer than last_read
          const lastRead = participant.lastRead || new Date(0); // Default to epoch if null
          
          const unreadMessages = await db
            .select({ count: count() })
            .from(messages)
            .where(
              and(
                eq(messages.chatRoomId, participant.chatRoomId),
                gt(messages.createdAt, lastRead),
                ne(messages.senderId, userId) // Don't count user's own messages
              )
            );
          
          // Get chat room details 
          const chatRoom = await dbStorage.getChatRoom(participant.chatRoomId);
          
          // Get job details if this chat is for a job
          let jobDetails = null;
          if (chatRoom && chatRoom.jobId) {
            const job = await dbStorage.getJob(chatRoom.jobId);
            if (job) {
              // Get other participant name
              const otherParticipantId = job.landlordId === userId ? job.contractorId : job.landlordId;
              const otherUser = otherParticipantId ? await dbStorage.getUser(otherParticipantId) : null;
              
              jobDetails = {
                id: job.id,
                title: job.title,
                otherParticipantId,
                otherParticipantName: otherUser ? otherUser.fullName || otherUser.username : 'Unknown'
              };
            }
          }
          
          return {
            chatRoomId: participant.chatRoomId,
            unreadCount: unreadMessages[0]?.count || 0,
            lastRead: lastRead,
            jobDetails
          };
        })
      );
      
      return res.status(200).json({ unreadCounts });
    } catch (error) {
      console.error("Error fetching unread messages:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching unread messages" 
      });
    }
  });

  app.post("/api/chat/room/:chatRoomId/messages", async (req: Request, res: Response) => {
    try {
      const chatRoomId = parseInt(req.params.chatRoomId);
      if (isNaN(chatRoomId)) {
        return res.status(400).json({ message: "Invalid chat room ID" });
      }
      
      const { content, type = "text", senderId } = req.body;
      
      // Check if the chat room exists
      let chatRoom = await dbStorage.getChatRoom(chatRoomId);
      
      // If not found, check if this is a job ID (common mistake)
      if (!chatRoom) {
        const job = await dbStorage.getJob(chatRoomId);
        if (job) {
          // This is a job ID, let's get or create the chat room for this job
          chatRoom = await dbStorage.getChatRoomByJob(job.id);
          
          // If still not found, create a new chat room
          if (!chatRoom) {
            chatRoom = await dbStorage.createChatRoom(job.id);
            
            // Always add the landlord to the chat
            await dbStorage.addParticipantToChat(chatRoom.id, job.landlordId);
            
            // If the job has an assigned contractor, add them
            if (job.contractorId) {
              await dbStorage.addParticipantToChat(chatRoom.id, job.contractorId);
            }
            
            // Add the sender (if they're not already added)
            if (senderId != job.landlordId && 
                (!job.contractorId || senderId != job.contractorId)) {
              await dbStorage.addParticipantToChat(chatRoom.id, senderId);
            }
            
            console.log(`Created new chat room ${chatRoom.id} for job ${job.id}`);
          }
        }
      }
      
      if (!chatRoom) {
        return res.status(404).json({ 
          message: "Chat room not found or cannot be created",
          details: "The chat room ID is invalid or the job doesn't exist" 
        });
      }
      
      // Create new message with the correct chat room ID
      const newMessage = await dbStorage.createMessage({
        chatRoomId: chatRoom.id,
        senderId,
        content,
        type
      });
      
      return res.status(201).json({
        message: "Message sent successfully",
        chatMessage: newMessage
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      return res.status(500).json({ 
        message: "An error occurred while sending the message",
        error: error.message || 'Unknown error'
      });
    }
  });
  
  // Mark messages as read for a specific user in a chat room
  app.post("/api/chat/room/:chatRoomId/mark-read", async (req: Request, res: Response) => {
    try {
      const chatRoomId = parseInt(req.params.chatRoomId);
      if (isNaN(chatRoomId)) {
        return res.status(400).json({ message: "Invalid chat room ID" });
      }
      
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if the user is a participant in this chat room
      const participants = await db
        .select()
        .from(chatParticipants)
        .where(
          and(
            eq(chatParticipants.chatRoomId, chatRoomId),
            eq(chatParticipants.userId, userId)
          )
        );
      
      if (participants.length === 0) {
        return res.status(403).json({ 
          message: "User is not a participant in this chat room" 
        });
      }
      
      // Update the last_read timestamp for this user
      await db
        .update(chatParticipants)
        .set({ lastRead: new Date() })
        .where(
          and(
            eq(chatParticipants.chatRoomId, chatRoomId),
            eq(chatParticipants.userId, userId)
          )
        );
      
      return res.status(200).json({
        message: "Messages marked as read",
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      return res.status(500).json({ 
        message: "An error occurred while marking messages as read" 
      });
    }
  });

  // Review routes
  app.post("/api/reviews", async (req: Request, res: Response) => {
    try {
      const validatedData = reviewSchema.parse({
        rating: req.body.rating,
        comment: req.body.comment
      });
      
      // Create new review
      const newReview = await dbStorage.createReview({
        ...validatedData,
        jobId: req.body.jobId,
        reviewerId: req.body.reviewerId,
        revieweeId: req.body.revieweeId
      });
      
      // Update reviewee's reputation/rating
      const revieweeUser = await dbStorage.getUser(req.body.revieweeId);
      
      if (revieweeUser) {
        // Determine if we're updating a landlord or contractor profile
        if (revieweeUser.userType === 'landlord') {
          // Get current landlord profile
          const landlordProfile = await dbStorage.getLandlordProfile(req.body.revieweeId);
          
          if (landlordProfile) {
            // Calculate new average rating
            const currentTotal = landlordProfile.totalRatings || 0;
            const currentAvg = landlordProfile.averageRating || 0;
            const newRating = req.body.rating;
            
            // Calculate the new average
            const newTotalRatings = currentTotal + 1;
            const newAvgRating = ((currentAvg * currentTotal) + newRating) / newTotalRatings;
            
            // Update the landlord profile
            await dbStorage.updateLandlordProfile(req.body.revieweeId, {
              averageRating: newAvgRating,
              totalRatings: newTotalRatings
            });
          }
        } else if (revieweeUser.userType === 'contractor') {
          // Get current contractor profile
          const contractorProfile = await dbStorage.getContractorProfile(req.body.revieweeId);
          
          if (contractorProfile) {
            // Calculate new average rating
            const currentTotal = contractorProfile.totalRatings || 0;
            const currentAvg = contractorProfile.averageRating || 0;
            const newRating = req.body.rating;
            
            // Calculate the new average
            const newTotalRatings = currentTotal + 1;
            const newAvgRating = ((currentAvg * currentTotal) + newRating) / newTotalRatings;
            
            // Update the contractor profile
            await dbStorage.updateContractorProfile(req.body.revieweeId, {
              averageRating: newAvgRating,
              totalRatings: newTotalRatings
            });
          }
        }
      }
      
      return res.status(201).json({
        message: "Review submitted successfully",
        review: newReview
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      
      console.error("Error creating review:", error);
      return res.status(500).json({ 
        message: "An error occurred while creating the review" 
      });
    }
  });

  app.get("/api/users/:userId/reviews", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const reviews = await dbStorage.getReviewsByReviewee(userId);
      return res.status(200).json(reviews);
    } catch (error) {
      console.error("Error fetching user reviews:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching the user reviews" 
      });
    }
  });

  // Waitlist routes
  app.post("/api/waitlist", async (req: Request, res: Response) => {
    try {
      // Validate request body against schema
      const validatedData = waitlistSchema.parse(req.body);
      
      // Check if email already exists in waitlist
      const existingEntry = await dbStorage.getWaitlistEntryByEmail(validatedData.email);
      if (existingEntry) {
        return res.status(409).json({ 
          message: "This email is already registered on our waitlist" 
        });
      }
      
      // Create new waitlist entry
      const newEntry = await dbStorage.createWaitlistEntry({
        fullName: validatedData.fullName,
        email: validatedData.email,
        userType: validatedData.userType,
      });
      
      return res.status(201).json({ 
        message: "Thank you for joining our waitlist!", 
        entry: newEntry 
      });
    } catch (error) {
      if (error instanceof ZodError) {
        // Convert Zod errors to a more friendly format
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      
      // Handle other errors
      console.error("Waitlist signup error:", error);
      return res.status(500).json({ 
        message: "An error occurred while processing your request" 
      });
    }
  });

  // Get all waitlist entries for admin purposes
  app.get("/api/waitlist", async (req: Request, res: Response) => {
    try {
      const entries = await dbStorage.getWaitlistEntries();
      return res.status(200).json(entries);
    } catch (error) {
      console.error("Error fetching waitlist entries:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching waitlist entries" 
      });
    }
  });
  
  // Get jobs for a contractor (including both assigned jobs and jobs with accepted bids)
  // New endpoint that gets contractor jobs directly from session
  app.get("/api/contractor-jobs", async (req: Request, res: Response) => {
    // Get userId from session
    const userId = await getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    console.log(`GET /api/contractor-jobs for session user ${userId}`);
    
    // Get the user to verify they're a contractor
    const user = await dbStorage.getUser(userId);
    if (!user || user.userType !== 'contractor') {
      return res.status(403).json({ message: "Access denied: Contractor account required" });
    }
    
    const contractorId = userId; // Use the current user's ID
    
    try {
      console.log(`Fetching jobs for contractor from session: ${contractorId}`);
      
      // Get all bids for this contractor
      const contractorBids = await dbStorage.getBidsByContractor(contractorId);
      console.log(`Found ${contractorBids.length} bids for contractor ${contractorId}`);
      
      // Split bids by status
      const acceptedBids = contractorBids.filter((bid: {status: string}) => bid.status === "accepted");
      console.log(`Found ${acceptedBids.length} accepted bids for contractor ${contractorId}`);
      
      // Get all open jobs using our fixed method
      const openJobs = await dbStorage.getAvailableJobs();
      console.log(`Found ${openJobs.length} open jobs in the system`);
      
      // Get assigned jobs using our specialized method
      // (both directly assigned and through accepted bids)
      const activeJobs = await dbStorage.getJobsByContractor(contractorId);
      console.log(`Found ${activeJobs.length} active jobs for contractor ${contractorId}`);
      
      // Get all job IDs that this contractor has bid on
      const biddedJobIds = contractorBids.map((bid: {jobId: number}) => bid.jobId);
      
      // AVAILABLE JOBS: Jobs that are OPEN, NOT already bid on by this contractor, 
      // and NOT already active (accepted/assigned)
      // These are jobs the contractor can see and potentially bid on
      const activeJobIds = activeJobs.map(job => job.id);
      
      // Filter from our list of open jobs that we already fetched
      const availableJobsForContractor = openJobs.filter(job => {
        // Don't include jobs the contractor has already bid on
        const hasNotBid = !biddedJobIds.includes(job.id);
        
        // Don't include jobs that are already active for this contractor
        const isNotActive = !activeJobIds.includes(job.id);
        
        return hasNotBid && isNotActive;
      });
      
      // Step 5: Enhance job objects with chat room IDs for jobs that have a contractor assigned
      // This avoids having to make separate API calls to get chat room information
      for (const job of [...availableJobsForContractor, ...activeJobs]) {
        if ((job as any).contractorId) {
          // Try to get an existing chat room for this job
          const chatRoom = await dbStorage.getChatRoomByJob((job as any).id);
          if (chatRoom) {
            // Add chatRoomId to the job object
            (job as any).chatRoomId = chatRoom.id;
          }
        }
      }
      
      // Step 6: Combine both sets with a property to identify the type
      const response = {
        // Jobs the contractor can bid on
        availableJobs: availableJobsForContractor,
        
        // Jobs the contractor is working on
        activeJobs,
        
        // All active bids by this contractor (for reference)
        myBids: contractorBids
      };
      
      // Log the results
      console.log(`Returning ${availableJobsForContractor.length} available jobs and ${activeJobs.length} active jobs for contractor ${contractorId}`);
      
      // Return the structured response
      res.json(response);
    } catch (error) {
      console.error("[API Error] Get Contractor Jobs:", error);
      res.status(500).json({ message: "Failed to fetch contractor jobs" });
    }
  });

  app.get("/api/contractor-jobs/:contractorId", async (req: Request, res: Response) => {
    // Debug log all potential auth sources
    console.log(`GET /api/contractor-jobs/${req.params.contractorId} - Auth sources:`, {
      session: req.session?.userId || 'none',
      xUserIdHeader: req.headers['x-user-id'] || 'none',
      xAuthToken: req.headers['x-auth-token'] ? 'exists' : 'none',
      queryUserId: req.query.user_id || 'none',
      params: req.params.contractorId
    });
    
    // SPECIAL CASE: For this critical endpoint, check all authentication methods independently
    // First, attempt to get userId using normal authentication flow
    const userId = await getUserId(req);
    
    // Get requested contractorId from path parameter
    const contractorId = parseInt(req.params.contractorId);
    if (isNaN(contractorId)) {
      return res.status(400).json({ message: "Invalid contractor ID format" });
    }
    
    // For contractor jobs endpoint, also check direct X-User-ID header for extra reliability
    // This is needed because the sessions might get lost but the client still has the user ID
    const headerUserId = req.headers['x-user-id'] as string;
    
    // Additional contractor-specific header
    const contractorIdHeader = req.headers['x-contractor-id'] as string;
    
    // Log authentication state for debugging
    console.log("Contractor jobs authentication state:", {
      userId,
      contractorId,
      headerUserId,
      contractorIdHeader,
      sessionUserId: req.session?.userId,
      match: userId === contractorId || 
             parseInt(headerUserId) === contractorId || 
             (contractorIdHeader && parseInt(contractorIdHeader) === contractorId)
    });
    
    // AUTHENTICATION APPROACH 1: Regular session-based auth
    const hasSessionAuth = userId === contractorId;
    
    // AUTHENTICATION APPROACH 2: X-User-ID header matches contractor ID
    const hasUserIdHeaderAuth = headerUserId && parseInt(headerUserId) === contractorId;
    
    // AUTHENTICATION APPROACH 3: Explicit X-Contractor-ID header
    const hasContractorHeaderAuth = contractorIdHeader && parseInt(contractorIdHeader) === contractorId;
    
    // AUTHENTICATION APPROACH 4: Query parameter auth
    const queryUserId = req.query.user_id as string;
    const hasQueryAuth = queryUserId && parseInt(queryUserId) === contractorId;
    
    // If any authentication method succeeds, allow access
    if (hasSessionAuth || hasUserIdHeaderAuth || hasContractorHeaderAuth || hasQueryAuth) {
      // Log which auth method worked
      console.log("✅ Contractor jobs authentication success via:", {
        session: hasSessionAuth,
        userIdHeader: hasUserIdHeaderAuth,
        contractorHeader: hasContractorHeaderAuth,
        queryParam: hasQueryAuth
      });
      
      // Update session for future requests if we have valid ID
      if (req.session && contractorId) {
        req.session.userId = contractorId;
        req.session.save();
        console.log("Updated session with contractor ID:", contractorId);
      }
    } else {
      console.log("❌ Authentication failed for contractor jobs: all methods failed");
      return res.status(403).json({ 
        message: "Forbidden - You can only view your own jobs",
        error: "authentication_failed"
      });
    }
    
    try {
      console.log(`Fetching jobs for contractor: ${contractorId}`);
      console.log(`Using X-User-ID header: ${req.headers['x-user-id']}`);
      
      // Step 1: Get ALL jobs
      const allJobs = Array.from((await dbStorage.getAllJobs()) || []);
      console.log(`Found ${allJobs.length} total jobs in database`);
      
      // Step 2: Get all bids for this contractor
      const contractorBids = await dbStorage.getBidsByContractor(contractorId);
      console.log(`Found ${contractorBids.length} bids for contractor ${contractorId}`);
      
      // Step 3: Split bids by status
      const acceptedBids = contractorBids.filter(bid => bid.status === "accepted");
      console.log(`Found ${acceptedBids.length} accepted bids for contractor ${contractorId}`);
      
      // Get job IDs from accepted bids for more efficient lookup
      const acceptedBidJobIds = acceptedBids.map(bid => bid.jobId);
      
      // Step 4: Create two separate lists of jobs
      
      // Get all job IDs that this contractor has bid on
      const biddedJobIds = contractorBids.map(bid => bid.jobId);
      
      // ACTIVE JOBS: Jobs that either:
      // a) Have an accepted bid from this contractor, OR
      // b) Are directly assigned to the contractor
      const activeJobs = allJobs.filter(job => {
        // Is this job directly assigned to the contractor?
        const isAssigned = job.contractorId === contractorId;
        
        // Does this job have an accepted bid from this contractor?
        const hasBidAccepted = acceptedBidJobIds.includes(job.id);
        
        // Include job if either condition is met
        return isAssigned || hasBidAccepted;
      });
      
      // AVAILABLE JOBS: Jobs that are OPEN, NOT already bid on by this contractor, 
      // and NOT already active (accepted/assigned)
      // These are jobs the contractor can see and potentially bid on
      const activeJobIds = activeJobs.map(job => job.id);
      const availableJobs = allJobs.filter(job => {
        // Make sure we're only returning jobs that are explicitly in "open" status
        // and not ones with other statuses like "draft", "in_progress", etc.
        const isOpenStatus = job.status === "open";
        
        // Don't include jobs the contractor has already bid on
        const hasNotBid = !biddedJobIds.includes(job.id);
        
        // Don't include jobs that are already active for this contractor
        const isNotActive = !activeJobIds.includes(job.id);
        
        // Debug log for troubleshooting
        if (isOpenStatus && !hasNotBid) {
          console.log(`Job ${job.id} is open but contractor already bid on it`);
        }
        
        return isOpenStatus && hasNotBid && isNotActive;
      });
      
      // Step 5: Enhance job objects with chat room IDs for jobs that have a contractor assigned
      // This avoids having to make separate API calls to get chat room information
      for (const job of [...availableJobs, ...activeJobs]) {
        if (job.contractorId) {
          // Try to get an existing chat room for this job
          const chatRoom = await dbStorage.getChatRoomByJob(job.id);
          if (chatRoom) {
            // Add chatRoomId to the job object
            (job as any).chatRoomId = chatRoom.id;
          }
        }
      }
      
      // Step 6: Combine both sets with a property to identify the type
      const response = {
        // Jobs the contractor can bid on
        availableJobs,
        
        // Jobs the contractor is working on
        activeJobs,
        
        // All active bids by this contractor (for reference)
        myBids: contractorBids
      };
      
      // Log the results
      console.log(`Returning ${availableJobs.length} available jobs and ${activeJobs.length} active jobs for contractor ${contractorId}`);
      
      // Return the structured response
      res.json(response);
    } catch (error) {
      console.error("[API Error] Get Contractor Jobs:", error);
      res.status(500).json({ message: "Failed to fetch contractor jobs" });
    }
  });

  // Quote Management API Endpoints
  // Get all quotes (with optional filtering by contractor or landlord)
  app.get("/api/quotes", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { contractorId, landlordId, jobId, status } = req.query;
      
      let quotes;
      // Apply filters based on query parameters
      if (contractorId) {
        quotes = await dbStorage.getQuotesByContractor(Number(contractorId));
      } else if (landlordId) {
        quotes = await dbStorage.getQuotesByLandlord(Number(landlordId));
      } else if (jobId) {
        quotes = await dbStorage.getQuotesByJob(Number(jobId));
      } else {
        // For security, only allow users to see quotes related to them
        const user = await dbStorage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        if (user.userType === "contractor") {
          quotes = await dbStorage.getQuotesByContractor(userId);
        } else if (user.userType === "landlord") {
          quotes = await dbStorage.getQuotesByLandlord(userId);
        } else {
          return res.status(403).json({ message: "Unauthorized access" });
        }
      }

      // Further filter by status if provided
      if (status && quotes) {
        quotes = quotes.filter(quote => quote.status === status);
      }

      return res.status(200).json(quotes);
    } catch (error) {
      console.error("[API Error] Get Quotes:", error);
      return res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  // Get a specific quote by ID
  app.get("/api/quotes/:id", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const quoteId = parseInt(req.params.id);
      const quote = await dbStorage.getQuote(quoteId);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Security check: Only allow access if user is related to the quote
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.userType === "contractor" && quote.contractorId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      if (user.userType === "landlord" && quote.landlordId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Get line items for the quote
      const lineItems = await dbStorage.getQuoteLineItemsByQuote(quoteId);

      // Combine quote with line items for response
      return res.status(200).json({
        ...quote,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Get Quote:", error);
      return res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  // Create a new quote
  app.post("/api/quotes", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Verify the user is a contractor
      const user = await dbStorage.getUser(userId);
      if (!user || user.userType !== "contractor") {
        return res.status(403).json({ message: "Only contractors can create quotes" });
      }

      // Validate quote data
      const quoteData = quoteApiSchema.parse(req.body);
      
      // Ensure the contractor ID matches the authenticated user
      if (quoteData.contractorId !== userId) {
        return res.status(403).json({ message: "Cannot create quotes for other contractors" });
      }

      // Create the quote
      const newQuote = await dbStorage.createQuote({
        ...quoteData,
        status: "draft", // Always start as draft
        createdAt: new Date(),
        updatedAt: new Date(),
        sentAt: null,
        viewedAt: null,
        acceptedAt: null,
        rejectedAt: null,
        rejectionReason: null
      });

      // If line items were included, add them
      if (req.body.lineItems && Array.isArray(req.body.lineItems)) {
        const lineItems = req.body.lineItems;
        for (const item of lineItems) {
          // For draft quotes, use direct values without strict validation
          await dbStorage.createQuoteLineItem({
            description: item.description || "",
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
            total: item.total || 0,
            sortOrder: item.sortOrder || 0,
            quoteId: newQuote.id
          });
        }
      }

      // Get the complete quote with line items
      const completeQuote = await dbStorage.getQuote(newQuote.id);
      const lineItems = await dbStorage.getQuoteLineItemsByQuote(newQuote.id);

      return res.status(201).json({
        ...completeQuote,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Create Quote:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      return res.status(500).json({ message: "Failed to create quote" });
    }
  });

  // Update a quote
  app.patch("/api/quotes/:id", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const quoteId = parseInt(req.params.id);
      const quote = await dbStorage.getQuote(quoteId);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Security check: Only allow the contractor who created the quote to update it
      if (quote.contractorId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Validate update data - partial validation for patch
      const updateData = req.body;

      // Prevent changing critical fields like contractorId, landlordId, and jobId
      if (updateData.contractorId && updateData.contractorId !== quote.contractorId) {
        return res.status(400).json({ message: "Cannot change quote contractor" });
      }

      if (updateData.landlordId && updateData.landlordId !== quote.landlordId) {
        return res.status(400).json({ message: "Cannot change quote landlord" });
      }

      if (updateData.jobId && updateData.jobId !== quote.jobId) {
        return res.status(400).json({ message: "Cannot change associated job" });
      }

      // Update the quote
      const updatedQuote = await dbStorage.updateQuote(quoteId, {
        ...updateData,
        updatedAt: new Date()
      });

      if (!updatedQuote) {
        return res.status(500).json({ message: "Failed to update quote" });
      }

      // If line items were included, handle them
      if (req.body.lineItems && Array.isArray(req.body.lineItems)) {
        // First, get existing line items
        const existingLineItems = await dbStorage.getQuoteLineItemsByQuote(quoteId);
        const existingItemIds = existingLineItems.map(item => item.id);
        
        // Process each line item
        for (const item of req.body.lineItems) {
          if (item.id) {
            // Update existing item
            if (existingItemIds.includes(item.id)) {
              const { id, ...updateData } = item;
              await dbStorage.updateQuoteLineItem(id, updateData);
            }
          } else {
            // Create new item (use direct values for draft quotes)
            await dbStorage.createQuoteLineItem({
              description: item.description || "",
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              total: item.total || 0,
              sortOrder: item.sortOrder || 0,
              quoteId
            });
          }
        }
        
        // Remove deleted items if an explicit list of IDs to keep was provided
        if (req.body.keepLineItemIds && Array.isArray(req.body.keepLineItemIds)) {
          for (const existingItem of existingLineItems) {
            if (!req.body.keepLineItemIds.includes(existingItem.id)) {
              await dbStorage.deleteQuoteLineItem(existingItem.id);
            }
          }
        }
      }

      // Get updated quote with line items
      const completeQuote = await dbStorage.getQuote(quoteId);
      const lineItems = await dbStorage.getQuoteLineItemsByQuote(quoteId);

      return res.status(200).json({
        ...completeQuote,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Update Quote:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      return res.status(500).json({ message: "Failed to update quote" });
    }
  });

  // Send a quote (change status from draft to sent)
  app.post("/api/quotes/:id/send", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const quoteId = parseInt(req.params.id);
      const quote = await dbStorage.getQuote(quoteId);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Security check: Only the contractor can send quotes
      if (quote.contractorId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Verify quote is in draft status
      if (quote.status !== "draft" && quote.status !== "revised") {
        return res.status(400).json({ message: `Cannot send quote with status: ${quote.status}` });
      }

      // Update quote status to sent
      const updatedQuote = await dbStorage.updateQuote(quoteId, {
        status: "sent",
        sentAt: new Date(),
        updatedAt: new Date()
      });

      if (!updatedQuote) {
        return res.status(500).json({ message: "Failed to send quote" });
      }

      // Get line items for the complete response
      const lineItems = await dbStorage.getQuoteLineItemsByQuote(quoteId);

      return res.status(200).json({
        ...updatedQuote,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Send Quote:", error);
      return res.status(500).json({ message: "Failed to send quote" });
    }
  });

  // Mark a quote as viewed
  app.post("/api/quotes/:id/view", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const quoteId = parseInt(req.params.id);
      const quote = await dbStorage.getQuote(quoteId);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Security check: Only the landlord can mark as viewed
      if (quote.landlordId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Update quote as viewed
      const updatedQuote = await dbStorage.markQuoteAsViewed(quoteId);

      if (!updatedQuote) {
        return res.status(500).json({ message: "Failed to mark quote as viewed" });
      }

      // Get line items for the complete response
      const lineItems = await dbStorage.getQuoteLineItemsByQuote(quoteId);

      return res.status(200).json({
        ...updatedQuote,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] View Quote:", error);
      return res.status(500).json({ message: "Failed to mark quote as viewed" });
    }
  });

  // Accept a quote
  app.post("/api/quotes/:id/accept", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const quoteId = parseInt(req.params.id);
      const quote = await dbStorage.getQuote(quoteId);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Security check: Only the landlord can accept quotes
      if (quote.landlordId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Verify quote is in a status that can be accepted
      if (quote.status !== "sent" && quote.status !== "viewed" && quote.status !== "revised") {
        return res.status(400).json({ message: `Cannot accept quote with status: ${quote.status}` });
      }

      // Update quote status to accepted
      const updatedQuote = await dbStorage.markQuoteAsAccepted(quoteId);

      if (!updatedQuote) {
        return res.status(500).json({ message: "Failed to accept quote" });
      }

      // Get line items for the complete response
      const lineItems = await dbStorage.getQuoteLineItemsByQuote(quoteId);

      return res.status(200).json({
        ...updatedQuote,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Accept Quote:", error);
      return res.status(500).json({ message: "Failed to accept quote" });
    }
  });

  // Reject a quote
  app.post("/api/quotes/:id/reject", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const quoteId = parseInt(req.params.id);
      const quote = await dbStorage.getQuote(quoteId);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Security check: Only the landlord can reject quotes
      if (quote.landlordId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Verify quote is in a status that can be rejected
      if (quote.status !== "sent" && quote.status !== "viewed" && quote.status !== "revised") {
        return res.status(400).json({ message: `Cannot reject quote with status: ${quote.status}` });
      }

      // Get rejection reason from request body
      const { reason } = req.body;

      // Update quote status to rejected
      const updatedQuote = await dbStorage.markQuoteAsRejected(quoteId, reason);

      if (!updatedQuote) {
        return res.status(500).json({ message: "Failed to reject quote" });
      }

      // Get line items for the complete response
      const lineItems = await dbStorage.getQuoteLineItemsByQuote(quoteId);

      return res.status(200).json({
        ...updatedQuote,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Reject Quote:", error);
      return res.status(500).json({ message: "Failed to reject quote" });
    }
  });

  // Convert quote to invoice
  app.post("/api/quotes/:id/convert-to-invoice", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const quoteId = parseInt(req.params.id);
      const quote = await dbStorage.getQuote(quoteId);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Security check: Only the contractor can convert quotes to invoices
      if (quote.contractorId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Verify quote is accepted
      if (quote.status !== "accepted") {
        return res.status(400).json({ message: "Only accepted quotes can be converted to invoices" });
      }

      // Get quote line items
      const quoteLineItems = await dbStorage.getQuoteLineItemsByQuote(quoteId);

      // Generate invoice number (format: INV-YYYY-MM-XXXXX)
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const random = Math.floor(10000 + Math.random() * 90000); // 5-digit number
      const invoiceNumber = `INV-${year}-${month}-${random}`;

      // Create invoice based on quote
      const newInvoice = await dbStorage.createInvoice({
        title: `Invoice for ${quote.title}`,
        landlordId: quote.landlordId,
        contractorId: quote.contractorId,
        jobId: quote.jobId,
        subtotal: quote.subtotal,
        total: quote.total,
        discount: quote.discount || 0,
        tax: quote.tax || 0,
        notes: quote.notes || "",
        termsAndConditions: quote.termsAndConditions || "",
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        paymentTerms: req.body.paymentTerms || "Due on receipt",
        invoiceNumber,
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
        sentAt: null,
        viewedAt: null,
        paidAt: null,
        paymentMethod: null,
        paymentDetails: null
      });

      // Convert quote line items to invoice line items
      for (const item of quoteLineItems) {
        await dbStorage.createInvoiceLineItem({
          invoiceId: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount
        });
      }

      // Get the complete invoice with line items
      const completeInvoice = await dbStorage.getInvoice(newInvoice.id);
      const invoiceLineItems = await dbStorage.getInvoiceLineItemsByInvoice(newInvoice.id);

      return res.status(201).json({
        ...completeInvoice,
        lineItems: invoiceLineItems
      });
    } catch (error) {
      console.error("[API Error] Convert Quote to Invoice:", error);
      return res.status(500).json({ message: "Failed to convert quote to invoice" });
    }
  });

  // Invoice Management API Endpoints
  // Get all invoices (with optional filtering)
  app.get("/api/invoices", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { contractorId, landlordId, jobId, status } = req.query;
      
      let invoices;
      // Apply filters based on query parameters
      if (contractorId) {
        invoices = await dbStorage.getInvoicesByContractor(Number(contractorId));
      } else if (landlordId) {
        invoices = await dbStorage.getInvoicesByLandlord(Number(landlordId));
      } else if (jobId) {
        invoices = await dbStorage.getInvoicesByJob(Number(jobId));
      } else {
        // For security, only allow users to see invoices related to them
        const user = await dbStorage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        if (user.userType === "contractor") {
          invoices = await dbStorage.getInvoicesByContractor(userId);
        } else if (user.userType === "landlord") {
          invoices = await dbStorage.getInvoicesByLandlord(userId);
        } else {
          return res.status(403).json({ message: "Unauthorized access" });
        }
      }

      // Further filter by status if provided
      if (status && invoices) {
        invoices = invoices.filter(invoice => invoice.status === status);
      }

      return res.status(200).json(invoices);
    } catch (error) {
      console.error("[API Error] Get Invoices:", error);
      return res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Get a specific invoice by ID
  app.get("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const invoiceId = parseInt(req.params.id);
      const invoice = await dbStorage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Security check: Only allow access if user is related to the invoice
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.userType === "contractor" && invoice.contractorId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      if (user.userType === "landlord" && invoice.landlordId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Get line items for the invoice
      const lineItems = await dbStorage.getInvoiceLineItemsByInvoice(invoiceId);

      // Combine invoice with line items for response
      return res.status(200).json({
        ...invoice,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Get Invoice:", error);
      return res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Create a new invoice
  app.post("/api/invoices", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Verify the user is a contractor
      const user = await dbStorage.getUser(userId);
      if (!user || user.userType !== "contractor") {
        return res.status(403).json({ message: "Only contractors can create invoices" });
      }

      // Validate invoice data
      const invoiceData = invoiceSchema.parse(req.body);
      
      // Ensure the contractor ID matches the authenticated user
      if (invoiceData.contractorId !== userId) {
        return res.status(403).json({ message: "Cannot create invoices for other contractors" });
      }

      // Generate invoice number if not provided
      let invoiceNumber = invoiceData.invoiceNumber;
      if (!invoiceNumber) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(10000 + Math.random() * 90000); // 5-digit number
        invoiceNumber = `INV-${year}-${month}-${random}`;
      }

      // Create the invoice
      const newInvoice = await dbStorage.createInvoice({
        ...invoiceData,
        invoiceNumber,
        status: invoiceData.status || "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
        sentAt: null,
        viewedAt: null,
        paidAt: null,
        paymentMethod: null,
        paymentDetails: null
      });

      // If line items were included, add them
      if (req.body.lineItems && Array.isArray(req.body.lineItems)) {
        const lineItems = req.body.lineItems;
        for (const item of lineItems) {
          const lineItemData = invoiceLineItemSchema.parse(item);
          await dbStorage.createInvoiceLineItem({
            ...lineItemData,
            invoiceId: newInvoice.id
          });
        }
      }

      // Get the complete invoice with line items
      const completeInvoice = await dbStorage.getInvoice(newInvoice.id);
      const lineItems = await dbStorage.getInvoiceLineItemsByInvoice(newInvoice.id);

      return res.status(201).json({
        ...completeInvoice,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Create Invoice:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      return res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Update an invoice
  app.patch("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const invoiceId = parseInt(req.params.id);
      const invoice = await dbStorage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Security check: Only allow the contractor who created the invoice to update it
      if (invoice.contractorId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Validate update data - partial validation for patch
      const updateData = req.body;

      // Prevent changing critical fields like contractorId, landlordId, and jobId
      if (updateData.contractorId && updateData.contractorId !== invoice.contractorId) {
        return res.status(400).json({ message: "Cannot change invoice contractor" });
      }

      if (updateData.landlordId && updateData.landlordId !== invoice.landlordId) {
        return res.status(400).json({ message: "Cannot change invoice landlord" });
      }

      if (updateData.jobId && updateData.jobId !== invoice.jobId) {
        return res.status(400).json({ message: "Cannot change associated job" });
      }

      // Update the invoice
      const updatedInvoice = await dbStorage.updateInvoice(invoiceId, {
        ...updateData,
        updatedAt: new Date()
      });

      if (!updatedInvoice) {
        return res.status(500).json({ message: "Failed to update invoice" });
      }

      // If line items were included, handle them
      if (req.body.lineItems && Array.isArray(req.body.lineItems)) {
        // First, get existing line items
        const existingLineItems = await dbStorage.getInvoiceLineItemsByInvoice(invoiceId);
        const existingItemIds = existingLineItems.map(item => item.id);
        
        // Process each line item
        for (const item of req.body.lineItems) {
          if (item.id) {
            // Update existing item
            if (existingItemIds.includes(item.id)) {
              const { id, ...updateData } = item;
              await dbStorage.updateInvoiceLineItem(id, updateData);
            }
          } else {
            // Create new item
            const lineItemData = invoiceLineItemSchema.parse(item);
            await dbStorage.createInvoiceLineItem({
              ...lineItemData,
              invoiceId
            });
          }
        }
        
        // Remove deleted items if an explicit list of IDs to keep was provided
        if (req.body.keepLineItemIds && Array.isArray(req.body.keepLineItemIds)) {
          for (const existingItem of existingLineItems) {
            if (!req.body.keepLineItemIds.includes(existingItem.id)) {
              await dbStorage.deleteInvoiceLineItem(existingItem.id);
            }
          }
        }
      }

      // Get updated invoice with line items
      const completeInvoice = await dbStorage.getInvoice(invoiceId);
      const lineItems = await dbStorage.getInvoiceLineItemsByInvoice(invoiceId);

      return res.status(200).json({
        ...completeInvoice,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Update Invoice:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      return res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Send an invoice (change status from draft to sent)
  app.post("/api/invoices/:id/send", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const invoiceId = parseInt(req.params.id);
      const invoice = await dbStorage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Security check: Only the contractor can send invoices
      if (invoice.contractorId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Verify invoice is in draft status
      if (invoice.status !== "draft") {
        return res.status(400).json({ message: `Cannot send invoice with status: ${invoice.status}` });
      }

      // Update invoice status to sent
      const updatedInvoice = await dbStorage.updateInvoice(invoiceId, {
        status: "sent",
        sentAt: new Date(),
        updatedAt: new Date()
      });

      if (!updatedInvoice) {
        return res.status(500).json({ message: "Failed to send invoice" });
      }

      // Get line items for the complete response
      const lineItems = await dbStorage.getInvoiceLineItemsByInvoice(invoiceId);

      return res.status(200).json({
        ...updatedInvoice,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Send Invoice:", error);
      return res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  // Mark an invoice as viewed
  app.post("/api/invoices/:id/view", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const invoiceId = parseInt(req.params.id);
      const invoice = await dbStorage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Security check: Only the landlord can mark as viewed
      if (invoice.landlordId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Update invoice as viewed
      const updatedInvoice = await dbStorage.markInvoiceAsViewed(invoiceId);

      if (!updatedInvoice) {
        return res.status(500).json({ message: "Failed to mark invoice as viewed" });
      }

      // Get line items for the complete response
      const lineItems = await dbStorage.getInvoiceLineItemsByInvoice(invoiceId);

      return res.status(200).json({
        ...updatedInvoice,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] View Invoice:", error);
      return res.status(500).json({ message: "Failed to mark invoice as viewed" });
    }
  });

  // Mark an invoice as paid
  app.post("/api/invoices/:id/pay", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const invoiceId = parseInt(req.params.id);
      const invoice = await dbStorage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Security check: Landlords mark invoices as paid, or contractors can record payments
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isLandlord = user.userType === "landlord" && invoice.landlordId === userId;
      const isContractor = user.userType === "contractor" && invoice.contractorId === userId;

      if (!isLandlord && !isContractor) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Verify invoice is in sent or viewed status
      if (invoice.status !== "sent" && invoice.status !== "viewed" && invoice.status !== "overdue") {
        return res.status(400).json({ message: `Cannot mark invoice with status ${invoice.status} as paid` });
      }

      // Get payment method and details from request body
      const { paymentMethod, paymentDetails } = req.body;

      if (!paymentMethod) {
        return res.status(400).json({ message: "Payment method is required" });
      }

      // Mark invoice as paid
      const updatedInvoice = await dbStorage.markInvoiceAsPaid(invoiceId, paymentMethod, paymentDetails);

      if (!updatedInvoice) {
        return res.status(500).json({ message: "Failed to mark invoice as paid" });
      }

      // Create a transaction record for this payment if needed
      // This is a simplified example - in a real application, you might want to
      // integrate with an actual payment processor
      await dbStorage.createTransaction({
        userId: invoice.landlordId,
        amount: invoice.total,
        type: "payment",
        status: "completed",
        reference: `Invoice-${invoice.invoiceNumber}`,
        notes: `Payment for invoice #${invoice.invoiceNumber}`,
        jobId: invoice.jobId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Get line items for the complete response
      const lineItems = await dbStorage.getInvoiceLineItemsByInvoice(invoiceId);

      return res.status(200).json({
        ...updatedInvoice,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Pay Invoice:", error);
      return res.status(500).json({ message: "Failed to mark invoice as paid" });
    }
  });

  // Mark an invoice as overdue
  app.post("/api/invoices/:id/mark-overdue", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const invoiceId = parseInt(req.params.id);
      const invoice = await dbStorage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Security check: Only the contractor can mark as overdue
      if (invoice.contractorId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Verify invoice is in sent or viewed status
      if (invoice.status !== "sent" && invoice.status !== "viewed") {
        return res.status(400).json({ message: `Cannot mark invoice with status ${invoice.status} as overdue` });
      }

      // Mark invoice as overdue
      const updatedInvoice = await dbStorage.markInvoiceAsOverdue(invoiceId);

      if (!updatedInvoice) {
        return res.status(500).json({ message: "Failed to mark invoice as overdue" });
      }

      // Get line items for the complete response
      const lineItems = await dbStorage.getInvoiceLineItemsByInvoice(invoiceId);

      return res.status(200).json({
        ...updatedInvoice,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Mark Invoice as Overdue:", error);
      return res.status(500).json({ message: "Failed to mark invoice as overdue" });
    }
  });

  // Cancel an invoice
  app.post("/api/invoices/:id/cancel", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const invoiceId = parseInt(req.params.id);
      const invoice = await dbStorage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Security check: Only the contractor can cancel invoices
      if (invoice.contractorId !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Verify invoice is not already paid
      if (invoice.status === "paid") {
        return res.status(400).json({ message: "Cannot cancel a paid invoice" });
      }

      // Get cancellation reason from request body
      const { reason } = req.body;

      // Cancel the invoice
      const updatedInvoice = await dbStorage.markInvoiceAsCancelled(invoiceId, reason);

      if (!updatedInvoice) {
        return res.status(500).json({ message: "Failed to cancel invoice" });
      }

      // Get line items for the complete response
      const lineItems = await dbStorage.getInvoiceLineItemsByInvoice(invoiceId);

      return res.status(200).json({
        ...updatedInvoice,
        lineItems
      });
    } catch (error) {
      console.error("[API Error] Cancel Invoice:", error);
      return res.status(500).json({ message: "Failed to cancel invoice" });
    }
  });

  // Register the calendar and templates route modules
  app.use('/api/calendar', calendarRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/contractor-profile', contractorProfileRouter);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Notification system routes
  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get the user to determine their role
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const notifications = [];
      
      // Get new jobs matching the contractor's skills (for contractors)
      if (user.userType === "contractor") {
        // Get contractor profile to check skills/categories
        const profile = await dbStorage.getContractorProfile(userId);
        
        if (profile && profile.categories) {
          // Find jobs matching contractor categories that were posted in the last 2 weeks
          const twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
          
          const allJobs = await dbStorage.getJobs();
          const matchingJobs = allJobs.filter(job => 
            job.status === "open" && 
            new Date(job.createdAt) > twoWeeksAgo &&
            job.categoryTags && 
            Array.isArray(job.categoryTags) &&
            profile.categories && 
            Array.isArray(profile.categories) &&
            job.categoryTags.some(tag => 
              profile.categories.some(cat => 
                cat.toLowerCase() === tag.toLowerCase()
              )
            )
          );
          
          // Create notifications for matching jobs
          matchingJobs.forEach(job => {
            notifications.push({
              id: `job-match-${job.id}`,
              type: "jobMatch",
              title: `Job Match: ${job.title}`,
              message: `A job matching your skills in ${job.categoryTags?.join(', ')} was posted.`,
              jobId: job.id,
              date: job.createdAt,
              read: false
            });
          });
        }
        
        // Get bid status notifications
        const bids = await dbStorage.getBidsByContractor(userId);
        
        bids.forEach(bid => {
          if (bid.status === "accepted") {
            notifications.push({
              id: `bid-accepted-${bid.id}`,
              type: "bidAccepted",
              title: "Bid Accepted",
              message: `Your bid for job #${bid.jobId} has been accepted!`,
              jobId: bid.jobId,
              bidId: bid.id,
              date: bid.updatedAt,
              read: false
            });
          } else if (bid.status === "rejected") {
            notifications.push({
              id: `bid-rejected-${bid.id}`,
              type: "bidRejected",
              title: "Bid Rejected",
              message: `Your bid for job #${bid.jobId} was not accepted.`,
              jobId: bid.jobId,
              bidId: bid.id,
              date: bid.updatedAt,
              read: false
            });
          }
        });
      }
      
      // For landlords, notify about new bids on their jobs
      if (user.userType === "landlord") {
        const landlordJobs = await dbStorage.getJobsByLandlord(userId);
        
        // Get all bids for all landlord jobs
        for (const job of landlordJobs) {
          const jobBids = await dbStorage.getBidsForJob(job.id);
          
          // Only notify about recent bids (last 2 weeks)
          const twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
          
          const recentBids = jobBids.filter(bid => 
            new Date(bid.createdAt) > twoWeeksAgo
          );
          
          recentBids.forEach(bid => {
            notifications.push({
              id: `new-bid-${bid.id}`,
              type: "bidUpdate",
              title: `New Bid on ${job.title}`,
              message: `A contractor has placed a bid of $${bid.amount} on your job.`,
              jobId: job.id,
              bidId: bid.id,
              date: bid.createdAt,
              read: false
            });
          });
        }
      }
      
      // Get unread message notifications for both landlords and contractors
      const chatRooms = await dbStorage.getChatRoomsByUser(userId);
      
      for (const chatRoom of chatRooms) {
        const participant = await db
          .select()
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.userId, userId),
              eq(chatParticipants.chatRoomId, chatRoom.id)
            )
          )
          .then(results => results[0]);
        
        if (participant) {
          const lastRead = participant.lastRead || new Date(0);
          
          const unreadMessages = await db
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.chatRoomId, chatRoom.id),
                gt(messages.createdAt, lastRead),
                ne(messages.senderId, userId) // Don't count user's own messages
              )
            );
          
          if (unreadMessages.length > 0) {
            const job = chatRoom.jobId ? await dbStorage.getJob(chatRoom.jobId) : null;
            
            notifications.push({
              id: `unread-messages-${chatRoom.id}`,
              type: "newMessage",
              title: `New Messages (${unreadMessages.length})`,
              message: job 
                ? `You have ${unreadMessages.length} unread message(s) for job "${job.title}"`
                : `You have ${unreadMessages.length} unread message(s)`,
              jobId: chatRoom.jobId || undefined,
              date: unreadMessages[0].createdAt, // Date of most recent message
              read: false
            });
          }
        }
      }
      
      // Sort notifications by date (newest first)
      notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return res.status(200).json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json({ 
        message: "An error occurred while fetching notifications" 
      });
    }
  });

  // Mark notifications as read
  app.post("/api/notifications/read", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { notificationIds } = req.body;
      
      if (!notificationIds || !Array.isArray(notificationIds)) {
        return res.status(400).json({ message: "Invalid notification IDs" });
      }
      
      // In a full implementation, we would update a notifications table in the database
      // For now, we just acknowledge the request
      
      return res.status(200).json({ 
        message: "Notifications marked as read",
        updatedIds: notificationIds
      });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      return res.status(500).json({ 
        message: "An error occurred while marking notifications as read" 
      });
    }
  });

  // Clear notifications
  app.delete("/api/notifications", async (req: Request, res: Response) => {
    try {
      const userId = await getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // In a full implementation, we would delete from a notifications table
      // For now, we just acknowledge the request
      
      return res.status(200).json({ 
        message: "All notifications cleared"
      });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      return res.status(500).json({ 
        message: "An error occurred while clearing notifications" 
      });
    }
  });

  // Set up WebSocket server for real-time chat using direct HTTP server attachment
  // In the Replit environment, we need to use the root path to ensure compatibility
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/api/chat-ws', // Use a specific path to avoid conflict with Vite's WebSocket
    clientTracking: true
  });
  
  // This path approach avoids conflict with Vite's WebSocket for HMR
  console.log('WebSocket server attached to HTTP server on path: /api/chat-ws');
  
  // Maps to track connections and chat rooms
  const clients = new Map(); // clientId -> WebSocket
  const userSockets = new Map(); // userId -> Set of clientIds
  const chatRooms = new Map(); // roomId -> Set of clientIds
  
  // Track connection heartbeats
  const connectionHeartbeats = new Map(); // clientId -> timeout
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  
  // WebSocket connection event
  wss.on('connection', (ws) => {
    // Generate a unique client ID
    const clientId = Date.now() + Math.floor(Math.random() * 1000);
    
    // Store this connection
    clients.set(clientId, ws);
    
    // Setup heartbeat check
    function heartbeatCheck() {
      if (ws.readyState === WebSocket.OPEN) {
        // Send ping to client
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
          
          // Schedule next heartbeat
          connectionHeartbeats.set(clientId, setTimeout(heartbeatCheck, HEARTBEAT_INTERVAL));
        } catch (err) {
          console.error(`Error sending heartbeat to client ${clientId}:`, err);
          // Force close if error
          ws.terminate();
        }
      }
    }
    
    // Start heartbeat check
    connectionHeartbeats.set(clientId, setTimeout(heartbeatCheck, HEARTBEAT_INTERVAL));
    
    // Send a welcome message
    ws.send(JSON.stringify({ 
      type: 'connected', 
      message: 'Connected to chat server',
      clientId: clientId.toString()
    }));
    console.log(`Client ${clientId} connected to WebSocket server`);
    
    // Handle messages from clients
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`Received message from client ${clientId}:`, data.type);
        
        switch (data.type) {
          case 'join':
            // User joining a specific chat room
            if (data.chatRoomId) {
              const roomId = data.chatRoomId;
              const userId = data.senderId;
              
              // Add user to room tracking
              if (!chatRooms.has(roomId)) {
                chatRooms.set(roomId, new Set());
              }
              chatRooms.get(roomId).add(clientId);
              
              // Associate user ID with this socket
              if (userId) {
                if (!userSockets.has(userId)) {
                  userSockets.set(userId, new Set());
                }
                userSockets.get(userId).add(clientId);
              }
              
              console.log(`Client ${clientId} joined room ${roomId}`);
              ws.send(JSON.stringify({ 
                type: 'joined', 
                chatRoomId: roomId,
                message: 'Successfully joined chat room'
              }));
            }
            break;
            
          case 'message':
            // User sending a chat message
            if (data.chatRoomId) {
              try {
                // Check if the chat room exists
                let chatRoomId = data.chatRoomId;
                let chatRoom = await dbStorage.getChatRoom(chatRoomId);
                
                // If not found, check if this is a job ID
                if (!chatRoom) {
                  const job = await dbStorage.getJob(chatRoomId);
                  if (job) {
                    // This is a job ID, let's get or create the chat room for this job
                    chatRoom = await dbStorage.getChatRoomByJob(job.id);
                    
                    // If still not found, create a new chat room regardless of contractor status
                    if (!chatRoom) {
                      chatRoom = await dbStorage.createChatRoom(job.id);
                      
                      // Always add the landlord to the chat
                      await dbStorage.addParticipantToChat(chatRoom.id, job.landlordId);
                      
                      // If the job has an assigned contractor, add them
                      if (job.contractorId) {
                        await dbStorage.addParticipantToChat(chatRoom.id, job.contractorId);
                      }
                      
                      // Add the sender as participant if needed
                      if (data.senderId != job.landlordId && 
                          (!job.contractorId || data.senderId != job.contractorId)) {
                        await dbStorage.addParticipantToChat(chatRoom.id, data.senderId);
                      }
                      
                      console.log(`Created new chat room ${chatRoom.id} for job ${job.id} via WebSocket`);
                    }
                  }
                }
                
                if (!chatRoom) {
                  console.error(`Cannot send message: Chat room ${chatRoomId} not found`);
                  ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Chat room not found or cannot be created'
                  }));
                  return;
                }
                
                // Store message in database with correct chatRoomId
                const messageData = {
                  chatRoomId: chatRoom.id,  // Use the actual chat room ID
                  senderId: data.senderId,
                  content: data.content,
                  type: data.messageType || 'text'
                };
                
                // Create the message in storage
                const newMessage = await dbStorage.createMessage(messageData);
                
                // Format message for broadcasting
                const messageToSend = {
                  type: 'message',
                  chatRoomId: chatRoom.id,  // Use the actual chat room ID
                  content: data.content,
                  senderId: data.senderId,
                  senderName: data.senderName,
                  messageType: data.messageType || 'text',
                  timestamp: data.timestamp || new Date().toISOString(),
                  id: newMessage.id
                };
                
                // Broadcast to all clients in this room
                if (chatRooms.has(chatRoom.id)) {
                  const roomClients = chatRooms.get(chatRoom.id);
                  if (roomClients) {
                    roomClients.forEach((rcId: number) => {
                      const client = clients.get(rcId);
                      if (client && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(messageToSend));
                      }
                    });
                  }
                } else {
                  // Room exists in database but not in WebSocket tracking yet
                  // This can happen if the chat room was just created
                  // Let's just send back to the sender for now
                  ws.send(JSON.stringify(messageToSend));
                }
              } catch (error) {
                console.error('Error processing chat message:', error);
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Error processing your message'
                }));
                return;
              }
//  This is now handled directly in the try block where we have access to chatRoom and messageToSend
            }
            break;
            
          case 'pong':
            // Client responded to our ping, reset the heartbeat timer
            if (connectionHeartbeats.has(clientId)) {
              clearTimeout(connectionHeartbeats.get(clientId));
              // Schedule next heartbeat
              connectionHeartbeats.set(clientId, setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  try {
                    ws.send(JSON.stringify({ type: 'ping' }));
                    // Schedule next heartbeat check
                    connectionHeartbeats.set(clientId, setTimeout(function heartbeatCheck() {
                      if (ws.readyState === WebSocket.OPEN) {
                        try {
                          ws.send(JSON.stringify({ type: 'ping' }));
                          connectionHeartbeats.set(clientId, setTimeout(heartbeatCheck, HEARTBEAT_INTERVAL));
                        } catch (err) {
                          console.error(`Error sending heartbeat to client ${clientId}:`, err);
                          ws.terminate();
                        }
                      }
                    }, HEARTBEAT_INTERVAL));
                  } catch (err) {
                    console.error(`Error sending heartbeat to client ${clientId}:`, err);
                    ws.terminate();
                  }
                }
              }, HEARTBEAT_INTERVAL));
            }
            break;
            
          case 'leave':
            // User leaving a specific chat room
            if (data.chatRoomId && chatRooms.has(data.chatRoomId)) {
              chatRooms.get(data.chatRoomId).delete(clientId);
              console.log(`Client ${clientId} left room ${data.chatRoomId}`);
            }
            break;
            
          default:
            console.log(`Unknown message type: ${data.type}`);
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log(`Client ${clientId} disconnected`);
      
      // Remove from all chat rooms
      Array.from(chatRooms.entries()).forEach(([roomId, roomClients]) => {
        if (roomClients.has(clientId)) {
          roomClients.delete(clientId);
          
          // Clean up empty rooms
          if (roomClients.size === 0) {
            chatRooms.delete(roomId);
          }
        }
      });
      
      // Remove from user socket tracking
      Array.from(userSockets.entries()).forEach(([userId, socketIds]) => {
        if (socketIds.has(clientId)) {
          socketIds.delete(clientId);
          
          // Clean up if no more sockets for this user
          if (socketIds.size === 0) {
            userSockets.delete(userId);
          }
        }
      });
      
      // Clear any heartbeat timeouts
      if (connectionHeartbeats.has(clientId)) {
        clearTimeout(connectionHeartbeats.get(clientId));
        connectionHeartbeats.delete(clientId);
      }
      
      // Remove from clients map
      clients.delete(clientId);
    });
  });

  return httpServer;
}
