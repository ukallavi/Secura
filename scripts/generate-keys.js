const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate a secure random JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

// Generate a secure encryption key (32 bytes for AES-256)
const encryptionKey = crypto.randomBytes(32).toString('hex');

// Create .env content
const envContent = `
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=secura

# JWT Secret
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=1h

# Encryption Key (32 bytes / 256 bits)
ENCRYPTION_KEY=${encryptionKey}

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com
`;

// Write to .env file
fs.writeFileSync(path.join(__dirname, '..', '.env'), envContent.trim());

console.log('Secure keys generated and saved to .env file');
console.log('IMPORTANT: Update the database credentials and CORS_ORIGIN with your actual values');