import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define coordinate type for maps
export const coordinateSchema = z.object({
  longitude: z.number(),
  latitude: z.number()
});

// Enums
// 'landlord' = Service Requestor, 'contractor' = Service Provider
export const userTypeEnum = pgEnum('user_type', ['landlord', 'contractor']);
export const jobStatusEnum = pgEnum('job_status', ['draft', 'open', 'in_progress', 'completed', 'cancelled']);
export const jobPricingTypeEnum = pgEnum('job_pricing_type', ['fixed', 'open_bid']);
export const bidStatusEnum = pgEnum('bid_status', ['pending', 'accepted', 'rejected']);
export const transactionTypeEnum = pgEnum('transaction_type', ['deposit', 'withdrawal', 'payment', 'refund']);
export const messageTypeEnum = pgEnum('message_type', ['text', 'image']);

// New enums for quotes and invoices
export const quoteStatusEnum = pgEnum('quote_status', ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'revised']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'check', 'credit_card', 'bank_transfer', 'paypal', 'venmo', 'other']);

// New enums for calendar and scheduling
export const scheduleStatusEnum = pgEnum('schedule_status', ['scheduled', 'in_progress', 'completed', 'cancelled']);
export const timeSlotStatusEnum = pgEnum('time_slot_status', ['available', 'booked', 'unavailable']);
export const jobDependencyTypeEnum = pgEnum('job_dependency_type', ['sequential', 'can_start_together', 'must_finish_before']);

// Users table - base user information
// NOTE: All database tables in production use snake_case column names
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(), // Using snake_case column name to match DB
  userType: userTypeEnum("user_type").notNull(), // Using snake_case column name to match DB
  phone: text("phone"),
  profilePicture: text("profile_picture"), // Using snake_case column name to match DB
  createdAt: timestamp("created_at").defaultNow().notNull(), // Using snake_case column name to match DB
  updatedAt: timestamp("updated_at").defaultNow().notNull() // Using snake_case column name to match DB
});

// Profile tables for the two user types
export const landlordProfiles = pgTable("landlord_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  bio: text("bio"),
  walletBalance: doublePrecision("walletBalance").notNull().default(0),
  averageRating: doublePrecision("averageRating"),
  totalRatings: integer("totalRatings").notNull().default(0),
  properties: json("properties").default([]),
});

// This schema must match the actual table structure in the database
// Column names here must exactly match the database columns (snake_case)
export const contractorProfiles = pgTable("contractor_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  businessName: text("business_name"),
  description: text("description"),
  phoneNumber: text("phone_number"),
  website: text("website"),
  yearsOfExperience: integer("years_of_experience"),
  licenseNumber: text("license_number"),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  hasLiabilityInsurance: boolean("has_liability_insurance").default(false),
  trades: json("trades").default([]),
  serviceRadius: text("service_radius"),
  walletBalance: text("wallet_balance").notNull().default('0'),
  averageRating: text("average_rating"),
  totalReviews: integer("total_reviews").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Add the missing fields that exist in the database
  skills: json("skills").default([]),
  bio: text("bio"),
});

// Jobs and bidding
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  landlordId: integer("landlordId").notNull().references(() => users.id),
  status: jobStatusEnum("status").notNull().default("draft"),
  pricingType: jobPricingTypeEnum("pricingType").notNull().default("fixed"),
  budget: doublePrecision("budget"),
  // Remove fields that don't exist in DB
  location: json("location").notNull(), // Stores the combined location details including category
  categoryTags: json("categoryTags").default([]),
  isUrgent: boolean("isUrgent").default(false),
  deadline: text("deadline"),
  images: json("images").default([]),
  startDate: timestamp("startDate"),
  completionDate: timestamp("completionDate"),
  progress: integer("progress").default(0),  // Progress percentage from 0-100
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  contractorId: integer("contractorId").references(() => users.id),
});

