# User & Data Migration Guide

## Overview
This guide provides step-by-step instructions to complete the migration of data from the source database to the target production database. The initial steps have been completed, including table initialization and partial data migration, but there are remaining steps that require your attention.

## Prerequisites
- Access to both source and target database credentials
- Node.js environment (already set up in Replit)
- All required packages are already installed

## Step 1: Update Source Database Credentials
The current source database connection is failing due to authentication issues. Please update the `.env` file with the correct credentials:

```
SOURCE_DATABASE_URL=postgres://your_username:your_password@ep-sparkling-sound-a6f8kyru.us-west-2.aws.neon.tech/neondb?sslmode=require
```

## Step 2: Export Source Data
Run the source data export script to retrieve and save all data from the source database:

```bash
node scripts/source-data-export.cjs
```

This will create a `source-data.json` file containing all the data from the source database.

## Step 3: Complete the Migration
Run the full migration script to transfer all data from the source to the target database:

```bash
node scripts/migrate-all-data.cjs
```

## Step 4: Update Sequences
After migration, run the update sequences script to ensure that auto-increment IDs are set correctly:

```bash
node scripts/update-sequences.cjs
```

## Step 5: Verify Migration
Run the verification script to ensure that all data has been properly migrated:

```bash
node scripts/verify-migration.cjs
```

## Step 6: Test Application
Start the application and test all functionality to ensure it works properly with the migrated data:

```bash
npm run dev
```

## Troubleshooting

### SSL Connection Issues
If you encounter SSL connection issues, ensure the SSL settings are properly configured in the database connection:

```javascript
const pool = new Pool({
  connectionString: process.env.SOURCE_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
```

### Authentication Failures
If authentication fails, double-check the username and password in your connection string. The current credentials are not working, so new valid credentials are required.

### Foreign Key Constraints
If you encounter foreign key constraint errors, ensure you're migrating tables in the correct order. The migration script handles this, but you may need to manually adjust the order if specific errors occur.

### Schema Differences
If column name errors occur, check that the initialization scripts have correctly created all required columns and that the column naming transformation is working properly.

## Migration Files
- `scripts/initialize-contractor-profiles.cjs`: Creates contractor profiles table
- `scripts/initialize-jobs.cjs`: Creates jobs and bids tables
- `scripts/initialize-quotes-invoices.cjs`: Creates quotes and invoices tables
- `scripts/source-data-export.cjs`: Exports data from source database
- `scripts/migrate-all-data.cjs`: Migrates all data with column name transformation
- `PRODUCTION_MIGRATION_REPORT.md`: Detailed report of the migration process
- `data-migration-log.txt`: Log of completed migration steps

## Conclusion
Once all steps are completed, your application should be fully operational with all data migrated to the new production database. If you encounter any issues during the process, refer to the detailed error messages and the troubleshooting section of this guide.