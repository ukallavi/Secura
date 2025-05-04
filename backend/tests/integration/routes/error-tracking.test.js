/**
 * Integration tests for error-tracking.js routes
 * Tests the error reporting and analytics endpoints
 */
const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const errorTrackingRoutes = require('../../../routes/error-tracking');
const { db } = require('../../../../database/db');
const { validateCsrfToken } = require('../../../middleware/csrf');

// Mock dependencies
jest.mock('../../../middleware/csrf', () => ({
  validateCsrfToken: jest.fn((req, res, next) => next())
}));

jest.mock('../../../utils/error-sanitizer', () => ({
  sanitizeErrorData: jest.fn(data => data),
  anonymizeUserId: jest.fn(userId => userId ? `anonymized-${userId}` : 'anonymous')
}));

jest.mock('../../../utils/error-notifications', () => ({
  isCriticalError: jest.fn(error => error.error_type === 'CRITICAL_ERROR'),
  notifyCriticalError: jest.fn(() => Promise.resolve({ notified: true }))
}));

jest.mock('../../../utils/external-monitoring', () => ({
  isExternalMonitoringEnabled: jest.fn(() => false),
  reportToExternalMonitoring: jest.fn(() => Promise.resolve())
}));

jest.mock('../../../../database/db', () => {
  const mockDb = {
    insert: jest.fn(() => Promise.resolve([1])),
    select: jest.fn(() => mockDb),
    count: jest.fn(() => mockDb),
    where: jest.fn(() => mockDb),
    whereIn: jest.fn(() => mockDb),
    whereBetween: jest.fn(() => mockDb),
    orderBy: jest.fn(() => mockDb),
    groupBy: jest.fn(() => mockDb),
    limit: jest.fn(() => mockDb),
    offset: jest.fn(() => mockDb),
    first: jest.fn(() => mockDb),
    update: jest.fn(() => Promise.resolve(1)),
    del: jest.fn(() => Promise.resolve(1)),
    raw: jest.fn(() => mockDb),
    fn: {
      now: jest.fn(() => 'CURRENT_TIMESTAMP')
    }
  };
  
  return {
    db: jest.fn(table => {
      if (table === 'error_logs') {
        return mockDb;
      }
      return mockDb;
    })
  };
});

// Setup express app for testing
const app = express();
app.use(express.json());
app.use('/api/v1/error-tracking', errorTrackingRoutes);

describe('Error Tracking Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /api/v1/error-tracking', () => {
    test('should successfully report an error', async () => {
      const errorData = {
        error_type: 'VALIDATION_ERROR',
        error_message: 'Invalid input',
        error_stack: 'Error: Invalid input\n    at validateInput (/app/src/utils/validation.js:42:11)',
        url: 'https://secura.com/dashboard',
        context: {
          formData: {
            username: 'testuser'
          }
        },
        session_id: uuidv4(),
        user_id: 'user-123',
        csrf_token: 'valid-token'
      };
      
      const response = await request(app)
        .post('/api/v1/error-tracking')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send(errorData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('id');
      
      // Verify DB was called with correct data
      expect(db).toHaveBeenCalledWith('error_logs');
      expect(db('error_logs').insert).toHaveBeenCalled();
    });
    
    test('should handle critical errors and send notifications', async () => {
      const { isCriticalError, notifyCriticalError } = require('../../../utils/error-notifications');
      isCriticalError.mockReturnValueOnce(true);
      
      const criticalErrorData = {
        error_type: 'CRITICAL_ERROR',
        error_message: 'Database connection failed',
        error_stack: 'Error: Database connection failed\n    at connectDb (/app/src/database/db.js:25:11)',
        url: 'https://secura.com/admin',
        context: {
          dbHost: 'db.secura.com'
        },
        session_id: uuidv4(),
        user_id: 'admin-user',
        csrf_token: 'valid-token'
      };
      
      const response = await request(app)
        .post('/api/v1/error-tracking')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send(criticalErrorData);
      
      expect(response.status).toBe(201);
      expect(isCriticalError).toHaveBeenCalled();
      expect(notifyCriticalError).toHaveBeenCalled();
    });
    
    test('should validate required fields', async () => {
      const incompleteErrorData = {
        // Missing required fields
        error_message: 'Invalid input',
        csrf_token: 'valid-token'
      };
      
      const response = await request(app)
        .post('/api/v1/error-tracking')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send(incompleteErrorData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
    
    test('should validate CSRF token', async () => {
      validateCsrfToken.mockImplementationOnce((req, res, next) => {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      });
      
      const errorData = {
        error_type: 'VALIDATION_ERROR',
        error_message: 'Invalid input',
        error_stack: 'Error: Invalid input\n    at validateInput (/app/src/utils/validation.js:42:11)',
        url: 'https://secura.com/dashboard',
        context: {},
        session_id: uuidv4(),
        csrf_token: 'invalid-token'
      };
      
      const response = await request(app)
        .post('/api/v1/error-tracking')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send(errorData);
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Invalid CSRF token');
    });
  });
  
  describe('GET /api/v1/error-tracking/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/error-tracking/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
  
  describe('GET /api/v1/error-tracking/stats', () => {
    test('should return error statistics', async () => {
      // Mock DB response for stats
      const mockDb = db('error_logs');
      mockDb.count.mockReturnValueOnce(Promise.resolve([{ count: 100 }]));
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.count.mockReturnValueOnce(Promise.resolve([{ count: 25 }]));
      
      const response = await request(app)
        .get('/api/v1/error-tracking/stats');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalErrors');
      expect(response.body).toHaveProperty('resolvedErrors');
      expect(response.body).toHaveProperty('criticalErrors');
    });
  });
});
