import { Request, Response, NextFunction } from "express";

/**
 * Middleware to ensure the user is authenticated
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });
  }
  
  // User is authenticated, continue
  next();
}