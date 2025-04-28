# Architecture Overview

## 1. Overview

This application is a platform connecting landlords with contractors for property maintenance services. It follows a modern full-stack JavaScript/TypeScript architecture with a clear separation between client and server components. The application enables landlords to post jobs, contractors to bid on these jobs, and facilitates communication and payment processing between the two parties.

The system is built using React on the frontend with Node.js/Express on the backend, and PostgreSQL (via Neon serverless) for data persistence. It employs a RESTful API architecture for client-server communication with real-time updates via WebSockets for features like chat.

## 2. System Architecture

### Tech Stack

- **Frontend**: React, TanStack Query, Tailwind CSS, Shadcn UI components
- **Backend**: Node.js, Express
- **Database**: PostgreSQL (using Neon serverless)
- **ORM**: Drizzle ORM with zod validation
- **API**: RESTful with React Query for data fetching
- **Real-time**: WebSockets for chat functionality
- **Authentication**: Session-based with cookie fallback to header-based auth
- **File Storage**: Local file system storage for uploads
- **Payment Processing**: Stripe integration

### Architecture Pattern

The application follows a client-server architecture with:

1. **Client-side SPA**: React-based single-page application
2. **Server-side API**: Express REST API
3. **Database Layer**: PostgreSQL with Drizzle ORM
4. **External Services**: Stripe for payments, Mapbox for location services

## 3. Key Components

### Frontend Components

1. **Authentication System**:
   - Handles user registration, login, and session management
   - Maintains auth state via React Query cache and sessionStorage
   - Supports different user types (landlord and contractor)

2. **Dashboard Interfaces**:
   - Separate dashboards for landlords and contractors
   - Landlord dashboard for posting jobs and reviewing bids
   - Contractor dashboard for finding jobs and submitting bids

3. **Messaging System**:
   - Real-time chat between landlords and contractors
   - WebSocket-based with polling fallback
   - Support for text and image messages

4. **Location Services**:
   - Service area definition for contractors
   - Job location specification for landlords
   - Mapbox integration for geocoding and visualization

5. **Review and Rating System**:
   - Two-way reviews between landlords and contractors
   - Rating aggregation and display

### Backend Components

1. **API Routes**:
   - RESTful endpoints organized by resource
   - Authentication middleware
   - Input validation using zod schemas

2. **Database Interaction**:
   - Drizzle ORM for type-safe database operations
   - Schema defined with PostgreSQL-specific types

3. **Authentication Middleware**:
   - Session management via express-session
   - Backup authentication via custom headers

4. **File Upload Handling**:
   - Multer middleware for file processing
   - Local storage of uploaded files

5. **WebSocket Server**:
   - Real-time chat message delivery
   - Connection management and fallback strategies

### Database Schema

The database is structured around these primary entities:

1. **Users**: Core user data with type discrimination (landlord/contractor)
2. **Profiles**: Extended data specific to each user type
3. **Jobs**: Maintenance requests posted by landlords
4. **Bids**: Offers from contractors for specific jobs
5. **Transactions**: Financial records for the platform
6. **Chat**: Rooms and messages for communication

## 4. Data Flow

### Job Lifecycle

1. Landlord creates a job with details, photos, and location
2. Contractors within the service area can view and bid on the job
3. Landlord reviews bids and selects a contractor
4. Work is performed and documented with photos
5. Payment is processed and held in escrow
6. Job is marked as complete after landlord approval
7. Both parties can leave reviews

### Authentication Flow

1. User registers with email, password, and user type
2. Server validates input, hashes password, and creates user record
3. User logs in with credentials
4. Server creates session and returns user data
5. Client stores session in cookie and sessionStorage
6. Subsequent requests include session cookie or user ID header
7. Protected routes verify authentication before access

### Chat Flow

1. Users can initiate chat from job details
2. WebSocket connection established (with polling fallback)
3. Messages stored in database and delivered in real-time
4. Message history loaded on chat open
5. File attachments processed via separate upload endpoint

## 5. External Dependencies

### Core Dependencies

1. **Database**: 
   - Neon PostgreSQL serverless (@neondatabase/serverless)
   - Drizzle ORM for database operations

2. **UI Components**:
   - Radix UI primitives
   - Shadcn UI component library
   - Tailwind CSS for styling

3. **Data Management**:
   - TanStack Query for server state
   - React Hook Form for form handling
   - Zod for schema validation

4. **External Services**:
   - Stripe for payment processing
   - Mapbox for location services and mapping

## 6. Deployment Strategy

The application is configured for deployment on Replit, with specific considerations for this environment:

1. **Build Process**:
   - Frontend: Vite for build and bundling
   - Backend: esbuild for Node.js bundling

2. **Runtime Configuration**:
   - Environment variables for database connection and API keys
   - Adapting to Replit's port configuration

3. **Database Provisioning**:
   - Using Neon's serverless PostgreSQL for scalability
   - Migration scripts for schema management

4. **Static Assets**:
   - Served by Express from the built Vite output

5. **Session Management**:
   - Fallback mechanisms for environments with limited cookie support
   - Dual auth strategy (cookies + headers) for reliability

The deployment is optimized for Replit's cloud runtime environment, with provisions for persistent storage, server restarts, and external service connectivity.