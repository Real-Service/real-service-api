import { Express, Request, Response } from "express";
import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';
import { PRODUCTION_DB_URL } from './config';

// Create a pool specifically for our production database
const productionPool = new Pool({ connectionString: PRODUCTION_DB_URL });

// Setup snake_case auth routes
export function setupSnakeCaseAuth(app: Express) {
  // Login with snake_case column names for production database
  app.post('/api/snake-case-auth/login', async (req: Request, res: Response) => {
    try {
      console.log('Snake case login attempt with:', { 
        email: req.body.email, 
        passwordLength: req.body.password?.length || 0 
      });

      // Validate required fields
      if (!req.body.email || !req.body.password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Query using snake_case column names
      const result = await productionPool.query(
        `SELECT id, username, email, password, user_type, full_name 
         FROM users 
         WHERE email = $1`,
        [req.body.email]
      );

      const user = result.rows[0];
      if (!user) {
        console.log('User not found with email:', req.body.email);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
      if (!isPasswordValid) {
        console.log('Invalid password for user:', user.id);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Set session for authentication
      if (req.session) {
        req.session.userId = user.id;
        req.session.userType = user.user_type;
        req.session.authTimestamp = Date.now();
      }

      // Set cookie as fallback
      res.cookie('user_id', user.id, { maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.cookie('auth_timestamp', Date.now(), { maxAge: 7 * 24 * 60 * 60 * 1000 });

      console.log('Snake case login successful for user:', user.id);

      // Return the user with camelCase keys for client compatibility
      return res.status(200).json({
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.user_type,
        fullName: user.full_name
      });
    } catch (error) {
      console.error('Snake case login error:', error);
      return res.status(500).json({ message: 'An error occurred during login' });
    }
  });

  // Get user profile with snake_case column handling
  app.get('/api/snake-case-auth/user', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      const userId = req.session?.userId || req.cookies?.user_id;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Query user with snake_case columns
      const result = await productionPool.query(
        `SELECT id, username, email, user_type, full_name, profile_picture, created_at, updated_at
         FROM users 
         WHERE id = $1`,
        [userId]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = result.rows[0];

      // Return response with camelCase for client compatibility
      return res.status(200).json({
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.user_type,
        fullName: user.full_name,
        profilePicture: user.profile_picture,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({ message: 'Error fetching user data' });
    }
  });

  // Logout endpoint
  app.post('/api/snake-case-auth/logout', (req: Request, res: Response) => {
    // Clear session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });
    }

    // Clear cookies
    res.clearCookie('user_id');
    res.clearCookie('auth_timestamp');

    return res.status(200).json({ message: 'Logged out successfully' });
  });
}