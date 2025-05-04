/**
 * Unit tests for encryption utilities
 */
const { encrypt, decrypt, generateKey, hashPassword, verifyPassword } = require('../../../utils/encryption');

// Mock environment variables
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-exactly';

describe('Encryption Utilities', () => {
  describe('encrypt and decrypt', () => {
    test('should encrypt and decrypt a string correctly', () => {
      const originalText = 'sensitive password data';
      
      // Encrypt the text
      const encrypted = encrypt(originalText);
      
      // Verify encrypted text is different from original
      expect(encrypted).not.toBe(originalText);
      
      // Decrypt the text
      const decrypted = decrypt(encrypted);
      
      // Verify decrypted text matches original
      expect(decrypted).toBe(originalText);
    });
    
    test('should handle empty strings', () => {
      const originalText = '';
      
      // Encrypt the text
      const encrypted = encrypt(originalText);
      
      // Verify encrypted text is not empty
      expect(encrypted).not.toBe('');
      
      // Decrypt the text
      const decrypted = decrypt(encrypted);
      
      // Verify decrypted text is empty
      expect(decrypted).toBe('');
    });
    
    test('should handle special characters', () => {
      const originalText = '!@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./';
      
      // Encrypt the text
      const encrypted = encrypt(originalText);
      
      // Verify encrypted text is different from original
      expect(encrypted).not.toBe(originalText);
      
      // Decrypt the text
      const decrypted = decrypt(encrypted);
      
      // Verify decrypted text matches original
      expect(decrypted).toBe(originalText);
    });
    
    test('should handle non-string inputs', () => {
      const originalNumber = 12345;
      
      // Encrypt the number
      const encrypted = encrypt(originalNumber);
      
      // Verify encrypted text is different from original
      expect(encrypted).not.toBe(originalNumber.toString());
      
      // Decrypt the text
      const decrypted = decrypt(encrypted);
      
      // Verify decrypted text matches original as string
      expect(decrypted).toBe(originalNumber.toString());
    });
    
    test('should throw error when decrypting invalid data', () => {
      // Invalid encrypted data
      const invalidData = 'not-valid-encrypted-data';
      
      // Attempt to decrypt should throw an error
      expect(() => decrypt(invalidData)).toThrow();
    });
  });
  
  describe('generateKey', () => {
    test('should generate a random key of specified length', () => {
      const keyLength = 32;
      const key = generateKey(keyLength);
      
      // Verify key length
      expect(key.length).toBe(keyLength);
      
      // Generate another key and verify it's different
      const anotherKey = generateKey(keyLength);
      expect(key).not.toBe(anotherKey);
    });
    
    test('should generate keys of different lengths', () => {
      const key16 = generateKey(16);
      const key24 = generateKey(24);
      const key32 = generateKey(32);
      
      // Verify key lengths
      expect(key16.length).toBe(16);
      expect(key24.length).toBe(24);
      expect(key32.length).toBe(32);
    });
  });
  
  describe('hashPassword and verifyPassword', () => {
    test('should hash a password and verify it correctly', async () => {
      const password = 'StrongPassword123!';
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Verify hashed password is different from original
      expect(hashedPassword).not.toBe(password);
      
      // Verify the password
      const isValid = await verifyPassword(password, hashedPassword);
      
      // Verify password verification succeeds
      expect(isValid).toBe(true);
    });
    
    test('should fail verification with incorrect password', async () => {
      const password = 'StrongPassword123!';
      const wrongPassword = 'WrongPassword123!';
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Verify with wrong password
      const isValid = await verifyPassword(wrongPassword, hashedPassword);
      
      // Verify password verification fails
      expect(isValid).toBe(false);
    });
    
    test('should generate different hashes for the same password', async () => {
      const password = 'StrongPassword123!';
      
      // Hash the password twice
      const hashedPassword1 = await hashPassword(password);
      const hashedPassword2 = await hashPassword(password);
      
      // Verify hashes are different (due to salt)
      expect(hashedPassword1).not.toBe(hashedPassword2);
      
      // Verify both hashes work for verification
      const isValid1 = await verifyPassword(password, hashedPassword1);
      const isValid2 = await verifyPassword(password, hashedPassword2);
      
      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });
    
    test('should handle empty passwords', async () => {
      const password = '';
      
      // Hash the empty password
      const hashedPassword = await hashPassword(password);
      
      // Verify hashed password is not empty
      expect(hashedPassword).not.toBe('');
      
      // Verify the empty password
      const isValid = await verifyPassword(password, hashedPassword);
      
      // Verify password verification succeeds
      expect(isValid).toBe(true);
    });
  });
});
