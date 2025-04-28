import { Router, Request, Response } from 'express';
import { storage as dbStorage } from './storage';

// Create a router for contractor profile endpoints
export const contractorProfileRouter = Router();

// Create contractor profile endpoint
contractorProfileRouter.post("/", async (req: Request, res: Response) => {
  try {
    // Get authenticated user ID from request (session, header, etc.)
    let userId = req.session?.userId;
    
    // Fallback to X-User-ID header for extra reliability
    if (!userId && req.headers['x-user-id']) {
      const headerUserId = req.headers['x-user-id'] as string;
      userId = parseInt(headerUserId);
      
      // If using header auth, update the session for future requests
      if (req.session) {
        console.log(`Using X-User-ID header for authentication: ${userId}`);
        req.session.userId = userId;
      }
    }
    
    console.log(`POST profile request: authenticated user ${userId}`);
    
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Get the user to verify they are a contractor
    const user = await dbStorage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (user.userType !== 'contractor') {
      return res.status(400).json({ message: "User is not a contractor" });
    }
    
    // Check if profile already exists
    const existingProfile = await dbStorage.getContractorProfile(userId);
    if (existingProfile) {
      return res.status(409).json({ 
        message: "Contractor profile already exists",
        profile: existingProfile
      });
    }
    
    // Create profile
    console.log(`Creating profile for contractor ${userId} with data:`, req.body);
    const newProfile = await dbStorage.createContractorProfile({
      userId,
      ...req.body
    });
    
    return res.status(201).json({
      message: "Contractor profile created successfully",
      profile: newProfile
    });
  } catch (error) {
    console.error("Error creating contractor profile:", error);
    return res.status(500).json({ 
      message: "An error occurred while creating the contractor profile" 
    });
  }
});

