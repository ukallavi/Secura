'use client';

/**
 * Encryption utilities for Secura password manager
 * Implements end-to-end encryption for sensitive data
 */

/**
 * Generates a random encryption salt
 * @returns {string} A hex-encoded random salt
 */
export const generateSalt = () => {
  const array = new Uint8Array(32); // 32 bytes = 256 bits
  window.crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Derives an encryption key from the master password and salt
 * @param {string} masterPassword - The user's master password
 * @param {string} salt - The user-specific salt (hex string)
 * @returns {Promise<CryptoKey>} The derived encryption key
 */
export const deriveEncryptionKey = async (masterPassword, salt) => {
  try {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(masterPassword);
    
    // Convert hex salt to Uint8Array
    const saltBuffer = new Uint8Array(salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    // Import the password as a key
    const passwordKey = await window.crypto.subtle.importKey(
      'raw', 
      passwordBuffer, 
      { name: 'PBKDF2' }, 
      false, 
      ['deriveKey']
    );
    
    // Derive the actual encryption key
    const encryptionKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000, // High iteration count for security
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false, // Not extractable
      ['encrypt', 'decrypt']
    );
    
    return encryptionKey;
  } catch (error) {
    console.error('Error deriving encryption key:', error);
    throw new Error('Failed to derive encryption key');
  }
};

/**
 * Encrypts data using the derived encryption key
 * @param {string} data - The data to encrypt
 * @param {CryptoKey} encryptionKey - The encryption key
 * @returns {Promise<string>} JSON string with iv and encrypted data
 */
export const encryptData = async (data, encryptionKey) => {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate a random IV for each encryption
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      dataBuffer
    );
    
    // Convert to hex strings for storage
    const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
    const encryptedHex = encryptedArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Return as JSON string
    return JSON.stringify({
      iv: ivHex,
      data: encryptedHex
    });
  } catch (error) {
    console.error('Error encrypting data:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts data using the derived encryption key
 * @param {string} encryptedJson - JSON string with iv and encrypted data
 * @param {CryptoKey} encryptionKey - The encryption key
 * @returns {Promise<string>} The decrypted data
 */
export const decryptData = async (encryptedJson, encryptionKey) => {
  try {
    const { iv, data } = JSON.parse(encryptedJson);
    
    // Convert hex strings back to Uint8Arrays
    const ivArray = new Uint8Array(iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const encryptedArray = new Uint8Array(data.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    // Decrypt the data
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
      encryptionKey,
      encryptedArray
    );
    
    // Convert the decrypted data back to a string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Error decrypting data:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Stores the encryption key in memory for the session
 * @param {CryptoKey} key - The encryption key to store
 */
export const storeEncryptionKey = (key) => {
  if (typeof window !== 'undefined') {
    window.__SECURA_ENCRYPTION_KEY = key;
  }
};

/**
 * Retrieves the encryption key from memory
 * @returns {CryptoKey|null} The stored encryption key or null
 */
export const getEncryptionKey = () => {
  if (typeof window !== 'undefined') {
    return window.__SECURA_ENCRYPTION_KEY || null;
  }
  return null;
};

/**
 * Clears the encryption key from memory
 */
export const clearEncryptionKey = () => {
  if (typeof window !== 'undefined') {
    window.__SECURA_ENCRYPTION_KEY = null;
  }
};
