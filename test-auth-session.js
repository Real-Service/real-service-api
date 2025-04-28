// Direct test of session store and authentication
import { Pool } from 'pg';
import connectPg from 'connect-pg-simple';
import session from 'express-session';
import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

dotenv.config();

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString('hex')}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64));
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function testAuthSession() {
  console.log('Testing authentication and session flow...');
  
  // Create a PostgreSQL Pool with SSL
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Test database connection
    const { rows } = await pgPool.query('SELECT NOW()');
    console.log(`✅ PostgreSQL connection successful: ${rows[0].now}`);
    
    // Create Express app for testing
    const app = express();
    
    // Set up the session middleware with PostgreSQL store
    const PostgresSessionStore = connectPg(session);
    
    // Create store instance with logging
    const sessionStore = new PostgresSessionStore({
      pool: pgPool,
      tableName: 'session',
      createTableIfMissing: true,
      errorLog: console.error.bind(console),
    });
    
    // Add custom get method
    const originalGet = sessionStore.get;
    sessionStore.get = async (sid, callback) => {
      try {
        console.log(`Getting session with SID: ${sid}`);
        
        // Try direct query first to verify data is there
        const result = await pgPool.query(
          'SELECT sess FROM session WHERE sid = $1 AND expire > NOW()',
          [sid]
        );
        
        if (result.rows.length > 0) {
          console.log('Session found in direct query:', result.rows[0].sess);
          
          // Try the standard method
          return originalGet.call(sessionStore, sid, (err, session) => {
            console.log('Original get callback result:', err, session);
            callback(err, session);
          });
        } else {
          console.log('No session found for SID:', sid);
          if (callback) callback(null, null);
          return null;
        }
      } catch (error) {
        console.error('Error getting session:', error);
        if (callback) callback(error);
        throw error;
      }
    };
    
    const SESSION_SECRET = 'test-secret-1234';
    
    app.use(express.json());
    app.use(session({
      store: sessionStore,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 day 
      }
    }));
    
    // Mock user database for testing
    const users = new Map();
    
    // Register endpoint
    app.post('/register', async (req, res) => {
      try {
        const { username, password } = req.body;
        
        if (users.has(username)) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        
        const hashedPassword = await hashPassword(password);
        const user = { id: Date.now(), username, password: hashedPassword };
        users.set(username, user);
        
        // Log in the user
        req.session.user = { id: user.id, username: user.username };
        req.session.isAuthenticated = true;
        
        await new Promise(resolve => req.session.save(resolve));
        console.log('Session after registration:', req.session);
        console.log('Session ID:', req.session.id);
        
        res.status(201).json({ id: user.id, username: user.username });
      } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
      }
    });
    
    // Login endpoint
    app.post('/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        const user = users.get(username);
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        req.session.user = { id: user.id, username: user.username };
        req.session.isAuthenticated = true;
        
        await new Promise(resolve => req.session.save(resolve));
        console.log('Session after login:', req.session);
        console.log('Session ID:', req.session.id);
        
        res.json({ id: user.id, username: user.username });
      } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
      }
    });
    
    // Get user endpoint
    app.get('/user', (req, res) => {
      console.log('Session in /user endpoint:', req.session);
      
      if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      res.json(req.session.user);
    });
    
    // Logout endpoint
    app.post('/logout', (req, res) => {
      req.session.destroy(err => {
        if (err) {
          console.error('Logout error:', err);
          return res.status(500).json({ error: 'Logout failed' });
        }
        
        res.json({ success: true });
      });
    });
    
    // Start server
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    console.log(`✅ Test server running on port ${port}`);
    
    // Test registration
    console.log('\n📝 Testing registration...');
    const registerRes = await fetch(`http://localhost:${port}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'password123' })
    });
    
    if (!registerRes.ok) {
      throw new Error(`Registration failed: ${await registerRes.text()}`);
    }
    
    const registerData = await registerRes.json();
    console.log('✅ Registration successful:', registerData);
    
    // Get cookies from response
    const cookies = registerRes.headers.get('set-cookie');
    if (!cookies) {
      throw new Error('No cookies received from server');
    }
    console.log('Cookies received:', cookies);
    
    // Extract session ID from cookies
    const sessionIdMatch = cookies.match(/connect\.sid=([^;]+)/);
    if (!sessionIdMatch) {
      throw new Error('No session ID in cookies');
    }
    
    const sessionId = sessionIdMatch[1];
    console.log('Session ID from cookies:', sessionId);
    
    // Test getting user with session cookie
    console.log('\n👤 Testing user endpoint with session cookie...');
    const userRes = await fetch(`http://localhost:${port}/user`, {
      headers: { 'Cookie': `connect.sid=${sessionId}` }
    });
    
    if (userRes.ok) {
      const userData = await userRes.json();
      console.log('✅ User data retrieved successfully:', userData);
    } else {
      console.error('❌ Failed to get user data:', await userRes.text());
    }
    
    // Test direct session retrieval from store
    console.log('\n🔍 Testing direct session retrieval from store...');
    
    // Decode session ID from cookie (it's URL encoded and signed)
    const decodedSessionId = decodeURIComponent(sessionId).split('.')[0].slice(2);
    console.log('Decoded session ID:', decodedSessionId);
    
    // Try to retrieve session directly from store
    await new Promise((resolve, reject) => {
      sessionStore.get(decodedSessionId, (err, session) => {
        if (err) {
          console.error('❌ Error retrieving session from store:', err);
          reject(err);
        } else if (session) {
          console.log('✅ Session retrieved from store:', session);
          resolve(session);
        } else {
          console.error('❌ No session found in store');
          
          // Query the database directly to check
          pgPool.query('SELECT * FROM session WHERE sid = $1', [decodedSessionId])
            .then(result => {
              if (result.rows.length > 0) {
                console.log('Session found in database:', result.rows[0]);
              } else {
                console.log('No session found in database');
              }
              resolve(null);
            })
            .catch(dbErr => {
              console.error('Error querying database:', dbErr);
              reject(dbErr);
            });
        }
      });
    });
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    server.close();
    await pgPool.end();
    console.log('✅ Test completed');
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

testAuthSession();