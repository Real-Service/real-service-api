import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cors from "cors";
import { registerRoutes } from "./routes";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import helmet from "helmet";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { authDb } from "./auth-db";
import { Pool } from "pg";
import path from "path";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";

// For production mode only, define our own static file serving
const serveStaticProd = (app: express.Express) => {
  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));
  
  // For SPA routing, send index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next(); // Skip for API routes
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
};

// Generate a random session secret if one isn't provided
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
process.env.SESSION_SECRET = SESSION_SECRET;

const app = express();

// Enable trust proxy for production environments (required for secure cookies behind proxies)
app.set('trust proxy', 1);

// Apply Helmet for security headers
app.use(helmet({
  // Allow proper frame usage (for embedded maps etc.) while keeping other protections
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://*.mapbox.com", "https://*.neon.tech"],
      frameSrc: ["'self'", "https://*.mapbox.com", "https://*.stripe.com"],
      imgSrc: ["'self'", "data:", "https://*.mapbox.com", "https://*.stripe.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://*.mapbox.com", "https://*.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://*.mapbox.com"]
    }
  }
}));

// Configure CORS middleware for all environments with specific production settings
app.use((req, res, next) => {
  // Log origin for debugging
  console.log(`Request origin: ${req.headers.origin}`);
  next();
});

// Configure comprehensive CORS for both development and production
app.use(cors({
  // Allow the following origins explicitly (including deployed Replit apps)
  origin: function(origin, callback) {
    // List of allowed origins
    const allowedOrigins = [
      // Local development
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000',
      // Replit domains (wildcard doesn't work with credentials, so list a few common patterns)
      'https://real-service-production.replit.app',
      'https://real-service.replit.app',
      '.replit.app', // This won't work directly with credentials:true but is here for documentation
      '.repl.co',
      // Your specific Replit deployments
      'https://e7000f38-91a3-419e-a12d-e4f2a1c8b2d8-00-29j2zsyhh0ddu.spock.replit.dev'
    ];
    
    // Allow browsers to make requests without sending an origin (null origin)
    // This is needed for some mobile and desktop applications
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if the origin is allowed
    // We need to check for domain patterns since Replit creates dynamic subdomains
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.startsWith('.')) {
        // Handle wildcard subdomains by checking if the origin ends with this domain
        return origin.endsWith(allowedOrigin);
      }
      return origin === allowedOrigin;
    });
    
    if (isAllowed) {
      callback(null, true); // Origin allowed
    } else {
      console.log(`Origin not allowed: ${origin}`);
      // Still allow the request for better user experience, but log it
      callback(null, true);
    }
  },
  credentials: true, // Allow cookies to be sent with requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'X-User-ID', 
    'X-Auth-Token',
    'X-Auth-Timestamp',
    'X-Force-Reload',
    'X-No-Cookies',
    'X-Debug-Mode'
  ],
  exposedHeaders: ['Set-Cookie', 'Content-Type', 'Content-Length', 'ETag', 'Date'] // Explicitly expose headers
}));

// Add X-User-ID middleware to ensure sessions are maintained
app.use((req, res, next) => {
  // Log session state for debugging
  console.log(`${req.method} ${req.path} - Cookies: ${req.headers.cookie}`);
  
  if (req.session) {
    console.log(`Session ID: ${req.session.id}, Session user: ${req.session.userId}`);
  }
  
  // Proceed with request
  next();
});

// Increase JSON body size limit to 10MB to handle larger requests with images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// In development, we don't need explicit CORS settings since we're using
// the same origin for client and server. If we were deploying to production 
// with different domains, we would need to configure this more carefully.
// Removing custom CORS headers to avoid conflicts with express-session
// The cors package already set up proper headers above

// Generate a random session secret if one isn't provided
if (!SESSION_SECRET) {
  console.warn("Warning: SESSION_SECRET not set, using a generated one");
  process.env.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
}

// Create a dedicated connection pool for session storage that uses TCP/SSL only
// We'll use this in our session store implementation once we fix the connect-pg-simple integration
const pgSessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3, // Small pool just for session operations
});

console.log('Development mode: Using memory store for session persistence');

// Use memory store for now until we fix the session store integration
console.log('Enabling full cookie-based authentication with memory store temporarily.');
app.use(session({
  // Using memory store fallback until we fix the pg-session-store issue
  // store: new PgSessionStore({
  //   pool: pgSessionPool,
  //   tableName: 'session',
  //   createTableIfMissing: true, // Auto-create table if needed
  // }),
  secret: process.env.SESSION_SECRET || 'default-secret-for-development-only',
  resave: false,
  saveUninitialized: false,
  name: 'sid',
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24, // 1 day session lifetime
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/'
  }
}));

