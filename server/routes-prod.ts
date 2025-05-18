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

// PRODUCTION VERSION - NO VITE DEPENDENCIES

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
  
  // Register the templates router
  app.use('/api/templates', templatesRouter);
  
  // Register the calendar router
  app.use('/api/calendar', calendarRouter);
  
  // Direct login handler
  app.post('/api/direct-login', handleDirectLogin);
  
  // Add a health check endpoint
  app.get('/healthz', async (req: Request, res: Response) => {
    try {
      // Test the database connection
      await sql`SELECT 1`.execute(db);
      
      // If successful, return a 200 response
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Database connection failed',
        error: error.message
      });
    }
  });
  
  // Add a public assets directory for image uploads
  const uploadsDir = path.resolve(process.cwd(), 'public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
      const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueFilename);
    }
  });
  
  const upload = multer({ 
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept images only
      if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
      }
      cb(null, true);
    }
  });
  
  // Create HttpServer
  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });
  
  // Handle WebSocket connections
  wss.on('connection', async (ws, req) => {
    let userId: number | null = null;
    let authenticated = false;
    
    // Extract authentication info from URL or headers
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const headerToken = req.headers['sec-websocket-protocol'];
    
    // Try to authenticate with token
    if (token && token.startsWith('user-')) {
      try {
        const tokenParts = token.split('-');
        if (tokenParts.length >= 2) {
          userId = parseInt(tokenParts[1]);
          if (!isNaN(userId)) {
            // Verify user exists
            const { users } = await import("@shared/schema");
            const { eq } = await import("drizzle-orm");
            
            const [user] = await authDb.select().from(users).where(eq(users.id, userId));
            if (user) {
              authenticated = true;
              console.log(`WebSocket: User authenticated via token: ${userId}`);
            }
          }
        }
      } catch (error) {
        console.error('WebSocket token authentication error:', error);
      }
    }
    
    // Try to authenticate with header token
    if (!authenticated && headerToken && typeof headerToken === 'string') {
      try {
        const headerTokenStr = headerToken.split(', ')[0]; // Get first protocol
        if (headerTokenStr && headerTokenStr.startsWith('user-')) {
          const tokenParts = headerTokenStr.split('-');
          if (tokenParts.length >= 2) {
            userId = parseInt(tokenParts[1]);
            if (!isNaN(userId)) {
              // Verify user exists
              const { users } = await import("@shared/schema");
              const { eq } = await import("drizzle-orm");
              
              const [user] = await authDb.select().from(users).where(eq(users.id, userId));
              if (user) {
                authenticated = true;
                console.log(`WebSocket: User authenticated via header token: ${userId}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('WebSocket header authentication error:', error);
      }
    }
    
    if (!authenticated) {
      console.log('WebSocket: Authentication failed, closing connection');
      ws.close(1008, 'Authentication failed');
      return;
    }
    
    // Add user to a user->socket mapping for direct messaging
    const clientId = userId?.toString() || '';
    
    // Handle messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle chat messages
        if (data.type === 'chat_message' && data.roomId && data.content) {
          // Check if user is in this chat room
          const roomId = parseInt(data.roomId);
          
          // Store message in database
          if (userId) {
            try {
              // Store message in the database
              const messageData = {
                senderId: userId,
                chatRoomId: roomId,
                content: data.content,
                timestamp: new Date(),
                isRead: false
              };
              
              // Insert the message
              const newMessage = await dbStorage.createMessage(messageData);
              
              // Broadcast message to all connected clients
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'chat_message',
                    message: {
                      id: newMessage.id,
                      senderId: newMessage.senderId,
                      chatRoomId: newMessage.chatRoomId,
                      content: newMessage.content,
                      timestamp: newMessage.timestamp,
                      isRead: newMessage.isRead
                    }
                  }));
                }
              });
            } catch (error) {
              console.error('Error storing chat message:', error);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to store message'
              }));
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    });
    
    // Handle disconnect
    ws.on('close', () => {
      console.log(`WebSocket connection closed for user ${userId}`);
    });
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection_established',
      userId: userId
    }));
  });
  
  // Serve static files for production
  if (process.env.NODE_ENV === 'production') {
    const clientBuildPath = path.resolve(process.cwd(), 'public');
    console.log(`Serving static files from: ${clientBuildPath}`);
    
    // Check if the build directory exists
    if (fs.existsSync(clientBuildPath)) {
      // Serve static files
      app.use(express.static(clientBuildPath));
      
      // For any other request, send index.html (for SPA routing)
      app.get('*', (req, res) => {
        // API requests should 404 if not found
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ message: 'API endpoint not found' });
        }
        
        // All other routes go to index.html
        res.sendFile(path.resolve(clientBuildPath, 'index.html'));
      });
    } else {
      console.warn(`Client build directory not found: ${clientBuildPath}`);
    }
  }

  return httpServer;
}