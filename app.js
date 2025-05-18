/**
 * Minimal production server
 * Pure JavaScript with no TypeScript or any other imports that might lead to Vite
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import helmet from 'helmet';
import session from 'express-session';
import { fileURLToPath } from 'url';

// Handle __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const port = process.env.PORT || 5000;

// CORS setup
app.use(cors({
  origin: true,
  credentials: true
}));

// Security headers
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

// Parse JSON requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Set up sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API placeholder endpoint
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'API server running',
    message: 'Production server is running. Full API functionality will be enabled soon.'
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.resolve(process.cwd(), 'public');
  console.log(`Serving static files from: ${clientBuildPath}`);
  
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
}

// Create HTTP server
const server = createServer(app);

// WebSocket server
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
});