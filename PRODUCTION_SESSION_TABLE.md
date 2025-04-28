# Session Table Setup for Production Deployment

This guide explains how to properly set up the session table for production deployment. The session table is essential for persisting user sessions in production.

## Prerequisites

- A PostgreSQL database (like Neon) with a valid connection string
- The DATABASE_URL environment variable properly set in your deployment environment
- Node.js installed on your local machine

## Step 1: Create the Session Table Before Deployment

The session table must be created **before** deploying your application. This is because the application expects the table to exist at startup.

Run the provided script:

```bash
node scripts/create-session-table.js
```

This script will:
1. Connect to your database using the DATABASE_URL environment variable
2. Check if the session table already exists
3. Create the table with the correct structure if it doesn't exist
4. Create an index on the expire column for better performance

## Step 2: Verify the Session Table

To verify that the session table was created successfully, you can run:

```sql
SELECT * FROM session LIMIT 1;
```

You should get a result (which might be empty) without errors.

## Step 3: Ensure Proper Database Connection in Production

In production, the application **must** use a TCP/SSL connection to the database, not the WebSocket connection. This is automatically handled by the application, but you should verify the following:

1. The DATABASE_URL environment variable is set correctly in your deployment environment
2. The SESSION_SECRET environment variable is set with a strong random string
3. No warning messages appear in the logs about "Session store not using pg.Pool"

## Step 4: Deploy Your Application

After the session table is created and verified, you can deploy your application as normal.

## Troubleshooting

### Session Table Not Found

If you see errors like "relation 'session' does not exist", it means the session table was not created properly or the application is connecting to a different database than the one where you created the table.

Solution:
1. Check that DATABASE_URL points to the correct database
2. Run the create-session-table.js script again
3. Verify the table exists using a direct database query

### Session Persistence Issues

If sessions are not persisting between restarts, it may indicate that:

1. The session table exists but the application can't connect to it
2. The session store is still using the WebSocket connection (which doesn't work in production)
3. The session cookie is not being stored correctly

Solution:
1. Check the application logs for warnings about session storage
2. Ensure the DATABASE_URL is correct and accessible
3. Verify that SESSION_SECRET is set

### Database Connection Errors

If you see errors related to the database connection in production, it could mean:

1. The DATABASE_URL is incorrect or the database is not accessible
2. The connection is being blocked by a firewall
3. The database credentials are incorrect

Solution:
1. Verify the DATABASE_URL is correct and the database is accessible
2. Check your database provider's dashboard for connection issues
3. Try connecting to the database directly using a tool like `psql`