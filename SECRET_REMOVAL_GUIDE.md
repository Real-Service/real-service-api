# Guide: How to Remove Secrets from Your Repository

## The Issue

Your GitHub push is being blocked because the GitHub push protection detected a sensitive file in your repository: **secrets.txt**. This is a security feature to prevent accidentally exposing sensitive credentials.

## Solution Steps

1. **Remove secrets from Git tracking without deleting the file**:
   ```bash
   git rm --cached secrets.txt
   ```

2. **Update .gitignore to prevent tracking in the future**:
   ```bash
   echo "secrets.txt" >> .gitignore
   echo ".env*" >> .gitignore
   echo "*.pem" >> .gitignore
   ```

3. **Commit these changes**:
   ```bash
   git commit -m "Remove sensitive files from repository"
   ```

4. **Push your changes**:
   ```bash
   git push
   ```

## Using the Cleanup Script

For a more thorough cleanup, you can use the included `clean-secrets.js` script:

1. **Run the cleanup script**:
   ```bash
   node clean-secrets.js
   ```

This script will:
- Back up your secret files to a `.secret-backups` directory (which is also added to .gitignore)
- Remove the secret files from your repository
- Update .gitignore to prevent future tracking
- Create example template files with placeholder values

## Best Practices for Secrets Management

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Create example files** with placeholder values (e.g., `.env.example`)
4. **Utilize a secrets manager** for production environments
5. **Rotate credentials regularly** for security

## For Your Production Deployment

When deploying to production:

1. Use the platform's environment variables or secrets management:
   - Render.com: Environment tab in your service settings
   - Vercel: Environment Variables section
   - Railway: Variables section
   - Fly.io: Use `fly secrets set`

2. Create a `.env.example` file with all required environment variables listed (but with placeholder values)

3. Add robust validation to your application startup to check for required environment variables