export const bids = pgTable("bids", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  contractorId: integer("contractorId").notNull().references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  proposal: text("proposal").notNull(),
  timeEstimate: text("timeEstimate"),
  proposedStartDate: timestamp("proposedStartDate"),
  status: bidStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Payments and transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  fee: doublePrecision("fee").notNull(),
  type: transactionTypeEnum("type").notNull(),
  status: text("status").notNull(),
  reference: text("reference"),
  jobId: integer("jobId").references(() => jobs.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  description: text("description"),
});

// Chat/Messaging
export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id), // Using snake_case column name for production DB compatibility
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatParticipants = pgTable("chat_participants", {
  id: serial("id").primaryKey(),
  chatRoomId: integer("chatRoomId").notNull().references(() => chatRooms.id),
  userId: integer("userId").notNull().references(() => users.id),
  lastRead: timestamp("lastRead").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatRoomId: integer("chatRoomId").notNull().references(() => chatRooms.id),
  senderId: integer("senderId").notNull().references(() => users.id),
  content: text("content").notNull(),
  type: messageTypeEnum("type").notNull().default("text"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Ratings and Reviews
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  reviewerId: integer("reviewerId").notNull().references(() => users.id),
  revieweeId: integer("revieweeId").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Waitlist entries (kept for backward compatibility)
export const waitlistEntries = pgTable("waitlist_entries", {
  id: serial("id").primaryKey(),
  fullName: text("fullName").notNull(),
  email: text("email").notNull().unique(),
  userType: text("userType").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  usedAt: timestamp("usedAt"),
});

// Quote line items - individual components of a quote
export const quoteLineItems = pgTable("quote_line_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quoteId").notNull(),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity").notNull().default(1),
  unitPrice: doublePrecision("unitPrice").notNull(),
  total: doublePrecision("total").notNull(),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Quotes - detailed quotes created by contractors
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  contractorId: integer("contractorId").notNull().references(() => users.id),
  landlordId: integer("landlordId").notNull().references(() => users.id),
  quoteNumber: text("quoteNumber").notNull().unique(),
  title: text("title").notNull(),
  status: quoteStatusEnum("status").notNull().default("draft"),
  subtotal: doublePrecision("subtotal").notNull(),
  taxRate: doublePrecision("taxRate").default(0),
  taxAmount: doublePrecision("taxAmount").default(0),
  total: doublePrecision("total").notNull(),
  notes: text("notes"),
  terms: text("terms"),
  termsAndConditions: text("termsAndConditions"),
  discount: doublePrecision("discount").default(0),
  tax: doublePrecision("tax").default(0),
  preferredStartDate: timestamp("preferredStartDate"),
  estimatedDuration: integer("estimatedDuration").default(1),
  validUntil: timestamp("validUntil"),
  acceptedAt: timestamp("acceptedAt"),
  rejectedAt: timestamp("rejectedAt"),
  viewedAt: timestamp("viewedAt"),
  paymentMethods: json("paymentMethods").default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Invoice line items - individual components of an invoice
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoiceId").notNull(),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity").notNull().default(1),
  unitPrice: doublePrecision("unitPrice").notNull(),
  total: doublePrecision("total").notNull(),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Invoices - final billing documents 
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  quoteId: integer("quoteId").references(() => quotes.id),
  contractorId: integer("contractorId").notNull().references(() => users.id),
  landlordId: integer("landlordId").notNull().references(() => users.id),
  invoiceNumber: text("invoiceNumber").notNull().unique(),
  title: text("title").notNull(), 
  status: invoiceStatusEnum("status").notNull().default("draft"),
  subtotal: doublePrecision("subtotal").notNull(),
  taxRate: doublePrecision("taxRate").default(0),
  taxAmount: doublePrecision("taxAmount").default(0),
  total: doublePrecision("total").notNull(),
  amountPaid: doublePrecision("amountPaid").default(0),
  notes: text("notes"),
  terms: text("terms"),
  dueDate: timestamp("dueDate"),
  issuedDate: timestamp("issuedDate").defaultNow().notNull(),
  paidDate: timestamp("paidDate"),
  paymentMethod: paymentMethodEnum("paymentMethod"),
  paymentDetails: text("paymentDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Calendar and scheduling tables
export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  contractorId: integer("contractorId").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  startTime: text("startTime").notNull(), // "HH:MM" format
  endTime: text("endTime").notNull(), // "HH:MM" format
  status: timeSlotStatusEnum("status").notNull().default("available"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const jobSchedules = pgTable("job_schedules", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  startTime: text("startTime"), // "HH:MM" format
  endTime: text("endTime"), // "HH:MM" format
  isAllDay: boolean("isAllDay").default(false),
  status: scheduleStatusEnum("status").notNull().default("scheduled"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Multi-trade job dependencies
export const jobDependencies = pgTable("job_dependencies", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  dependsOnJobId: integer("dependsOnJobId").notNull().references(() => jobs.id),
  dependencyType: jobDependencyTypeEnum("dependencyType").notNull().default("sequential"),
  delayDays: integer("delayDays").default(0), // Days after dependent job completes
  isRequired: boolean("isRequired").default(true),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Job templates
export const jobTemplates = pgTable("job_templates", {
  id: serial("id").primaryKey(),
  contractorId: integer("contractorId").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryTags: json("categoryTags").default([]),
  estimatedDuration: integer("estimatedDuration").notNull().default(1), // In days
  estimatedBudget: doublePrecision("estimatedBudget"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const jobTemplateTasks = pgTable("job_template_tasks", {
  id: serial("id").primaryKey(),
  templateId: integer("templateId").notNull().references(() => jobTemplates.id),
  description: text("description").notNull(),
  estimatedHours: doublePrecision("estimatedHours").notNull(),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const jobTemplateMaterials = pgTable("job_template_materials", {
  id: serial("id").primaryKey(),
  templateId: integer("templateId").notNull().references(() => jobTemplates.id),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity").notNull().default(1),
  unitPrice: doublePrecision("unitPrice").notNull(),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true, 
  fullName: true,
  userType: true,
  phone: true,
  profilePicture: true,
});

export const insertLandlordProfileSchema = createInsertSchema(landlordProfiles).pick({
  userId: true,
  bio: true,
  properties: true,
});

export const insertContractorProfileSchema = createInsertSchema(contractorProfiles).pick({
  userId: true,
  bio: true,
  skills: true,
  serviceArea: true,
  background: true,
  availability: true,
  city: true,
  state: true,
  serviceRadius: true,
  serviceZipCodes: true,
  // New fields
  trades: true,
  experience: true,
  hourlyRate: true,
  hasLiabilityInsurance: true,
  insuranceCoverage: true,
  paymentMethods: true,
  warranty: true,
  languages: true,
  portfolio: true,
  serviceAreas: true,
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  title: true,
  description: true,
  landlordId: true,
  pricingType: true,
  budget: true,
  location: true,
  categoryTags: true,
  isUrgent: true,
  deadline: true,
  images: true,
  startDate: true,
});

export const insertBidSchema = createInsertSchema(bids).pick({
  jobId: true,
  contractorId: true,
  amount: true,
  proposal: true,
  timeEstimate: true,
  proposedStartDate: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  userId: true,
  amount: true,
  fee: true,
  type: true,
  status: true,
  reference: true,
  jobId: true,
  description: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  chatRoomId: true,
  senderId: true,
  content: true,
  type: true,
});

export const insertReviewSchema = createInsertSchema(reviews).pick({
  jobId: true,
  reviewerId: true,
  revieweeId: true,
  rating: true,
  comment: true,
});

export const insertWaitlistSchema = createInsertSchema(waitlistEntries).pick({
  fullName: true,
  email: true,
  userType: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).pick({
  userId: true,
  token: true,
  expiresAt: true,
});

export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItems).pick({
  quoteId: true,
  description: true,
  quantity: true,
  unitPrice: true,
  total: true,
  sortOrder: true,
});

export const insertQuoteSchema = createInsertSchema(quotes).pick({
  jobId: true,
  contractorId: true,
  landlordId: true,
  quoteNumber: true,
  title: true,
  status: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  total: true,
  notes: true,
  terms: true,
  termsAndConditions: true,
  discount: true,
  tax: true,
  preferredStartDate: true,
  estimatedDuration: true,
  validUntil: true,
  paymentMethods: true,
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).pick({
  invoiceId: true,
  description: true,
  quantity: true,
  unitPrice: true,
  total: true,
  sortOrder: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).pick({
  jobId: true,
  quoteId: true,
  contractorId: true,
  landlordId: true,
  invoiceNumber: true,
  title: true,
  status: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  total: true,
  notes: true,
  terms: true,
  dueDate: true,
  issuedDate: true,
  paymentMethod: true,
  paymentDetails: true,
});

// New insert schemas for calendar and scheduling
export const insertTimeSlotSchema = createInsertSchema(timeSlots).pick({
  contractorId: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  note: true,
});

export const insertJobScheduleSchema = createInsertSchema(jobSchedules).pick({
  jobId: true,
  startDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  isAllDay: true,
  status: true,
  note: true,
});

export const insertJobDependencySchema = createInsertSchema(jobDependencies).pick({
  jobId: true,
  dependsOnJobId: true,
  dependencyType: true,
  delayDays: true,
  isRequired: true,
  note: true,
});

// Job templates insert schemas
export const insertJobTemplateSchema = createInsertSchema(jobTemplates).pick({
  contractorId: true,
  title: true,
  description: true,
  categoryTags: true,
  estimatedDuration: true,
  estimatedBudget: true,
});

export const insertJobTemplateTaskSchema = createInsertSchema(jobTemplateTasks).pick({
  templateId: true,
  description: true,
  estimatedHours: true,
  sortOrder: true,
});

export const insertJobTemplateMaterialSchema = createInsertSchema(jobTemplateMaterials).pick({
  templateId: true,
  description: true,
  quantity: true,
  unitPrice: true,
  sortOrder: true,
});

// Validation schemas
export const loginSchema = z.object({
  email: z.string().min(1, { message: "Username or email is required" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

// Password reset schemas
export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: "Reset token is required" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const registerSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
  // "landlord" = Service Requestor, "contractor" = Service Provider
  userType: z.enum(["landlord", "contractor"], { 
    errorMap: () => ({ message: "Please select a valid user type" })
  }),
  phone: z.string().optional(),
  profilePicture: z.string().optional(),
});

export const jobSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().min(5, { message: "Description must be at least 5 characters" }),
  pricingType: z.enum(["fixed", "open_bid"], {
    errorMap: () => ({ message: "Please select a valid pricing type" })
  }).default("fixed"),
  budget: z.coerce.number().optional().nullable(),
  address: z.string().min(1, { message: "Please enter a valid address" }),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zipCode: z.string().optional().default(""),
  isUrgent: z.boolean().default(false),
  categoryTags: z.array(z.string()).optional(),
  category: z.string().min(2, { message: "Please select a category" }),
  images: z.array(z.string()).optional(),
  startDate: z.string().optional().nullable(),
  progress: z.number().min(0).max(100).optional(),
  landlordId: z.number().optional(),
});

export const bidSchema = z.object({
  amount: z.number().positive({ message: "Bid amount must be positive" }),
  proposal: z.string().min(20, { message: "Proposal must be at least 20 characters" }),
  timeEstimate: z.string().optional(),
  proposedStartDate: z.string().transform(str => new Date(str)).optional(),
});

export const quoteFormSchema = z.object({
  title: z.string(),
  jobId: z.number().nullable(),
  landlordId: z.number(),
  contractorId: z.number(),
  validUntil: z.date().nullable(),
  subtotal: z.number().default(0),
  discount: z.number().default(0),
  tax: z.number().default(0),
  total: z.number().default(0),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired", "invoiced"]).default("draft"),
  lineItems: z.array(
    z.object({
      id: z.number().optional(),
      description: z.string(),
      quantity: z.number().default(1),
      unitPrice: z.number().default(0),
      total: z.number().default(0),
      sortOrder: z.number().optional(),
    })
  ),
  preferredStartDate: z.date().optional().nullable(),
  estimatedDuration: z.number().default(1).optional(),
  paymentMethods: z.array(z.string()).default(["cash"]),
  quoteNumber: z.string().optional(),
});

export const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

export const waitlistSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  // "landlord" = Service Requestor, "contractor" = Service Provider
  userType: z.enum(["landlord", "contractor", "both"], { 
    errorMap: () => ({ message: "Please select a valid user type" })
  }),
});

// Landlord profile validation schema
export const landlordProfileSchema = z.object({
  bio: z.string().optional(),
});

// Service area schema (for multiple locations)
export const serviceAreaSchema = z.object({
  id: z.number(),
  city: z.string(),
  state: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radius: z.number(),
});

// Contractor profile validation schema
export const contractorProfileSchema = z.object({
  bio: z.string().min(10, { message: "Bio must be at least 10 characters" }).optional(),
  skills: z.array(z.string()).optional(),
  background: z.string().optional(),
  availability: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  serviceRadius: z.number().min(0).max(100).optional(),
  serviceZipCodes: z.array(z.string()).optional(),
  trades: z.array(z.string()).optional(),
  experience: z.string().optional(),
  hourlyRate: z.number().positive().optional(),
  hasLiabilityInsurance: z.boolean().optional(),
  insuranceCoverage: z.string().optional(),
  paymentMethods: z.array(z.string()).optional(),
  warranty: z.string().optional(),
  languages: z.array(z.string()).optional(),
  portfolio: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    imageUrl: z.string(),
  })).optional(),
  serviceAreas: z.array(serviceAreaSchema).optional(),
});

// Quote line item schema
export const quoteLineItemSchema = z.object({
  quoteId: z.number().optional(), // Optional when creating a new quote
  description: z.string().min(1, { message: "Description is required" }),
  quantity: z.number().min(1, { message: "Quantity must be at least 1" }),
  unitPrice: z.number().min(0, { message: "Price cannot be negative" }),
  amount: z.number().min(0, { message: "Amount cannot be negative" }).optional(),
  total: z.number().min(0, { message: "Total cannot be negative" }),
  sortOrder: z.number().optional(),
});

// Quote API schema for server validation
export const quoteApiSchema = z.object({
  jobId: z.number().nullable(),
  contractorId: z.number(),
  landlordId: z.number(),
  quoteNumber: z.string().optional(), // System-generated if not provided
  title: z.string(), // Allow empty string for drafts
  subtotal: z.number().min(0, { message: "Subtotal must be at least 0" }),
  taxRate: z.number().min(0).max(100).default(0).optional(),
  taxAmount: z.number().min(0).default(0).optional(),
  total: z.number().min(0, { message: "Total must be at least 0" }),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  preferredStartDate: z.union([
    z.string().transform(str => new Date(str)),
    z.null()
  ]).optional(),
  estimatedDuration: z.number().min(0).default(1),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  validUntil: z.union([
    z.string().transform(str => new Date(str)),
    z.date(),
    z.null()
  ]).optional(),
  paymentMethods: z.array(z.string()).default(["cash"]),
  lineItems: z.array(z.object({
    id: z.number().optional(),
    description: z.string(), // Allow empty for drafts
    quantity: z.number().default(1),
    unitPrice: z.number().default(0),
    total: z.number().default(0),
    sortOrder: z.number().optional(),
  }))
});

// Invoice line item schema
export const invoiceLineItemSchema = z.object({
  invoiceId: z.number().optional(), // Optional when creating a new invoice
  description: z.string().min(3, { message: "Description must be at least 3 characters" }),
  quantity: z.number().positive({ message: "Quantity must be positive" }),
  unitPrice: z.number().positive({ message: "Price must be positive" }),
  total: z.number().positive({ message: "Total must be positive" }),
  sortOrder: z.number().optional(),
});

// Invoice schema
export const invoiceSchema = z.object({
  jobId: z.number(),
  quoteId: z.number().optional(), // Optional if not created from a quote
  contractorId: z.number(),
  landlordId: z.number(),
  invoiceNumber: z.string().optional(), // System-generated if not provided 
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  subtotal: z.number().positive({ message: "Subtotal must be positive" }),
  taxRate: z.number().min(0).max(100).default(0),
  taxAmount: z.number().min(0).default(0),
  total: z.number().positive({ message: "Total must be positive" }),
  amountPaid: z.number().min(0).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  dueDate: z.string().transform(str => new Date(str)).optional(),
  issuedDate: z.string().transform(str => new Date(str)).optional(),
  paymentMethod: z.enum(["cash", "check", "credit_card", "bank_transfer", "paypal", "venmo", "other"]).optional(),
  paymentDetails: z.string().optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1, { message: "At least one line item is required" }),
});

// Calendar and scheduling schemas
export const timeSlotSchema = z.object({
  contractorId: z.number(),
  date: z.string().transform(str => new Date(str)),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { message: "Start time must be in HH:MM format" }),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { message: "End time must be in HH:MM format" }),
  status: z.enum(["available", "booked", "unavailable"]).default("available"),
  note: z.string().optional(),
});

export const jobScheduleSchema = z.object({
  jobId: z.number(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { message: "Start time must be in HH:MM format" }).optional(),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { message: "End time must be in HH:MM format" }).optional(),
  isAllDay: z.boolean().default(false),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
  note: z.string().optional(),
});

export const jobDependencySchema = z.object({
  jobId: z.number(),
  dependsOnJobId: z.number(),
  dependencyType: z.enum(["sequential", "can_start_together", "must_finish_before"]).default("sequential"),
  delayDays: z.number().min(0).default(0),
  isRequired: z.boolean().default(true),
  note: z.string().optional(),
});

// Job template schemas
export const jobTemplateSchema = z.object({
  contractorId: z.number(),
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  categoryTags: z.array(z.string()).min(1, { message: "At least one category tag is required" }),
  estimatedDuration: z.number().min(1, { message: "Duration must be at least 1 day" }).default(1),
  estimatedBudget: z.number().positive({ message: "Budget must be positive" }).optional(),
  tasks: z.array(z.object({
    description: z.string().min(3, { message: "Description must be at least 3 characters" }),
    estimatedHours: z.number().positive({ message: "Hours must be positive" }),
    sortOrder: z.number().default(0),
  })).optional(),
  materials: z.array(z.object({
    description: z.string().min(3, { message: "Description must be at least 3 characters" }),
    quantity: z.number().positive({ message: "Quantity must be positive" }),
    unitPrice: z.number().positive({ message: "Price must be positive" }),
    sortOrder: z.number().default(0),
  })).optional(),
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertLandlordProfile = z.infer<typeof insertLandlordProfileSchema>;
export type LandlordProfile = typeof landlordProfiles.$inferSelect;

export type InsertContractorProfile = z.infer<typeof insertContractorProfileSchema>;
export type ContractorProfile = typeof contractorProfiles.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Extended Job type that includes synthetic bidCount property returned by the API
export interface JobLocation {
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  zipCode?: string;
  [key: string]: any; // For backward compatibility with existing data
}

export interface ExtendedJob extends Job {
  bidCount?: number;
  location: JobLocation;
}

export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bids.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export type InsertWaitlistEntry = z.infer<typeof insertWaitlistSchema>;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export type InsertQuoteLineItem = z.infer<typeof insertQuoteLineItemSchema>;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// New type exports for calendar and scheduling
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;
export type TimeSlot = typeof timeSlots.$inferSelect;

export type InsertJobSchedule = z.infer<typeof insertJobScheduleSchema>;
export type JobSchedule = typeof jobSchedules.$inferSelect;

export type InsertJobDependency = z.infer<typeof insertJobDependencySchema>;
export type JobDependency = typeof jobDependencies.$inferSelect;

// Job template types exports
export type InsertJobTemplate = z.infer<typeof insertJobTemplateSchema>;
export type JobTemplate = typeof jobTemplates.$inferSelect;

export type InsertJobTemplateTask = z.infer<typeof insertJobTemplateTaskSchema>;
export type JobTemplateTask = typeof jobTemplateTasks.$inferSelect;

export type InsertJobTemplateMaterial = z.infer<typeof insertJobTemplateMaterialSchema>;
export type JobTemplateMaterial = typeof jobTemplateMaterials.$inferSelect;
