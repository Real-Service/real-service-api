#!/bin/bash
# Run this script with: source ./scripts/verify-env.sh

export DATABASE_URL="postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
echo "DATABASE_URL has been set to the production database."
echo "Current value: $DATABASE_URL"
