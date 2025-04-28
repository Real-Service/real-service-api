/**
 * Shared types for use across frontend and backend
 */

import { z } from 'zod';
import { 
  coordinateSchema,
  jobStatusEnum, 
  jobPricingTypeEnum, 
  bidStatusEnum, 
  quoteStatusEnum, 
  invoiceStatusEnum, 
  paymentMethodEnum,
  messageTypeEnum,
  scheduleStatusEnum,
  timeSlotStatusEnum,
  jobDependencyTypeEnum
} from './schema';

// Create Zod enums from Drizzle pgEnums
const jobStatusZodEnum = z.enum(['draft', 'open', 'in_progress', 'completed', 'cancelled']);
const jobPricingTypeZodEnum = z.enum(['fixed', 'open_bid']);
const bidStatusZodEnum = z.enum(['pending', 'accepted', 'rejected']);
const quoteStatusZodEnum = z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'revised']);
const invoiceStatusZodEnum = z.enum(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']);
const paymentMethodZodEnum = z.enum(['cash', 'check', 'credit_card', 'bank_transfer', 'paypal', 'venmo', 'other']);
const messageTypeZodEnum = z.enum(['text', 'image']);
const scheduleStatusZodEnum = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']);
const timeSlotStatusZodEnum = z.enum(['available', 'booked', 'unavailable']);
const jobDependencyTypeZodEnum = z.enum(['sequential', 'can_start_together', 'must_finish_before']);

// API response interfaces
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// User types
export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  userType: 'landlord' | 'contractor';
  phone?: string | null;
  profilePicture?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LandlordProfile {
  id: number;
  userId: number;
  bio?: string | null;
  walletBalance: number;
  averageRating?: number | null;
  totalRatings: number;
  properties: any[];
}

export interface ServiceArea {
  id: number;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface ContractorProfile {
  id: number;
  userId: number;
  bio?: string | null;
  skills: string[];
  serviceArea: {
    latitude: number;
    longitude: number;
  };
  walletBalance: number;
  averageRating?: number | null;
  totalRatings: number;
  background?: string | null;
  availability?: string | null;
  city?: string | null;
  state?: string | null;
  serviceRadius: number;
  serviceZipCodes: string[];
  trades: string[];
  experience?: string | null;
  hourlyRate?: number | null;
  hasLiabilityInsurance: boolean;
  insuranceCoverage?: string | null;
  paymentMethods: string[];
  warranty?: string | null;
  languages: string[];
  portfolio: string[];
  serviceAreas: ServiceArea[];
}

// Location type (used in jobs)
export interface JobLocation {
  address?: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude: number;
  longitude: number;
}

// Job and bid types
export interface Job {
  id: number;
  title: string;
  description: string;
  landlordId: number;
  status: z.infer<typeof jobStatusZodEnum>;
  pricingType: z.infer<typeof jobPricingTypeZodEnum>;
  budget?: number | null;
  location: JobLocation;
  categoryTags: string[];
  isUrgent: boolean;
  deadline?: string | null;
  images: string[];
  startDate?: Date | null;
  completionDate?: Date | null;
  progress?: number | null;
  createdAt: Date;
  updatedAt: Date;
  contractorId?: number | null;
}

export interface ExtendedJob extends Job {
  chatRoomId?: number;
  landlordName?: string;
  category?: string; // Sometimes added for image fallbacks
}

export interface JobWithContractor extends Job {
  contractor?: User;
}

export interface JobWithLandlord extends Job {
  landlord: User;
}

export interface Bid {
  id: number;
  jobId: number;
  contractorId: number;
  amount: number;
  proposal: string;
  timeEstimate?: string | null;
  proposedStartDate?: Date | null;
  status: z.infer<typeof bidStatusZodEnum>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BidWithJob extends Bid {
  job: Job;
}

export interface BidWithContractor extends Bid {
  contractor: User;
}

// Quote and invoice types
export interface QuoteLineItem {
  id: number;
  quoteId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quote {
  id: number;
  jobId: number;
  contractorId: number;
  landlordId: number;
  quoteNumber: string;
  title: string;
  status: z.infer<typeof quoteStatusZodEnum>;
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  termsAndConditions?: string | null;
  discount?: number;
  tax?: number;
  preferredStartDate?: Date | null;
  estimatedDuration?: number;
  validUntil?: Date | null;
  acceptedAt?: Date | null;
  rejectedAt?: Date | null;
  viewedAt?: Date | null;
  paymentMethods: string[];
  createdAt: Date;
  updatedAt: Date;
  lineItems?: QuoteLineItem[];
  job?: Job;
  contractor?: User;
  landlord?: User;
}

export interface InvoiceLineItem {
  id: number;
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: number;
  jobId: number;
  quoteId?: number | null;
  contractorId: number;
  landlordId: number;
  invoiceNumber: string;
  title: string;
  status: z.infer<typeof invoiceStatusZodEnum>;
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  amountPaid?: number;
  notes?: string | null;
  terms?: string | null;
  dueDate?: Date | null;
  issuedDate: Date;
  paidDate?: Date | null;
  paymentMethod?: z.infer<typeof paymentMethodZodEnum> | null;
  paymentDetails?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems?: InvoiceLineItem[];
  job?: Job;
  quote?: Quote;
  contractor?: User;
  landlord?: User;
}

// Chat and messaging types
export interface ChatRoom {
  id: number;
  jobId?: number | null;
  createdAt: Date;
  participants?: ChatParticipant[];
  messages?: Message[];
}

export interface ChatParticipant {
  id: number;
  chatRoomId: number;
  userId: number;
  lastRead: Date;
  user?: User;
}

export interface Message {
  id: number;
  chatRoomId: number;
  senderId: number;
  content: string;
  type: z.infer<typeof messageTypeZodEnum>;
  createdAt: Date;
  sender?: User;
}

// Rating and review types
export interface Review {
  id: number;
  jobId: number;
  reviewerId: number;
  revieweeId: number;
  rating: number;
  comment?: string | null;
  createdAt: Date;
  reviewer?: User;
  reviewee?: User;
  job?: Job;
}

// Calendar and availability types
export interface TimeSlot {
  id: number;
  contractorId: number;
  date: Date;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isAvailable: boolean;
  note?: string | null;
}

export interface JobSchedule {
  id: number;
  jobId: number;
  startDate: Date;
  endDate: Date;
  startTime?: string | null; // HH:MM format
  endTime?: string | null; // HH:MM format
  isAllDay: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  note?: string | null;
}

// Multi-trade job dependency types
export interface JobDependency {
  id: number;
  jobId: number;
  dependsOnJobId: number;
  delayDays: number; // Days after dependent job completes
  isRequired: boolean;
  note?: string | null;
}

// Job template types
export interface JobTemplate {
  id: number;
  contractorId: number;
  title: string;
  description: string;
  categoryTags: string[];
  estimatedDuration: number;
  estimatedBudget?: number | null;
  tasks: JobTemplateTask[];
  materials: JobTemplateMaterial[];
  createdAt: Date;
  updatedAt: Date;
}

export interface JobTemplateTask {
  id: number;
  templateId: number;
  description: string;
  estimatedHours: number;
  sortOrder: number;
}

export interface JobTemplateMaterial {
  id: number;
  templateId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
}

// App settings types
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  defaultViewMode: 'grid' | 'table' | 'map' | 'calendar' | 'split';
  defaultCurrency: string;
  language: string;
}