// Get contractor profile by ID
contractorProfileRouter.get("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    // Get authenticated user ID from request (session, header, etc.)
    let authenticatedUserId = req.session?.userId;
    
    // Fallback to X-User-ID header for extra reliability
    if (!authenticatedUserId && req.headers['x-user-id']) {
      const headerUserId = req.headers['x-user-id'] as string;
      authenticatedUserId = parseInt(headerUserId);
      
      // If using header auth, update the session for future requests
      if (req.session) {
        console.log(`Using X-User-ID header for authentication: ${authenticatedUserId}`);
        req.session.userId = authenticatedUserId;
      }
    }
    
    // Log authentication details for debugging
    console.log(`Profile request: authenticated user ${authenticatedUserId}, requested profile ${userId}`);
    
    // If the request is for someone other than the authenticated user, deny access
    // In the future, we could add permissions for admins/managers
    if (authenticatedUserId !== userId) {
      return res.status(403).json({ message: "You do not have permission to view this profile" });
    }
    
    // Get the user record to verify they are a contractor and get additional info
    const user = await dbStorage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (user.userType !== 'contractor') {
      return res.status(400).json({ message: "User is not a contractor" });
    }
    
    // Get the contractor profile
    console.log("Attempting to fetch profile for user ID:", userId);
    
    try {
      // First try using the storage method
      const profile = await dbStorage.getContractorProfile(userId);
      
      if (!profile) {
        console.log("Profile not found through storage method. Trying direct SQL query...");
        
        // If that fails, try a direct SQL query as a backup
        const { Pool } = await import('pg');
        const pool = new Pool({
          connectionString: "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
          ssl: { rejectUnauthorized: false }
        });
        
        // Use a query that exactly matches the table's column structure with proper column names
        const result = await pool.query(`
          SELECT * FROM contractor_profiles 
          WHERE user_id = $1::integer
          ORDER BY id DESC
          LIMIT 1
        `, [userId]);
        
        console.log(`Direct SQL query for user ${userId} returned ${result.rows.length} rows:`, JSON.stringify(result.rows));
        
        if (result.rows.length > 0) {
          // Create profile from raw data for emergency use
          const rawProfile = result.rows[0];
          const emergencyProfile = {
            id: rawProfile.id,
            userId: rawProfile.user_id,
            businessName: rawProfile.business_name,
            description: rawProfile.description || null,
            trades: rawProfile.trades || [],
            skills: rawProfile.skills || [],
            bio: rawProfile.bio || null,
            hasLiabilityInsurance: rawProfile.has_liability_insurance || false,
            serviceRadius: rawProfile.service_radius || 0,
            // Add other fields as needed
          };
          
          console.log("Created emergency profile:", JSON.stringify(emergencyProfile));
          return res.json({
            profile: emergencyProfile,
            source: "direct_sql_emergency"
          });
        }
        
        // If no profile found even with direct query
        return res.status(404).json({ message: "Contractor profile not found" });
      }
      
      // Normal case - profile found through storage method
      return res.json({ profile, source: "storage_method" });
    } catch (error) {
      console.error("Error fetching contractor profile:", error);
      return res.status(500).json({ message: "Error fetching contractor profile", error: String(error) });
    }
    
    // Log the profile data for debugging
    console.log("Fetched contractor profile data:", JSON.stringify(profile));
    
    // Map any missing or differently named fields for consistency
    const processedProfile = {
      ...profile,
      // Essential user information
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      username: user.username,
      
      // Ensure these fields are always present, even if null
      businessName: profile.businessName || null,
      trades: profile.trades || [],
      bio: profile.bio || null,
      city: profile.city || null,
      state: profile.state || null,
      hasLiabilityInsurance: profile.hasLiabilityInsurance || false,
      hourlyRate: profile.hourlyRate || null,
      serviceRadius: profile.serviceRadius || 25,
      // Convert string values to numbers where needed for frontend compatibility
      walletBalance: Number(profile.walletBalance || 0),
      averageRating: Number(profile.averageRating || 0),
      totalRatings: Number(profile.totalRatings || 0),
      languages: profile.languages || [],
      paymentMethods: profile.paymentMethods || [],
      serviceAreas: profile.serviceAreas || []
    };
    
    // Explicitly convert specific fields to numeric values before JSON serialization
    const numericWalletBalance = Number(processedProfile.walletBalance);
    const finalProfile = {
      ...processedProfile,
      walletBalance: numericWalletBalance
    };
    
    console.log("Final profile data type check:", {
      walletBalanceType: typeof finalProfile.walletBalance,
      walletBalanceValue: finalProfile.walletBalance
    });
    
    return res.status(200).json(finalProfile);
  } catch (error) {
    console.error("Error fetching contractor profile:", error);
    return res.status(500).json({ 
      message: "An error occurred while fetching the contractor profile" 
    });
  }
});

