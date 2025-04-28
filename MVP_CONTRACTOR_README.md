# MVP_contractor Deployment

This branch represents the MVP (Minimum Viable Product) for the contractor side of the RealService application.

## Features Included
- Business name field added to contractor profiles
- Enhanced tab navigation with improved visibility 
- Password change functionality with secure hashing
- Masked password display for better security
- Profile update that doesn't affect login email
- Comprehensive bid management system
- Job filtering and service area management
- Quote creation from jobs

## Deployment Instructions
1. The application uses a PostgreSQL database (DATABASE_URL environment variable)
2. MapBox integration is configured via VITE_MAPBOX_TOKEN
3. Session management is handled via express-session with PostgreSQL storage

## Deployment Notes
- The app is optimized for deployment on Replit
- All necessary build scripts are properly configured
- Database migrations have been applied