/**
 * Utility functions for sanitizing error data to remove sensitive information
 * before storing or transmitting error reports
 */

const SENSITIVE_FIELD_PATTERNS = [
  'password', 'token', 'secret', 'key', 'auth', 'credential', 'jwt', 'ssn', 
  'social', 'credit', 'card', 'cvv', 'pin', 'passphrase', 'private'
];

/**
 * Sanitize error data to remove potentially sensitive information
 * @param {Object} errorData - The raw error data to sanitize
 * @returns {Object} Sanitized error data
 */
function sanitizeErrorData(errorData) {
  if (!errorData) return errorData;
  
  // Create a deep copy to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(errorData));
  
  // Sanitize error message
  if (sanitized.error_message) {
    sanitized.error_message = sanitizeString(sanitized.error_message);
  }
  
  // Sanitize stack trace
  if (sanitized.error_stack) {
    sanitized.error_stack = sanitizeString(sanitized.error_stack);
  }
  
  // Sanitize context object
  if (sanitized.context) {
    sanitized.context = sanitizeObject(sanitized.context);
  }
  
  return sanitized;
}

/**
 * Sanitize a string to remove sensitive patterns
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') return str;
  
  let sanitized = str;
  
  // Redact email addresses
  sanitized = sanitized.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDACTED]');
  
  // Redact phone numbers (various formats)
  sanitized = sanitized.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE REDACTED]');
  
  // Redact credit card numbers
  sanitized = sanitized.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CREDIT CARD REDACTED]');
  
  // Redact JWT tokens
  sanitized = sanitized.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT REDACTED]');
  
  // Redact API keys (common formats)
  sanitized = sanitized.replace(/\b[a-zA-Z0-9]{32,}\b/g, '[API KEY REDACTED]');
  
  // Redact IP addresses
  sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP REDACTED]');
  
  return sanitized;
}

/**
 * Recursively sanitize an object to remove sensitive data
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  // Handle regular objects
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Check if this is a sensitive field
    const isSensitiveField = SENSITIVE_FIELD_PATTERNS.some(pattern => 
      key.toLowerCase().includes(pattern)
    );
    
    if (isSensitiveField) {
      // Redact sensitive fields
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value);
    } else if (typeof value === 'string') {
      // Sanitize string values
      sanitized[key] = sanitizeString(value);
    } else {
      // Keep other values as is
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Anonymize user identifiers while maintaining ability to correlate errors
 * Uses PBKDF2 with high iteration count for stronger protection
 * @param {string} userId - User ID to anonymize
 * @returns {string} Anonymized user identifier
 */
function anonymizeUserId(userId) {
  if (!userId) return 'anonymous';
  
  // Use PBKDF2 with high iteration count for stronger protection
  const crypto = require('crypto');
  const salt = process.env.ERROR_TRACKING_SALT || 'secura-error-tracking';
  
  try {
    // Use PBKDF2 with 10,000 iterations for stronger protection
    // This is a better approach than a simple hash
    const derivedKey = crypto.pbkdf2Sync(
      userId,
      salt,
      10000, // Higher iteration count for better security
      16, // 16 bytes = 128 bits, sufficient for anonymization
      'sha256'
    );
    
    return derivedKey.toString('hex');
  } catch (error) {
    // Fallback to simpler hash if PBKDF2 fails
    return crypto
      .createHash('sha256')
      .update(`${userId}${salt}`)
      .digest('hex')
      .substring(0, 16);
  }
}

module.exports = {
  sanitizeErrorData,
  sanitizeString,
  sanitizeObject,
  anonymizeUserId
};
