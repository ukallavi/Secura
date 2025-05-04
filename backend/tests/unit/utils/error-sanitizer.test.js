/**
 * Tests for error-sanitizer.js
 * Tests the sanitization and anonymization functions
 */
const { sanitizeErrorData, anonymizeUserId } = require('../../../utils/error-sanitizer');

// Mock environment variables
process.env.ERROR_TRACKING_SALT = 'test-salt';

describe('Error Sanitizer', () => {
  describe('sanitizeErrorData', () => {
    test('should sanitize sensitive data from error context', () => {
      const errorData = {
        error_type: 'VALIDATION_ERROR',
        error_message: 'Invalid input',
        error_stack: 'Error: Invalid input\n    at validateInput (/app/src/utils/validation.js:42:11)',
        context: {
          email: 'user@example.com',
          password: 'secret123',
          creditCard: '4111-1111-1111-1111',
          ssn: '123-45-6789',
          apiKey: 'sk_test_abcdefghijklmnopqrstuvwxyz',
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            name: 'John Doe',
            email: 'john@example.com',
            password: 'password123'
          }
        }
      };
      
      const sanitized = sanitizeErrorData(errorData);
      
      // Check that sensitive data is redacted
      expect(sanitized.context.email).toBe('[EMAIL REDACTED]');
      expect(sanitized.context.password).toBe('[REDACTED]');
      expect(sanitized.context.creditCard).toBe('[CREDIT CARD REDACTED]');
      expect(sanitized.context.ssn).toBe('[SSN REDACTED]');
      expect(sanitized.context.apiKey).toBe('[API KEY REDACTED]');
      expect(sanitized.context.token).toBe('[TOKEN REDACTED]');
      expect(sanitized.context.user.email).toBe('[EMAIL REDACTED]');
      expect(sanitized.context.user.password).toBe('[REDACTED]');
      
      // Non-sensitive data should remain unchanged
      expect(sanitized.error_type).toBe(errorData.error_type);
      expect(sanitized.error_message).toBe(errorData.error_message);
      expect(sanitized.error_stack).toBe(errorData.error_stack);
      expect(sanitized.context.user.name).toBe('John Doe');
    });
    
    test('should handle null or undefined context', () => {
      const errorWithNullContext = {
        error_type: 'ERROR',
        error_message: 'Something went wrong',
        context: null
      };
      
      const errorWithUndefinedContext = {
        error_type: 'ERROR',
        error_message: 'Something went wrong'
      };
      
      const sanitizedNull = sanitizeErrorData(errorWithNullContext);
      const sanitizedUndefined = sanitizeErrorData(errorWithUndefinedContext);
      
      expect(sanitizedNull.context).toBeNull();
      expect(sanitizedUndefined.context).toBeUndefined();
    });
    
    test('should handle non-object context', () => {
      const errorWithStringContext = {
        error_type: 'ERROR',
        error_message: 'Something went wrong',
        context: 'This is a string context'
      };
      
      const sanitized = sanitizeErrorData(errorWithStringContext);
      
      expect(sanitized.context).toBe('This is a string context');
    });
    
    test('should sanitize error messages containing sensitive data', () => {
      const errorWithSensitiveMessage = {
        error_type: 'AUTH_ERROR',
        error_message: 'Failed to authenticate with password: secret123',
        context: {}
      };
      
      const sanitized = sanitizeErrorData(errorWithSensitiveMessage);
      
      expect(sanitized.error_message).toBe('Failed to authenticate with password: [REDACTED]');
    });
    
    test('should sanitize error stack traces containing sensitive data', () => {
      const errorWithSensitiveStack = {
        error_type: 'ERROR',
        error_message: 'Error occurred',
        error_stack: 'Error: Failed with API key sk_test_abcdefghijklmnopqrstuvwxyz\n    at processPayment (/app/src/services/payment.js:55:12)',
        context: {}
      };
      
      const sanitized = sanitizeErrorData(errorWithSensitiveStack);
      
      expect(sanitized.error_stack).toContain('Error: Failed with API key [API KEY REDACTED]');
    });
  });
  
  describe('anonymizeUserId', () => {
    test('should consistently hash the same user ID', () => {
      const userId = 'user-123';
      
      const hash1 = anonymizeUserId(userId);
      const hash2 = anonymizeUserId(userId);
      
      expect(hash1).toBe(hash2);
    });
    
    test('should produce different hashes for different user IDs', () => {
      const userId1 = 'user-123';
      const userId2 = 'user-456';
      
      const hash1 = anonymizeUserId(userId1);
      const hash2 = anonymizeUserId(userId2);
      
      expect(hash1).not.toBe(hash2);
    });
    
    test('should handle null or undefined user IDs', () => {
      const hashNull = anonymizeUserId(null);
      const hashUndefined = anonymizeUserId(undefined);
      
      expect(hashNull).toBe('anonymous');
      expect(hashUndefined).toBe('anonymous');
    });
    
    test('should handle non-string user IDs', () => {
      const hashNumber = anonymizeUserId(12345);
      const hashObject = anonymizeUserId({ id: 'user-123' });
      
      // Should convert to string first, then hash
      expect(typeof hashNumber).toBe('string');
      expect(typeof hashObject).toBe('string');
      expect(hashNumber).not.toBe('anonymous');
      expect(hashObject).not.toBe('anonymous');
    });
  });
});
