import fs from 'fs';
import path from 'path';

/**
 * This script updates the server authentication code to fix password handling
 * so it can work with multiple password formats in the database.
 */

function updatePasswordHandling() {
  const authFilePath = path.join(process.cwd(), 'server', 'auth.ts');
  
  // Check if file exists
  if (!fs.existsSync(authFilePath)) {
    console.error(`Error: File not found at ${authFilePath}`);
    return;
  }
  
  // Read the current auth.ts file
  let authFileContent = fs.readFileSync(authFilePath, 'utf8');
  
  // Find the comparePasswords function
  const comparePasswordsRegex = /async function comparePasswords\(supplied: string, stored: string\) \{[\s\S]*?\}/;
  const originalComparePasswordsFunc = authFileContent.match(comparePasswordsRegex)?.[0];
  
  if (!originalComparePasswordsFunc) {
    console.error('Error: Could not find comparePasswords function in auth.ts');
    return;
  }
  
  // Create a new comparePasswords function that handles multiple password formats
  const newComparePasswordsFunc = `async function comparePasswords(supplied: string, stored: string) {
  try {
    // Check if it's bcrypt format (starts with $2b$)
    if (stored.startsWith('$2b$')) {
      // Use bcrypt compare for this format
      const bcrypt = await import('bcrypt');
      return await bcrypt.compare(supplied, stored);
    }
    
    // Otherwise, assume it's our scrypt format with salt
    const [hashed, salt] = stored.split(".");
    
    // If we can't split it properly, return false
    if (!hashed || !salt) {
      console.error('Invalid password format:', stored.substring(0, 10) + '...');
      return false;
    }
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}`;
  
  // Replace the old function with the new one
  authFileContent = authFileContent.replace(comparePasswordsRegex, newComparePasswordsFunc);
  
  // Write the updated content back to the file
  fs.writeFileSync(authFilePath, authFileContent, 'utf8');
  
  console.log('Successfully updated password handling in auth.ts');
  console.log('The system can now handle multiple password formats (bcrypt and scrypt)');
}

// Run the update
updatePasswordHandling();