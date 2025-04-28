/**
 * Fix password handling to support existing password format
 * 
 * This script updates the server authentication code to handle the existing
 * password format in the Neon database.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to routes.ts file
const routesPath = path.join(__dirname, '../server/routes.ts');

function updatePasswordHandling() {
  try {
    console.log('Reading routes.ts file...');
    const routesContent = fs.readFileSync(routesPath, 'utf8');
    
    // Check if the file contains the comparePasswords function
    if (!routesContent.includes('async function comparePasswords')) {
      console.error('comparePasswords function not found in routes.ts');
      return false;
    }
    
    // Look for the comparePasswords function in the file
    const comparePasswordsRegex = /async function comparePasswords\([^)]+\) \{[\s\S]+?return timingSafeEqual\([^;]+\);[\s\S]+?\}/;
    
    // Find the function
    const comparePasswordsMatch = routesContent.match(comparePasswordsRegex);
    if (!comparePasswordsMatch) {
      console.error('Could not parse comparePasswords function');
      return false;
    }
    
    const oldComparePasswordsFunc = comparePasswordsMatch[0];
    
    // Define the new version of the function that handles different hash lengths
    const newComparePasswordsFunc = `async function comparePasswords(supplied, stored) {
  try {
    // Check if stored password has the expected format
    if (!stored || !stored.includes('.')) {
      console.log('Invalid password format');
      return false;
    }
    
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    
    // Handle different hash lengths (28 or 64 bytes)
    const hashByteLength = hashedBuf.length;
    const suppliedBuf = await scryptAsync(supplied, salt, hashByteLength);
    
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Password comparison error:', error.message);
    return false;
  }
}`;
    
    // Replace the old function with the new one
    const updatedContent = routesContent.replace(oldComparePasswordsFunc, newComparePasswordsFunc);
    
    // Write the updated content back to the file
    fs.writeFileSync(routesPath, updatedContent, 'utf8');
    
    console.log('✅ Successfully updated password handling in routes.ts');
    return true;
  } catch (error) {
    console.error('Error updating password handling:', error);
    return false;
  }
}

updatePasswordHandling();