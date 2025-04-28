import { Router, Request, Response } from "express";
import { Pool } from 'pg';

// Create a router for simple profile operations
export const simpleProfileRouter = Router();

// Helper function to get the database columns for the contractor_profiles table
async function getTableColumns(pool: Pool, tableName: string): Promise<string[]> {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [tableName]);
    
    return result.rows.map(row => row.column_name);
  } catch (error) {
    console.error(`Error fetching columns for ${tableName}:`, error);
    return [];
  }
}

// Production database connection string
const PRODUCTION_DB_URL = "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";

// This endpoint creates a very basic profile with minimal fields
// It's designed to work around the case sensitivity issues
simpleProfileRouter.post("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    // Connect directly to the PRODUCTION database
    const pool = new Pool({
      connectionString: PRODUCTION_DB_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Check if profile already exists
    const checkResult = await pool.query(
      'SELECT * FROM contractor_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (checkResult.rows.length > 0) {
      return res.json({
        success: true,
        message: "Profile already exists",
        profile: checkResult.rows[0]
      });
    }
    
    // Get user info
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const user = userResult.rows[0];
    
    // Create a bare minimum profile - using only the user_id column which we've verified exists
    const insertResult = await pool.query(
      'INSERT INTO contractor_profiles (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    
    if (insertResult.rows.length === 0) {
      return res.status(500).json({ message: "Failed to create profile" });
    }
    
    return res.json({
      success: true,
      message: "Profile created successfully",
      profile: insertResult.rows[0]
    });
  } catch (error) {
    console.error("Error in simple profile creation:", error);
    return res.status(500).json({ 
      message: "Failed to create contractor profile",
      error: String(error)
    });
  }
});

// This endpoint updates business information with correct column names
simpleProfileRouter.patch("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    // Connect directly to the PRODUCTION database
    const pool = new Pool({
      connectionString: PRODUCTION_DB_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // First, get the table columns to see what's available
    const columns = await getTableColumns(pool, 'contractor_profiles');
    console.log("Available columns in contractor_profiles table:", columns);
    
    // Check if profile exists
    const checkResult = await pool.query(
      'SELECT * FROM contractor_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }
    
    // Extract snake_case values directly from request body
    const { bio, skills, business_name } = req.body;
    
    // Update only the columns that actually exist
    try {
      // For arrays, we need to ensure proper JSON format for PostgreSQL
      const skillsJson = skills && Array.isArray(skills) 
        ? JSON.stringify(skills) 
        : '[]';
        
      console.log("Update values with snake_case keys:", {
        bio: bio || null,
        skills: skillsJson,
        business_name: business_name || null,
        user_id: userId
      });
      
      const updateResult = await pool.query(
        `UPDATE contractor_profiles 
         SET bio = $1, skills = $2, business_name = $3
         WHERE user_id = $4
         RETURNING *`,
        [
          bio || null, 
          skillsJson,
          business_name || null,
          userId
        ]
      );
      
      if (updateResult.rows.length === 0) {
        return res.status(500).json({ message: "Failed to update profile" });
      }
      
      return res.json({
        success: true,
        message: "Profile updated successfully",
        profile: updateResult.rows[0]
      });
    } catch (updateError) {
      console.error("Error updating profile:", updateError);
      return res.status(500).json({ 
        message: "Failed to update contractor profile",
        error: String(updateError)
      });
    }
  } catch (error) {
    console.error("Error in business info update:", error);
    return res.status(500).json({ 
      message: "Failed to update contractor profile",
      error: String(error)
    });
  }
});

// This endpoint retrieves the profile in its raw DB format
simpleProfileRouter.get("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    // Connect directly to the PRODUCTION database
    const pool = new Pool({
      connectionString: PRODUCTION_DB_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Get profile directly
    const result = await pool.query(
      'SELECT * FROM contractor_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }
    
    return res.json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error("Error fetching simple profile:", error);
    return res.status(500).json({ 
      message: "Failed to fetch contractor profile",
      error: String(error)
    });
  }
});