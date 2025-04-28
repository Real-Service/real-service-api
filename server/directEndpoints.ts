import { Request, Response, Router } from 'express';
import { Pool } from 'pg';

// Create a router for the direct endpoints
export const directEndpointsRouter = Router();

// Direct endpoint for contractor profiles
directEndpointsRouter.get('/contractor-profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Direct database connection to ensure reliability
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false }
    });

    console.log(`Direct SQL query requesting contractor profile for user ID: ${userId}`);
    
    // Query using correct column names
    const result = await pool.query(`
      SELECT * FROM contractor_profiles 
      WHERE user_id = $1
      ORDER BY id DESC 
      LIMIT 1
    `, [userId]);
    
    console.log(`Direct SQL query found ${result.rows.length} results`);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contractor profile not found' });
    }

    // Transform snake_case column names to camelCase for frontend
    const rawProfile = result.rows[0];
    const profile = {
      id: rawProfile.id,
      userId: rawProfile.user_id,
      businessName: rawProfile.business_name,
      description: rawProfile.description,
      phoneNumber: rawProfile.phone_number,
      website: rawProfile.website,
      yearsOfExperience: rawProfile.years_of_experience,
      licenseNumber: rawProfile.license_number,
      insuranceProvider: rawProfile.insurance_provider,
      insurancePolicyNumber: rawProfile.insurance_policy_number,
      hasLiabilityInsurance: rawProfile.has_liability_insurance,
      trades: rawProfile.trades || [],
      serviceRadius: rawProfile.service_radius,
      walletBalance: Number(rawProfile.wallet_balance) || 0,
      averageRating: Number(rawProfile.average_rating) || 0,
      totalReviews: rawProfile.total_reviews || 0,
      skills: rawProfile.skills || [],
      bio: rawProfile.bio,
      createdAt: rawProfile.created_at,
      updatedAt: rawProfile.updated_at
    };

    // Get the user data for additional profile information
    const userResult = await pool.query(`
      SELECT * FROM users WHERE id = $1
    `, [userId]);

    let enhancedProfile = { ...profile };
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      enhancedProfile = {
        ...profile,
        // Add user details to the profile
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        username: user.username,
      };
    }

    return res.json({
      profile: enhancedProfile,
      source: 'direct_sql'
    });
  } catch (error) {
    console.error('Error in direct contractor profile endpoint:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching the contractor profile',
      error: String(error)
    });
  }
});

// Direct endpoint for creating/updating contractor profiles
directEndpointsRouter.post('/contractor-profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Get authenticated user ID
    const authenticatedUserId = req.session?.userId || 
                               (req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'] as string) : null);
    
    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Only allow users to update their own profile
    if (authenticatedUserId !== userId) {
      return res.status(403).json({ message: 'You do not have permission to update this profile' });
    }

    // Direct database connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false }
    });

    // Check if user exists and is a contractor
    const userResult = await pool.query(`
      SELECT * FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    if (user.user_type !== 'contractor') {
      return res.status(400).json({ message: 'User is not a contractor' });
    }

    // Check if profile already exists
    const existingProfileResult = await pool.query(`
      SELECT * FROM contractor_profiles WHERE user_id = $1
    `, [userId]);

    const profileData = req.body;
    console.log('Profile update data:', profileData);

    let result;
    
    // If profile exists, update it
    if (existingProfileResult.rows.length > 0) {
      // Build the SET part of the SQL query dynamically
      const updates = [];
      const values = [userId]; // userId will be $1
      let paramIndex = 2;

      // Map camelCase keys to snake_case for the database
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

      // Add updated_at timestamp
      updates.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      
      // Execute the update query
      const updateQuery = `
        UPDATE contractor_profiles 
        SET ${updates.join(', ')} 
        WHERE user_id = $1
        RETURNING *
      `;
      
      console.log('Executing update query:', updateQuery);
      console.log('With values:', values);
      
      result = await pool.query(updateQuery, values);
      
      return res.json({
        message: 'Contractor profile updated successfully',
        profile: result.rows[0],
        source: 'direct_sql_update'
      });
    } else {
      // Create a new profile
      const fields = ['user_id'];
      const placeholders = ['$1'];
      const values = [userId];
      let paramIndex = 2;

      // Map camelCase keys to snake_case for the database
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

      // Add each provided field to the insert query
      for (const [key, value] of Object.entries(profileData)) {
        const dbField = fieldMappings[key];
        if (dbField) {
          fields.push(dbField);
          placeholders.push(`$${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      // Add created_at and updated_at timestamps
      const now = new Date();
      fields.push('created_at', 'updated_at');
      placeholders.push(`$${paramIndex}`, `$${paramIndex + 1}`);
      values.push(now, now);

      // Execute the insert query
      const insertQuery = `
        INSERT INTO contractor_profiles (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
      
      console.log('Executing insert query:', insertQuery);
      console.log('With values:', values);
      
      result = await pool.query(insertQuery, values);
      
      return res.status(201).json({
        message: 'Contractor profile created successfully',
        profile: result.rows[0],
        source: 'direct_sql_create'
      });
    }
  } catch (error) {
    console.error('Error in direct contractor profile update endpoint:', error);
    return res.status(500).json({
      message: 'An error occurred while updating the contractor profile',
      error: String(error)
    });
  }
});