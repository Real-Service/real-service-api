import { authDb } from '../server/auth-db';
import * as schema from '../shared/schema';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';

config();

async function createTables() {
  try {
    console.log("Creating tables...");
    
    // First, create users table
    console.log("Creating users table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY,
        "username" varchar(255) NOT NULL,
        "password" text NOT NULL,
        "email" varchar(255) NOT NULL,
        "fullName" varchar(255),
        "userType" varchar(50) NOT NULL,
        "phone" varchar(20),
        "profilePicture" text,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create session table
    console.log("Creating session table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      )
    `);
    
    // Create password reset tokens table
    console.log("Creating password_reset_tokens table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" serial PRIMARY KEY,
        "userId" integer NOT NULL,
        "token" varchar(255) NOT NULL,
        "expiresAt" timestamp NOT NULL,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "used" boolean DEFAULT false
      )
    `);
    
    // Create landlord_profiles table
    console.log("Creating landlord_profiles table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "landlord_profiles" (
        "id" serial PRIMARY KEY,
        "userId" integer NOT NULL UNIQUE,
        "propertyCount" integer,
        "preferredPaymentMethods" jsonb,
        "verificationStatus" varchar(50),
        "billingInfo" jsonb,
        "propertyTypes" jsonb,
        "totalSpent" decimal(10,2) DEFAULT 0,
        "city" varchar(100),
        "state" varchar(100),
        "bio" text
      )
    `);
    
    // Create contractor_profiles table
    console.log("Creating contractor_profiles table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "contractor_profiles" (
        "id" serial PRIMARY KEY,
        "userId" integer NOT NULL UNIQUE,
        "businessName" varchar(255),
        "serviceArea" jsonb,
        "skills" jsonb,
        "walletBalance" decimal(10,2) DEFAULT 0,
        "averageRating" decimal(3,2),
        "totalRatings" integer DEFAULT 0,
        "background" text,
        "availability" jsonb,
        "serviceAreas" jsonb,
        "city" varchar(100),
        "state" varchar(100),
        "serviceRadius" integer,
        "serviceZipCodes" jsonb,
        "trades" jsonb,
        "experience" integer,
        "hourlyRate" decimal(10,2),
        "hasLiabilityInsurance" boolean DEFAULT false,
        "insuranceCoverage" decimal(12,2),
        "paymentMethods" jsonb,
        "warranty" text,
        "languages" jsonb,
        "portfolio" jsonb,
        "bio" text
      )
    `);
    
    // Create jobs table
    console.log("Creating jobs table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "jobs" (
        "id" serial PRIMARY KEY,
        "title" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "budget" decimal(10,2),
        "location" jsonb NOT NULL,
        "images" jsonb,
        "status" varchar(50) NOT NULL,
        "categoryTags" jsonb,
        "landlordId" integer NOT NULL,
        "contractorId" integer,
        "startDate" timestamp,
        "endDate" timestamp,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "estimatedDuration" varchar(50),
        "urgency" varchar(50),
        "requirements" text,
        "materialProvided" boolean,
        "propertyType" varchar(100),
        "propertyAccess" varchar(100),
        "scheduledDate" timestamp,
        "completionNotes" text,
        "hiddenNotes" text,
        "invoiceStatus" varchar(50),
        "featured" boolean DEFAULT false
      )
    `);
    
    // Create bids table
    console.log("Creating bids table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "bids" (
        "id" serial PRIMARY KEY,
        "jobId" integer NOT NULL,
        "contractorId" integer NOT NULL,
        "amount" decimal(10,2) NOT NULL,
        "proposal" text NOT NULL,
        "timeEstimate" varchar(50),
        "proposedStartDate" timestamp,
        "status" varchar(50) NOT NULL,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create reviews table
    console.log("Creating reviews table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" serial PRIMARY KEY,
        "jobId" integer NOT NULL,
        "reviewerId" integer NOT NULL,
        "revieweeId" integer NOT NULL,
        "rating" integer NOT NULL,
        "comment" text,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create transactions table
    console.log("Creating transactions table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" serial PRIMARY KEY,
        "amount" decimal(10,2) NOT NULL,
        "type" varchar(50) NOT NULL,
        "status" varchar(50) NOT NULL,
        "userId" integer NOT NULL,
        "jobId" integer,
        "description" text,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "paymentMethod" varchar(50),
        "transactionId" varchar(255),
        "paymentDetails" jsonb
      )
    `);
    
    // Create chat_rooms table
    console.log("Creating chat_rooms table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "chat_rooms" (
        "id" serial PRIMARY KEY,
        "name" varchar(255),
        "jobId" integer,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create chat_participants table
    console.log("Creating chat_participants table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "chat_participants" (
        "id" serial PRIMARY KEY,
        "chatRoomId" integer NOT NULL,
        "userId" integer NOT NULL,
        "joinedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "lastRead" timestamp
      )
    `);
    
    // Create messages table
    console.log("Creating messages table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" serial PRIMARY KEY,
        "chatRoomId" integer NOT NULL,
        "senderId" integer NOT NULL,
        "content" text NOT NULL,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "readBy" jsonb,
        "attachments" jsonb
      )
    `);
    
    // Create service_areas table
    console.log("Creating service_areas table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "service_areas" (
        "id" serial PRIMARY KEY,
        "contractorId" integer NOT NULL,
        "city" varchar(100) NOT NULL,
        "state" varchar(100) NOT NULL,
        "zipCode" varchar(20),
        "radius" integer,
        "latitude" decimal(10,6),
        "longitude" decimal(10,6),
        "isActive" boolean DEFAULT true,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create waitlist_entries table
    console.log("Creating waitlist_entries table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "waitlist_entries" (
        "id" serial PRIMARY KEY,
        "email" varchar(255) NOT NULL UNIQUE,
        "referralCode" varchar(50),
        "userType" varchar(50) NOT NULL,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "zipCode" varchar(20),
        "source" varchar(100)
      )
    `);
    
    // Create quotes table
    console.log("Creating quotes table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "quotes" (
        "id" serial PRIMARY KEY,
        "title" varchar(255) NOT NULL,
        "landlordId" integer NOT NULL,
        "contractorId" integer NOT NULL,
        "jobId" integer NOT NULL,
        "total" decimal(10,2) NOT NULL,
        "subtotal" decimal(10,2) NOT NULL,
        "status" varchar(50) DEFAULT 'draft',
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "quoteNumber" varchar(50) NOT NULL,
        "notes" text,
        "terms" text,
        "depositRequired" boolean DEFAULT false,
        "depositAmount" decimal(10,2),
        "discountAmount" decimal(10,2),
        "taxRate" decimal(5,2),
        "taxAmount" decimal(10,2),
        "validUntil" timestamp,
        "sentAt" timestamp,
        "viewedAt" timestamp
      )
    `);
    
    // Create quote_line_items table
    console.log("Creating quote_line_items table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "quote_line_items" (
        "id" serial PRIMARY KEY,
        "quoteId" integer NOT NULL,
        "description" text NOT NULL,
        "quantity" integer,
        "unitPrice" decimal(10,2) NOT NULL,
        "total" decimal(10,2) NOT NULL,
        "sortOrder" integer,
        "itemType" varchar(50) DEFAULT 'service',
        "estimatedHours" decimal(5,2)
      )
    `);
    
    // Create invoices table
    console.log("Creating invoices table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" serial PRIMARY KEY,
        "title" varchar(255) NOT NULL,
        "landlordId" integer NOT NULL,
        "contractorId" integer NOT NULL,
        "jobId" integer NOT NULL,
        "total" decimal(10,2) NOT NULL,
        "subtotal" decimal(10,2) NOT NULL,
        "status" varchar(50) DEFAULT 'draft',
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "invoiceNumber" varchar(50) NOT NULL,
        "notes" text,
        "terms" text,
        "taxRate" decimal(5,2),
        "taxAmount" decimal(10,2),
        "amountPaid" decimal(10,2) DEFAULT 0,
        "dueDate" timestamp,
        "sentAt" timestamp,
        "viewedAt" timestamp,
        "paidAt" timestamp,
        "paymentMethod" varchar(50),
        "paymentDetails" text
      )
    `);
    
    // Create invoice_line_items table
    console.log("Creating invoice_line_items table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "invoice_line_items" (
        "id" serial PRIMARY KEY,
        "invoiceId" integer NOT NULL,
        "description" text NOT NULL,
        "quantity" integer,
        "unitPrice" decimal(10,2) NOT NULL,
        "total" decimal(10,2) NOT NULL,
        "sortOrder" integer
      )
    `);
    
    // Create time_slots table
    console.log("Creating time_slots table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "time_slots" (
        "id" serial PRIMARY KEY,
        "contractorId" integer NOT NULL,
        "date" date NOT NULL,
        "startTime" time NOT NULL,
        "endTime" time NOT NULL,
        "status" varchar(50) DEFAULT 'available',
        "jobId" integer,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "note" text
      )
    `);
    
    // Create job_schedules table
    console.log("Creating job_schedules table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "job_schedules" (
        "id" serial PRIMARY KEY,
        "jobId" integer NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date,
        "startTime" time,
        "endTime" time,
        "isAllDay" boolean DEFAULT false,
        "status" varchar(50) DEFAULT 'scheduled',
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "note" text
      )
    `);
    
    // Create job_dependencies table
    console.log("Creating job_dependencies table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "job_dependencies" (
        "id" serial PRIMARY KEY,
        "jobId" integer NOT NULL,
        "dependsOnJobId" integer NOT NULL,
        "dependencyType" varchar(50) DEFAULT 'finish-to-start',
        "delayDays" integer DEFAULT 0,
        "isRequired" boolean DEFAULT true,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "note" text
      )
    `);
    
    // Create job_templates table
    console.log("Creating job_templates table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "job_templates" (
        "id" serial PRIMARY KEY,
        "contractorId" integer NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "categoryTags" jsonb,
        "estimatedDuration" varchar(50),
        "estimatedBudget" decimal(10,2),
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create job_template_tasks table
    console.log("Creating job_template_tasks table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "job_template_tasks" (
        "id" serial PRIMARY KEY,
        "templateId" integer NOT NULL,
        "description" text NOT NULL,
        "estimatedHours" decimal(5,2),
        "sortOrder" integer
      )
    `);
    
    // Create job_template_materials table
    console.log("Creating job_template_materials table...");
    await authDb.execute(sql`
      CREATE TABLE IF NOT EXISTS "job_template_materials" (
        "id" serial PRIMARY KEY,
        "templateId" integer NOT NULL,
        "description" text NOT NULL,
        "quantity" integer,
        "unitPrice" decimal(10,2),
        "sortOrder" integer
      )
    `);
    
    console.log("All tables created successfully!");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    process.exit(0);
  }
}

createTables();