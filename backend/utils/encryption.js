const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Key derivation from master password
const deriveEncryptionKey = async (masterPassword, salt, iterations = 600000) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      masterPassword,
      salt,
      iterations,
      32, // 256 bits
      'sha256',
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
};

// Generate a random salt
const generateSalt = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Encrypt data using AES-256-GCM
const encrypt = async (plaintext, masterPassword, salt) => {
  try {
    // Derive key from master password and salt
    const key = await deriveEncryptionKey(masterPassword, salt);
    
        // Generate random initialization vector
        const iv = crypto.randomBytes(12);
    
        // Create cipher
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        // Encrypt data
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        // Get authentication tag
        const authTag = cipher.getAuthTag();
        
        // Return encrypted data, IV, and auth tag as a combined string
        return {
          encryptedData: encrypted,
          iv: iv.toString('hex'),
          authTag: authTag.toString('hex'),
          // Don't return the key or salt in the result
        };
      } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
      }
    };
    
    // Decrypt data using AES-256-GCM
    const decrypt = async (encryptedData, iv, authTag, masterPassword, salt) => {
      try {
        // Derive key from master password and salt
        const key = await deriveEncryptionKey(masterPassword, salt);
        
        // Convert hex strings to buffers
        const ivBuffer = Buffer.from(iv, 'hex');
        const authTagBuffer = Buffer.from(authTag, 'hex');
        
        // Create decipher
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
        decipher.setAuthTag(authTagBuffer);
        
        // Decrypt data
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
      } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
      }
    };
    
    // Hash a password for storage (not for encryption)
    const hashPassword = async (password, saltRounds = 12) => {
      return await bcrypt.hash(password, saltRounds);
    };
    
    // Verify a password against a hash
    const verifyPassword = async (password, hash) => {
      return await bcrypt.compare(password, hash);
    };
    
    // Generate a secure master key for the user
    const generateMasterKey = () => {
      return crypto.randomBytes(32).toString('hex');
    };
    
    // Encrypt the master key with the user's password
    const encryptMasterKey = async (masterKey, password, salt) => {
      return await encrypt(masterKey, password, salt);
    };
    
    // Decrypt the master key with the user's password
    const decryptMasterKey = async (encryptedMasterKey, iv, authTag, password, salt) => {
      return await decrypt(encryptedMasterKey, iv, authTag, password, salt);
    };
    
    // Re-encrypt master key with a new password (for password changes)
    const reencryptMasterKey = async (encryptedMasterKey, iv, authTag, oldPassword, newPassword, salt) => {
      // Decrypt with old password
      const masterKey = await decryptMasterKey(encryptedMasterKey, iv, authTag, oldPassword, salt);
      
      // Encrypt with new password
      return await encryptMasterKey(masterKey, newPassword, salt);
    };
    
    // Generate a recovery key for the master key
    const generateRecoveryKey = () => {
      return crypto.randomBytes(16).toString('hex').match(/.{1,4}/g).join('-');
    };
    
    // Encrypt master key with recovery key
    const encryptWithRecoveryKey = async (masterKey, recoveryKey) => {
      // Remove dashes from recovery key
      const formattedRecoveryKey = recoveryKey.replace(/-/g, '');
      
      // Generate a random salt for the recovery key
      const recoverySalt = generateSalt();
      
      // Encrypt master key using recovery key as password
      const encrypted = await encrypt(masterKey, formattedRecoveryKey, recoverySalt);
      
      return {
        ...encrypted,
        recoverySalt
      };
    };
    
    // Decrypt master key with recovery key
    const decryptWithRecoveryKey = async (encryptedMasterKey, iv, authTag, recoveryKey, recoverySalt) => {
      // Remove dashes from recovery key
      const formattedRecoveryKey = recoveryKey.replace(/-/g, '');
      
      // Decrypt master key
      return await decrypt(encryptedMasterKey, iv, authTag, formattedRecoveryKey, recoverySalt);
    };
    
    module.exports = {
      deriveEncryptionKey,
      generateSalt,
      encrypt,
      decrypt,
      hashPassword,
      verifyPassword,
      generateMasterKey,
      encryptMasterKey,
      decryptMasterKey,
      reencryptMasterKey,
      generateRecoveryKey,
      encryptWithRecoveryKey,
      decryptWithRecoveryKey
    };