/**
 * Tests for error-notifications.js
 * Tests the notification system for critical errors
 */
const { isCriticalError, notifyCriticalError } = require('../../../utils/error-notifications');

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'mock-message-id',
      response: 'mock-response'
    })
  }))
}));

// Mock environment variables
const originalEnv = process.env;

describe('Error Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    
    // Set up environment variables for testing
    process.env.ADMIN_EMAILS = 'admin@secura.com,support@secura.com';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'notifications@secura.com';
    process.env.SMTP_PASSWORD = 'smtp-password';
    process.env.SMTP_FROM = 'Secura Error Monitoring <notifications@secura.com>';
    process.env.ADMIN_URL = 'https://admin.secura.com';
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });
  
  describe('isCriticalError', () => {
    test('should identify critical errors based on type', () => {
      const criticalErrors = [
        { error_type: 'CRITICAL_ERROR', error_message: 'Critical error' },
        { error_type: 'SECURITY_VIOLATION', error_message: 'Security violation' },
        { error_type: 'DATABASE_ERROR', error_message: 'Database connection failed' },
        { error_type: 'AUTHENTICATION_FAILURE', error_message: 'Authentication failed' },
        { error_type: 'ENCRYPTION_ERROR', error_message: 'Encryption failed' }
      ];
      
      const nonCriticalErrors = [
        { error_type: 'VALIDATION_ERROR', error_message: 'Validation error' },
        { error_type: 'UI_ERROR', error_message: 'UI error' },
        { error_type: 'NETWORK_ERROR', error_message: 'Network error' },
        { error_type: 'RESOURCE_NOT_FOUND', error_message: 'Resource not found' }
      ];
      
      criticalErrors.forEach(error => {
        expect(isCriticalError(error)).toBe(true);
      });
      
      nonCriticalErrors.forEach(error => {
        expect(isCriticalError(error)).toBe(false);
      });
    });
    
    test('should identify critical errors based on message keywords', () => {
      const criticalByKeyword = [
        { error_type: 'UNKNOWN_ERROR', error_message: 'Critical security issue detected' },
        { error_type: 'UNKNOWN_ERROR', error_message: 'Data corruption in user records' },
        { error_type: 'UNKNOWN_ERROR', error_message: 'Authentication service unavailable' },
        { error_type: 'UNKNOWN_ERROR', error_message: 'Encryption key compromised' }
      ];
      
      criticalByKeyword.forEach(error => {
        expect(isCriticalError(error)).toBe(true);
      });
    });
    
    test('should handle undefined or null error objects', () => {
      expect(isCriticalError(undefined)).toBe(false);
      expect(isCriticalError(null)).toBe(false);
      expect(isCriticalError({})).toBe(false);
    });
  });
  
  describe('notifyCriticalError', () => {
    test('should send email notifications for critical errors', async () => {
      const nodemailer = require('nodemailer');
      const transport = nodemailer.createTransport();
      
      const criticalError = {
        id: 123,
        error_type: 'CRITICAL_ERROR',
        error_message: 'Database connection failed',
        url: 'https://secura.com/admin/dashboard',
        timestamp: '2025-05-01T01:30:00.000Z'
      };
      
      const result = await notifyCriticalError(criticalError);
      
      expect(result).toEqual({ notified: true, recipients: 2 });
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });
      
      expect(transport.sendMail).toHaveBeenCalledTimes(1);
      
      // Verify email content
      const emailOptions = transport.sendMail.mock.calls[0][0];
      expect(emailOptions.from).toBe(process.env.SMTP_FROM);
      expect(emailOptions.to).toBe(process.env.ADMIN_EMAILS);
      expect(emailOptions.subject).toContain('CRITICAL ERROR');
      expect(emailOptions.subject).toContain(criticalError.error_type);
      expect(emailOptions.html).toContain(criticalError.error_message);
      expect(emailOptions.html).toContain(criticalError.url);
      expect(emailOptions.html).toContain(`${process.env.ADMIN_URL}/error-monitoring/${criticalError.id}`);
    });
    
    test('should handle missing SMTP configuration', async () => {
      // Clear SMTP configuration
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASSWORD;
      
      const criticalError = {
        id: 123,
        error_type: 'CRITICAL_ERROR',
        error_message: 'Database connection failed',
        url: 'https://secura.com/admin/dashboard',
        timestamp: '2025-05-01T01:30:00.000Z'
      };
      
      const result = await notifyCriticalError(criticalError);
      
      expect(result).toEqual({ notified: false, error: 'SMTP configuration missing' });
    });
    
    test('should handle missing admin emails', async () => {
      // Clear admin emails
      delete process.env.ADMIN_EMAILS;
      
      const criticalError = {
        id: 123,
        error_type: 'CRITICAL_ERROR',
        error_message: 'Database connection failed',
        url: 'https://secura.com/admin/dashboard',
        timestamp: '2025-05-01T01:30:00.000Z'
      };
      
      const result = await notifyCriticalError(criticalError);
      
      expect(result).toEqual({ notified: false, error: 'No admin emails configured' });
    });
    
    test('should handle SMTP errors', async () => {
      const nodemailer = require('nodemailer');
      
      // Make sendMail throw an error
      nodemailer.createTransport.mockImplementationOnce(() => ({
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP error'))
      }));
      
      const criticalError = {
        id: 123,
        error_type: 'CRITICAL_ERROR',
        error_message: 'Database connection failed',
        url: 'https://secura.com/admin/dashboard',
        timestamp: '2025-05-01T01:30:00.000Z'
      };
      
      const result = await notifyCriticalError(criticalError);
      
      expect(result).toEqual({ notified: false, error: 'SMTP error' });
    });
  });
});
