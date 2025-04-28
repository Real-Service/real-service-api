/**
 * Script to document valid production login credentials
 * Creates a markdown file with all valid usernames and passwords
 */

import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

async function documentProductionLogin() {
  // Create pool for production database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6vobxfJk3NZW@ep-dark-bird-a4xtgivw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get all users
    console.log('DOCUMENTING ALL PRODUCTION USERS');
    const usersResult = await pool.query(`
      SELECT u.id, u.username, u.email, u."userType", u."fullName"
      FROM users u
      ORDER BY u.id ASC
    `);
    
    if (usersResult.rows.length === 0) {
      console.log('No users found');
      return;
    }
    
    console.log(`Found ${usersResult.rows.length} users`);
    
    // Format as markdown
    let markdown = `# Production Login Credentials\n\n`;
    markdown += `This document contains the valid login credentials for the production database.\n\n`;
    
    markdown += `## Contractor Users\n\n`;
    markdown += `| ID | Username | Email | Full Name | Password |\n`;
    markdown += `|----|----------|-------|-----------|----------|\n`;
    
    const contractors = usersResult.rows.filter(u => u.userType === 'contractor');
    for (const user of contractors) {
      // Most users use password123, except contractor 10 which uses "password"
      const password = user.username === 'contractor 10' ? 'password' : 'password123';
      markdown += `| ${user.id} | \`${user.username}\` | ${user.email} | ${user.fullName || 'N/A'} | \`${password}\` |\n`;
    }
    
    markdown += `\n## Landlord Users\n\n`;
    markdown += `| ID | Username | Email | Full Name | Password |\n`;
    markdown += `|----|----------|-------|-----------|----------|\n`;
    
    const landlords = usersResult.rows.filter(u => u.userType === 'landlord');
    for (const user of landlords) {
      markdown += `| ${user.id} | \`${user.username}\` | ${user.email} | ${user.fullName || 'N/A'} | \`password123\` |\n`;
    }
    
    markdown += `\n## Notes\n\n`;
    markdown += `- The production database is hosted on Neon in the \`us-east-1\` region.\n`;
    markdown += `- Both bcrypt (\`$2b$...\`) and scrypt hashing formats are supported by the login system.\n`;
    markdown += `- When testing the application, make sure to use the exact username as shown above, including spaces.\n`;
    markdown += `- User with ID 7 (\`contractor 10\`) uses password \`password\` while all others use \`password123\`.\n`;
    
    // Write to file
    fs.writeFileSync('PRODUCTION_LOGIN_CREDENTIALS.md', markdown);
    
    console.log('✅ Successfully created PRODUCTION_LOGIN_CREDENTIALS.md');
    console.log(`Documented ${contractors.length} contractors and ${landlords.length} landlords`);
    
  } catch (error) {
    console.error('Error documenting production login:', error);
  } finally {
    await pool.end();
  }
}

documentProductionLogin();