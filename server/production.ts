/**
 * Standalone production server with no Vite dependencies
 * This file is completely self-contained and doesn't import any modules 
 * that might accidentally reference Vite
 */

import express from "express";
import session from "express-session";
import cors from "cors";
import { randomBytes } from "crypto";
import helmet from "helmet";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";
import ws from "ws";

// Setup dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start express app
const app = express();
const port = process.env.PORT || 5000;

// Configure CORS options for production
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'X-User-ID', 
    'X-Auth-Token',
    'X-Auth-Timestamp',
    'X-Force-Reload'
  ]
}));

// Apply security headers
app.use(helmet({
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

// Configure express to parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Set up session middleware
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'sid',
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24, // 1 day session lifetime
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Set up a basic database connection
let db: any;
if (process.env.DATABASE_URL) {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
    console.log('Database connection established');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
}

// Add a health check endpoint
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.resolve(process.cwd(), 'public');
  console.log(`Serving static files from: ${clientBuildPath}`);
  
  if (fs.existsSync(clientBuildPath)) {
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

// Create an HTTP server
const server = createServer(app);

// Set up a WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('WebSocket message received:', data.type);
    } catch (error) {
      console.error('Error parsing WebSocket message');
    }
  });
  
  ws.send(JSON.stringify({
    type: 'connection_established',
    timestamp: new Date().toISOString()
  }));
});

// Start the server
server.listen(port, () => {
  console.log(`Production server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database connection: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
});