// Update contractor profile
contractorProfileRouter.patch("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    // Get authenticated user ID from request (session, header, etc.)
    let authenticatedUserId = req.session?.userId;
    
    // Enhanced authentication handling with multiple fallbacks
    // First check X-User-ID header
    if (!authenticatedUserId && req.headers['x-user-id']) {
      const headerUserId = req.headers['x-user-id'] as string;
      authenticatedUserId = parseInt(headerUserId);
      
      // Also validate auth token if it's present
      const authToken = req.headers['x-auth-token'] as string;
      const timestampHeader = req.headers['x-auth-timestamp'] as string;
      
      if (authToken) {
        console.log(`Validating auth token: ${authToken} with user ID ${authenticatedUserId}`);
        
        // Token should be in format: user-{id}-{timestamp}
        const expectedToken = `user-${authenticatedUserId}-${timestampHeader}`;
        if (authToken === expectedToken) {
          console.log("Token authentication successful");
          
          // If using header auth, update the session for future requests
          if (req.session) {
            console.log(`Using X-User-ID header for authentication: ${authenticatedUserId}`);
            req.session.userId = authenticatedUserId;
            
            // Force session save to ensure persistence
            req.session.save((err) => {
              if (err) {
                console.error("Error saving session:", err);
              } else {
                console.log("Session saved successfully");
              }
            });
          }
        } else {
          console.log(`Token mismatch: ${authToken} vs expected ${expectedToken}`);
        }
      }
    }
    
    // Last fallback - check the 'user_id' in cookies directly
    if (!authenticatedUserId && req.cookies && req.cookies.user_id) {
      try {
        authenticatedUserId = parseInt(req.cookies.user_id);
        console.log(`Using cookie-based user ID: ${authenticatedUserId}`);
        
        // Update session if valid
        if (!isNaN(authenticatedUserId) && req.session) {
          req.session.userId = authenticatedUserId;
        }
      } catch (e) {
        console.error("Error parsing user_id from cookies:", e);
      }
    }
    
    // Log authentication status and details
    console.log(`Profile update: authenticated user ${authenticatedUserId}, requested profile ${userId}`);
    console.log("Request headers:", req.headers);
    console.log("Request cookies:", req.cookies);
    
    // Check if still not authenticated
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    // Only allow users to update their own profile
    if (authenticatedUserId !== userId) {
      return res.status(403).json({ message: "You do not have permission to update this profile" });
    }
    
    // Get the user to verify they are a contractor
    const user = await dbStorage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (user.userType !== 'contractor') {
      return res.status(400).json({ message: "User is not a contractor" });
    }
    
    // Check if profile exists
    const existingProfile = await dbStorage.getContractorProfile(userId);
    if (!existingProfile) {
      // Create a new profile if one doesn't exist
      const newProfile = await dbStorage.createContractorProfile({
        userId,
        ...req.body
      });
      
      return res.status(201).json({
        message: "Contractor profile created successfully",
        profile: newProfile
      });
    }
    
    // Log the update data for debugging
    console.log("Updating contractor profile with data:", JSON.stringify(req.body));
    
    // Process the update data
    // We need to handle any field mapping between camelCase (frontend) and snake_case (database)
    const updateData = { ...req.body };
    
    // Special field handling based on actual database column names
    if (updateData.serviceArea === null) {
      // Handle service area deletion properly
      updateData.serviceArea = null;
      updateData.serviceRadius = null;
      updateData.serviceAreas = [];
    }
    
    // Update existing profile
    const updatedProfile = await dbStorage.updateContractorProfile(userId, updateData);
    
    if (!updatedProfile) {
      return res.status(500).json({ 
        message: "An error occurred while updating the contractor profile"
      });
    }
    
    // Post-process the updated profile to ensure all fields are properly formatted
    const processedProfile = {
      ...updatedProfile,
      businessName: updatedProfile.businessName || null,
      trades: updatedProfile.trades || [],
      skills: updatedProfile.skills || [], // Make sure skills are included
      bio: updatedProfile.bio || null,
      city: updatedProfile.city || null,
      state: updatedProfile.state || null,
      hasLiabilityInsurance: updatedProfile.hasLiabilityInsurance || false,
      hourlyRate: updatedProfile.hourlyRate || null,
      serviceRadius: updatedProfile.serviceRadius || 25,
      // Convert string values to numbers where needed for frontend compatibility
      walletBalance: Number(updatedProfile.walletBalance || 0),
      averageRating: Number(updatedProfile.averageRating || 0),
      totalReviews: Number(updatedProfile.totalReviews || 0),
      languages: updatedProfile.languages || [],
      paymentMethods: updatedProfile.paymentMethods || [],
      serviceAreas: updatedProfile.serviceAreas || []
    };
    
    // Log the processed profile for debugging
    console.log("Returning processed profile with skills and bio:", {
      skills: processedProfile.skills,
      bio: processedProfile.bio
    });
    
    return res.status(200).json({
      message: "Contractor profile updated successfully",
      profile: processedProfile
    });
  } catch (error) {
    console.error("Error updating contractor profile:", error);
    return res.status(500).json({ 
      message: "An error occurred while updating the contractor profile" 
    });
  }
});