/**
 * Jest setup file for backend tests
 */

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'secura_test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.ERROR_TRACKING_ENABLED = 'true';
process.env.ERROR_TRACKING_SAMPLING_RATE = '1.0';
process.env.ERROR_TRACKING_MAX_ERRORS = '100';
process.env.ERROR_TRACKING_ANONYMIZE = 'true';
process.env.ERROR_TRACKING_SALT = 'test-salt';
process.env.ADMIN_EMAILS = 'admin@secura.com';
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@secura.com';
process.env.SMTP_PASSWORD = 'test-password';
process.env.SMTP_FROM = 'Secura Test <test@secura.com>';
process.env.ADMIN_URL = 'http://localhost:3000/admin';
process.env.ERROR_RETENTION_DAYS = '90';
process.env.AUDIT_RETENTION_DAYS = '365';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Increase timeout for integration tests
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Any global cleanup needed
});
