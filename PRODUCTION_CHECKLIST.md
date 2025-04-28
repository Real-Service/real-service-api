# Production Deployment Checklist

Use this checklist to ensure your Real Service application is ready for production deployment.

## Pre-Deployment Checks

- [ ] **Database Connection**
  - [ ] Ensure DATABASE_URL environment variable is set correctly
  - [ ] Create the session table: `node scripts/create-session-table.js`
  - [ ] Test database connection: `node test-production-db.js`

- [ ] **Environment Variables**
  - [ ] Set NODE_ENV=production
  - [ ] Generate a strong SESSION_SECRET
  - [ ] Add any other required API keys (Stripe, Mapbox, etc.)

- [ ] **Security**
  - [ ] Ensure all auth routes use secure connections
  - [ ] Enable HTTPS for all traffic
  - [ ] Configure proper CORS settings

## Deployment Steps

1. **Prepare Database**
   - [ ] Run session table creation script
   - [ ] Verify session table exists and has correct structure

2. **Build Application**
   - [ ] Run `npm run build`
   - [ ] Ensure no build errors

3. **Deploy**
   - [ ] Deploy application to production environment
   - [ ] Set all required environment variables

4. **Verify**
   - [ ] Check application logs for database connection success
   - [ ] Test user login and session persistence
   - [ ] Verify all major features work correctly

## Post-Deployment

- [ ] Monitor server logs for any errors
- [ ] Set up monitoring and alerting
- [ ] Create automated database backups
- [ ] Document deployment process for team

## Session Table Requirements

The session table must have this exact structure:

```sql
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

Use the provided `scripts/create-session-table.js` script to create this table automatically.

## Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| "Session table does not exist" | Run the session table creation script |
| Database connection errors | Verify DATABASE_URL and database permissions |
| Authentication failures | Check that auth db connections are using TCP/SSL |
| Sessions not persisting | Verify session table structure and session store configuration |

**For more detailed instructions, refer to PRODUCTION_DEPLOYMENT_FINAL.md**