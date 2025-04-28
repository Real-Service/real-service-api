import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export const contractorProfileFixRouter = Router();

// Simplified endpoint for getting or creating a contractor profile
contractorProfileFixRouter.get('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Use direct connection to the database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false }
    });

    // First check if user exists and is a contractor
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

    // Check if profile exists
    const profileResult = await pool.query(`
      SELECT * FROM contractor_profiles WHERE user_id = $1
    `, [userId]);

    // If profile doesn't exist, create it
    if (profileResult.rows.length === 0) {
      console.log(`Creating new profile for contractor ${userId}`);
      
      // Create a basic profile with minimal info
      const insertResult = await pool.query(`
        INSERT INTO contractor_profiles (
          "user_id", "business_name", "description", "phone_number", "trades", 
          "service_radius", "has_liability_insurance", "wallet_balance", 
          "average_rating", "total_reviews", "skills", "bio"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `, [
        userId,
        user.full_name ? `${user.full_name}'s Business` : 'New Contractor Business',
        'Professional contractor services',
        user.phone,
        ['General Contractor'],
        25,
        false,
        0,
        0,
        0,
        [],
        null
      ]);
      
      if (insertResult.rows.length === 0) {
        return res.status(500).json({ message: 'Failed to create contractor profile' });
      }
      
      const newProfile = insertResult.rows[0];
      
      // Return the new profile with camelCase keys
      return res.json({
        id: newProfile.id,
        userId: newProfile.user_id,
        businessName: newProfile.business_name,
        description: newProfile.description,
        phoneNumber: newProfile.phone_number,
        trades: newProfile.trades || [],
        serviceRadius: newProfile.service_radius,
        hasLiabilityInsurance: newProfile.has_liability_insurance,
        walletBalance: parseFloat(newProfile.wallet_balance) || 0,
        averageRating: parseFloat(newProfile.average_rating) || 0,
        totalReviews: newProfile.total_reviews || 0,
        skills: newProfile.skills || [],
        bio: newProfile.bio,
        isNew: true
      });
    }
    
    // Profile exists, return it
    const profile = profileResult.rows[0];
    
    return res.json({
      id: profile.id,
      userId: profile.user_id,
      businessName: profile.business_name,
      description: profile.description,
      phoneNumber: profile.phone_number,
      website: profile.website,
      yearsOfExperience: profile.years_of_experience,
      licenseNumber: profile.license_number,
      insuranceProvider: profile.insurance_provider,
      insurancePolicyNumber: profile.insurance_policy_number,
      hasLiabilityInsurance: profile.has_liability_insurance,
      trades: profile.trades || [],
      serviceRadius: profile.service_radius,
      walletBalance: parseFloat(profile.wallet_balance) || 0,
      averageRating: parseFloat(profile.average_rating) || 0,
      totalReviews: profile.total_reviews || 0,
      skills: profile.skills || [],
      bio: profile.bio,
      isNew: false
    });
  } catch (error) {
    console.error('Error in contractor profile fix endpoint:', error);
    return res.status(500).json({
      message: 'Error processing contractor profile',
      error: String(error)
    });
  }
});

