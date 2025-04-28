/**
 * Create test users in Neon database
 * 
 * This script creates test users in the Neon database if none exist
 * to ensure there is user data available for login with the production version.
 */

import { db } from '../server/db.js';
import { authDb } from '../server/auth-db.js';
import { users, landlordProfiles, contractorProfiles } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { promisify } from 'util';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set up crypto helpers for password hashing
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function createTestUsers() {
  try {
    console.log('Checking for existing users in Neon database...');
    
    // Get all users from the database
    const existingUsers = await authDb.select().from(users);
    console.log(`Found ${existingUsers.length} existing users in database`);
    
    if (existingUsers.length === 0) {
      console.log('No users found. Creating test users...');
      
      // Create landlord test user
      const landlordPassword = await hashPassword('password123');
      const [landlordUser] = await authDb.insert(users).values({
        username: 'testlandlord',
        password: landlordPassword,
        email: 'landlord@example.com',
        fullName: 'Test Landlord',
        userType: 'landlord',
        phone: '555-123-4567',
        profilePicture: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      console.log(`Created landlord user: ${landlordUser.username} (${landlordUser.email})`);
      
      // Create landlord profile
      await authDb.insert(landlordProfiles).values({
        userId: landlordUser.id,
        bio: 'Test landlord profile',
        walletBalance: 1000,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`Created landlord profile for user ${landlordUser.id}`);
      
      // Create contractor test user
      const contractorPassword = await hashPassword('password123');
      const [contractorUser] = await authDb.insert(users).values({
        username: 'testcontractor',
        password: contractorPassword,
        email: 'contractor@example.com',
        fullName: 'Test Contractor',
        userType: 'contractor',
        phone: '555-987-6543',
        profilePicture: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      console.log(`Created contractor user: ${contractorUser.username} (${contractorUser.email})`);
      
      // Create contractor profile
      await authDb.insert(contractorProfiles).values({
        userId: contractorUser.id,
        bio: 'Test contractor profile',
        businessName: 'Test Contractor Services',
        website: 'https://testcontractor.example.com',
        yearsInBusiness: 5,
        employeeCount: 10,
        serviceRadius: 25,
        serviceArea: JSON.stringify({
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          coordinates: { lat: 40.7128, lng: -74.0060 }
        }),
        trades: JSON.stringify(['plumbing', 'electrical', 'general']),
        availability: JSON.stringify({
          monday: { available: true, startTime: '09:00', endTime: '17:00' },
          tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
          wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
          thursday: { available: true, startTime: '09:00', endTime: '17:00' },
          friday: { available: true, startTime: '09:00', endTime: '17:00' }
        }),
        walletBalance: 1000,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`Created contractor profile for user ${contractorUser.id}`);
      
      console.log('\nTest users created successfully:');
      console.log('Landlord: landlord@example.com / password123');
      console.log('Contractor: contractor@example.com / password123');
    } else {
      console.log('Users already exist in database. No need to create test users.');
      
      // Output an existing user for testing
      const testUser = existingUsers[0];
      console.log(`\nExisting user available for login:`);
      console.log(`Email: ${testUser.email}`);
      console.log(`Username: ${testUser.username}`);
      console.log('Note: Use the actual password for this user to log in');
    }
    
  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    process.exit(0);
  }
}

// Run the creation process
createTestUsers();