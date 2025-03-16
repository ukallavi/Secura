#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate a secure random string
function generateSecureKey(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

// Create .env file with secure keys
function createEnvFile() {
  const jwtSecret = generateSecureKey(32);
  const encryptionKey = generateSecureKey(32);
  
  const envContent = `# Database Configuration
DB_HOST=db
DB_USER=secura_user
DB_PASSWORD=${generateSecureKey(16)}
DB_NAME=secura_db
MYSQL_ROOT_PASSWORD=${generateSecureKey(16)}

# JWT and Encryption
JWT_SECRET=${jwtSecret}
ENCRYPTION_KEY=${encryptionKey}

# Environment
NODE_ENV=production
PORT=5000
CORS_ORIGIN=http://localhost:3000
`;

  fs.writeFileSync(path.join(__dirname, '..', '.env'), envContent);
  console.log('Generated .env file with secure keys');
}

// Run the function
createEnvFile();
