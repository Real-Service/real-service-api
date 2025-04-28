# Real Service Database Connection Guide

## Current Database Situation

You have **two separate Neon PostgreSQL databases**:

1. **Development Database (us-west-2)**
   - Connection: `postgresql://neondb_owner:***@ep-sparkling-sound-a6f8kyru.us-west-2.aws.neon.tech/neondb`
   - Contains: 19 users with complete profiles
   - Status: Your Replit environment is currently connected to this database

2. **Production Database (us-east-1)**
   - Connection: `postgresql://neondb_owner:***@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb`
   - Contains: 4 test users we just created
   - Status: This is what your deployed app uses, but your Replit environment isn't connected to it

## Why Login Was Failing in Production

Your production deployment was trying to authenticate against an empty database (the us-east-1 database), which had no users.

## Solution: We've Added Test Users to Production

I've created these test users in your production database:

| Username     | Password     | User Type  |
|--------------|--------------|------------|
| testuser     | password123  | contractor |
| contractor   | password123  | contractor |
| landlord     | password123  | landlord   |
| contractor10 | password     | contractor |

## How to Test Production Environment

To test with the production database from your Replit environment:

1. Update your `.env` file:
   ```
   export DATABASE_URL=postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

2. Restart your application

3. Try logging in with `testuser` / `password123`

## Long-term Solutions

For a more permanent solution, consider one of these approaches:

1. **Keep Using Development Database For Development**
   - Keep your Replit connected to development database
   - Keep production connected to production database
   - Maintain separate test users in both environments

2. **Migrate All Data to Production**
   - Create a full migration script to copy all tables and data
   - Note that schema differences must be addressed
   - Development: column names use camelCase (e.g., "fullName")
   - Production: column names use snake_case (e.g., "user_type")

3. **Automate User Creation**
   - Add a startup script that ensures test users exist
   - This would create users automatically if database is empty

## Useful Scripts

I've created several scripts to help manage your database situation:

- `scripts/check-current-database-connection.js` - Shows which database you're connected to
- `scripts/check-production-schema.js` - Shows schema in production database
- `scripts/check-development-schema.js` - Shows schema in development database
- `scripts/create-test-user-in-production.js` - Creates a test user in production
- `scripts/create-more-production-users.js` - Creates additional test users in production

Run any script with:
```
node scripts/script-name.js
```