// Force save the session to the store after modification
app.use((req, res, next) => {
  // Store the original end method
  const originalEnd = res.end;
  
  // Override with properly typed end method that matches Express's Response.end
  res.end = function(this: any, chunk?: any, encoding?: BufferEncoding, callback?: () => void): any {
    // Always save the session before ending the response
    if (req.session) {
      // Log session changes for debugging
      if (req.session.userId) {
        console.log(`Saving session before response end. Session ID: ${req.sessionID}, User ID: ${req.session.userId}`);
      }
      
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        }
        
        // Call the original end method with original arguments using a safer approach
        originalEnd.apply(this, [chunk, encoding as BufferEncoding, callback].filter(x => x !== undefined));
      });
    } else {
      // No session to save, just call the original end
      originalEnd.apply(this, [chunk, encoding as BufferEncoding, callback].filter(x => x !== undefined));
    }
    
    return this;
  };
  
  next();
});

// Log the session configuration for debugging
console.log('Session configured with:', {
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    maxAge: '1 day (cookies enabled)'
  },
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET ? '[Set]' : '[Generated]',
  store: 'In-memory session store (fallback)'
});

// Debug logging for requests and cookie handling
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Log cookies and session info
  if (path.startsWith("/api")) {
    console.log(`${req.method} ${path} - Cookies:`, req.headers.cookie);
    console.log(`Session ID: ${req.session?.id}, Session user: ${req.session?.userId}`);
  }

  // Capture JSON responses for logging
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Log response headers for Set-Cookie
  const originalSetHeader = res.setHeader;
  res.setHeader = function(name, value) {
    if (name.toLowerCase() === 'set-cookie') {
      console.log('Setting cookies:', value);
    }
    return originalSetHeader.apply(res, [name, value]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Add health check endpoints before other routes
  
  // Simple health check endpoint for monitoring tools (returns plain text)
  app.get('/healthz', (req: Request, res: Response) => {
    res.status(200).send('OK');
  });
  
  // Detailed health check with database connectivity test
  app.get('/health', async (req: Request, res: Response) => {
    try {
      // Simple test query to verify database connectivity using the TCP-safe authDb client
      const isProduction = process.env.NODE_ENV === 'production';
      
      if (isProduction) {
        // In production, use the TCP-safe authDb client
        await authDb.execute(sql`SELECT 1`);
      } else {
        // In development, use the regular db client
        await db.execute(sql`SELECT 1`);
      }
      
      res.status(200).json({ 
        status: 'ok', 
        db: 'connected',
        connection: isProduction ? 'TCP/SSL Pool' : 'WebSocket',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Health Check Error:', error);
      res.status(500).json({ 
        status: 'error', 
        db: 'disconnected',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // API health check endpoint for comprehensive monitoring
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      // Basic health information
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      };

      // Check database connection
      try {
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (isProduction) {
          await authDb.execute(sql`SELECT NOW() as time`);
        } else {
          await db.execute(sql`SELECT NOW() as time`);
        }

        health['database'] = {
          connected: true,
          connection_type: isProduction ? 'TCP/SSL Pool' : 'WebSocket',
        };
      } catch (dbError) {
        health['database'] = {
          connected: false,
          error: process.env.NODE_ENV === 'production' 
            ? 'Database connection failed' 
            : dbError instanceof Error ? dbError.message : String(dbError)
        };
      }

      res.status(200).json(health);
    } catch (error) {
      console.error('API Health Check Failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Register API routes
  const server = await registerRoutes(app);
  
  // Always use setupVite, which will properly handle both
  // development (HMR) and production static file serving
  try {
    await setupVite(app, server);
    console.log("Successfully set up Vite integration.");
  } catch (err) {
    console.error("Failed to setup Vite:", err);
    // Fallback to static file serving if Vite setup fails
    console.log("Falling back to static file serving");
    serveStaticProd(app);
  }

  // 1. Catch 404 for unmatched API routes only
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `API route ${req.originalUrl} not found`,
    });
  });

  // 2. Global error handler with improved logging and formatting
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('🚨 Server error:', err);

    // Only send JSON response for API routes
    if (req.path.startsWith('/api/')) {
      res.status(err.status || err.statusCode || 500).json({
        error: 'Server Error',
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      });
    } else {
      // For non-API routes, pass to the next error handler
      next(err);
    }
  });

  // CRITICAL FIX: Use exact format as shown in screenshots
  const PORT = process.env.PORT || 5000;
  
  app.listen(PORT, () => {
    console.log("✅ Server is running and listening on port " + PORT);
  });
})();