// Update endpoint
contractorProfileFixRouter.post('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Authentication check
    let authenticatedUserId = req.session?.userId;
    if (!authenticatedUserId && req.headers['x-user-id']) {
      authenticatedUserId = parseInt(req.headers['x-user-id'] as string);
    }
    
    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    if (authenticatedUserId !== userId) {
      return res.status(403).json({ message: 'You can only update your own profile' });
    }

    // Direct DB connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false }
    });

    // Check if profile exists
    const profileResult = await pool.query(`
      SELECT * FROM contractor_profiles WHERE user_id = $1
    `, [userId]);
    
    const updateData = req.body;
    console.log('Profile update data:', updateData);
    
    // If profile doesn't exist, create it first
    if (profileResult.rows.length === 0) {
      // Get user info
      const userResult = await pool.query(`
        SELECT * FROM users WHERE id = $1
      `, [userId]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const user = userResult.rows[0];
      
      // Create a basic profile
      const initialProfile = {
        businessName: updateData.businessName || `${user.full_name || user.username}'s Business`,
        description: updateData.description || 'Professional contractor services',
        phoneNumber: updateData.phoneNumber || user.phone,
        trades: updateData.trades || ['General Contractor'],
        serviceRadius: updateData.serviceRadius || 25,
        hasLiabilityInsurance: updateData.hasLiabilityInsurance || false,
        skills: updateData.skills || [],
        bio: updateData.bio || null
      };
      
      const insertResult = await pool.query(`
        INSERT INTO contractor_profiles (
          "user_id", "business_name", "description", "phone_number", "trades", 
          "service_radius", "has_liability_insurance", "skills", "bio",
          "wallet_balance", "average_rating", "total_reviews"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `, [
        userId,
        initialProfile.businessName,
        initialProfile.description,
        initialProfile.phoneNumber,
        initialProfile.trades,
        initialProfile.serviceRadius,
        initialProfile.hasLiabilityInsurance,
        initialProfile.skills,
        initialProfile.bio,
        0, // wallet_balance
        0, // average_rating
        0  // total_reviews
      ]);
      
      if (insertResult.rows.length === 0) {
        return res.status(500).json({ message: 'Failed to create contractor profile' });
      }
      
      const newProfile = insertResult.rows[0];
      
      return res.status(201).json({
        message: 'Contractor profile created successfully',
        profile: {
          id: newProfile.id,
          userId: newProfile.user_id,
          businessName: newProfile.business_name,
          description: newProfile.description,
          phoneNumber: newProfile.phone_number,
          trades: newProfile.trades || [],
          serviceRadius: newProfile.service_radius,
          hasLiabilityInsurance: newProfile.has_liability_insurance,
          walletBalance: parseFloat(newProfile.wallet_balance) || 0,
          averageRating: parseFloat(newProfile.average_rating) || 0,
          totalReviews: newProfile.total_reviews || 0,
          skills: newProfile.skills || [],
          bio: newProfile.bio
        },
        isNew: true
      });
    }
    
    // Profile exists, update it
    // Map camelCase keys to snake_case columns
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
    
    // Build update query
    const updates = [];
    const values = [userId]; // First parameter is userId
    let paramIndex = 2;
    
    for (const [key, value] of Object.entries(updateData)) {
      const dbField = fieldMappings[key];
      if (dbField) {
        updates.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (updates.length === 0) {
      // No fields to update, return the current profile
      const profile = profileResult.rows[0];
      
      return res.json({
        message: 'No changes to update',
        profile: {
          id: profile.id,
          userId: profile.user_id,
          businessName: profile.business_name,
          description: profile.description,
          phoneNumber: profile.phone_number,
          website: profile.website,
          yearsOfExperience: profile.years_of_experience,
          licenseNumber: profile.license_number,
          insuranceProvider: profile.insurance_provider,
          insurancePolicyNumber: profile.insurance_policy_number,
          hasLiabilityInsurance: profile.has_liability_insurance,
          trades: profile.trades || [],
          serviceRadius: profile.service_radius,
          walletBalance: parseFloat(profile.wallet_balance) || 0,
          averageRating: parseFloat(profile.average_rating) || 0,
          totalReviews: profile.total_reviews || 0,
          skills: profile.skills || [],
          bio: profile.bio
        }
      });
    }
    
    // Execute update
    const updateQuery = `
      UPDATE contractor_profiles 
      SET ${updates.join(', ')} 
      WHERE user_id = $1
      RETURNING *
    `;
    
    console.log('Update query:', updateQuery);
    console.log('Update values:', values);
    
    const updateResult = await pool.query(updateQuery, values);
    
    if (updateResult.rows.length === 0) {
      return res.status(500).json({ message: 'Failed to update contractor profile' });
    }
    
    const updatedProfile = updateResult.rows[0];
    
    return res.json({
      message: 'Contractor profile updated successfully',
      profile: {
        id: updatedProfile.id,
        userId: updatedProfile.user_id,
        businessName: updatedProfile.business_name,
        description: updatedProfile.description,
        phoneNumber: updatedProfile.phone_number,
        website: updatedProfile.website,
        yearsOfExperience: updatedProfile.years_of_experience,
        licenseNumber: updatedProfile.license_number,
        insuranceProvider: updatedProfile.insurance_provider,
        insurancePolicyNumber: updatedProfile.insurance_policy_number,
        hasLiabilityInsurance: updatedProfile.has_liability_insurance,
        trades: updatedProfile.trades || [],
        serviceRadius: updatedProfile.service_radius,
        walletBalance: parseFloat(updatedProfile.wallet_balance) || 0,
        averageRating: parseFloat(updatedProfile.average_rating) || 0,
        totalReviews: updatedProfile.total_reviews || 0,
        skills: updatedProfile.skills || [],
        bio: updatedProfile.bio
      }
    });
  } catch (error) {
    console.error('Error updating contractor profile:', error);
    return res.status(500).json({
      message: 'Error updating contractor profile',
      error: String(error)
    });
  }
});