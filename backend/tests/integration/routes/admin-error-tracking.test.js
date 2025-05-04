/**
 * Integration tests for admin error tracking routes
 * Tests the admin dashboard API endpoints
 */
const request = require('supertest');
const express = require('express');
const adminErrorTrackingRoutes = require('../../../routes/admin/error-tracking');
const { db } = require('../../../../database/db');
const { authenticate } = require('../../../middleware/auth');

// Mock dependencies
jest.mock('../../../middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 'admin-user', role: 'admin' };
    next();
  }),
  authorize: jest.fn(roles => (req, res, next) => next())
}));

jest.mock('../../../../database/db', () => {
  const mockDb = {
    select: jest.fn(() => mockDb),
    count: jest.fn(() => mockDb),
    where: jest.fn(() => mockDb),
    whereIn: jest.fn(() => mockDb),
    whereBetween: jest.fn(() => mockDb),
    whereRaw: jest.fn(() => mockDb),
    orderBy: jest.fn(() => mockDb),
    groupBy: jest.fn(() => mockDb),
    limit: jest.fn(() => mockDb),
    offset: jest.fn(() => mockDb),
    first: jest.fn(() => mockDb),
    update: jest.fn(() => Promise.resolve(1)),
    del: jest.fn(() => Promise.resolve(1)),
    raw: jest.fn(() => mockDb),
    join: jest.fn(() => mockDb),
    leftJoin: jest.fn(() => mockDb),
    countDistinct: jest.fn(() => mockDb),
    as: jest.fn(() => mockDb)
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
app.use('/api/v1/admin/error-tracking', adminErrorTrackingRoutes);

describe('Admin Error Tracking Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database responses
    const mockDb = db('error_logs');
    
    // Mock for GET /errors
    mockDb.select.mockImplementation(() => mockDb);
    mockDb.count.mockImplementation(() => Promise.resolve([{ count: 100 }]));
    mockDb.orderBy.mockImplementation(() => mockDb);
    mockDb.limit.mockImplementation(() => mockDb);
    mockDb.offset.mockImplementation(() => mockDb);
    mockDb.where.mockImplementation(() => mockDb);
    
    // Mock for GET /errors/:id
    mockDb.first.mockImplementation(() => Promise.resolve({
      id: 1,
      error_type: 'TEST_ERROR',
      error_message: 'Test error message',
      error_stack: 'Error: Test error message\n    at test (/app/test.js:1:1)',
      url: 'https://secura.com/test',
      context: JSON.stringify({ test: true }),
      user_id: 'anonymized-user-123',
      user_agent: 'Mozilla/5.0',
      ip_address: '127.0.0.1',
      created_at: '2025-05-01T01:00:00.000Z',
      environment: 'production',
      service: 'frontend',
      trace_id: 'trace-123',
      is_resolved: false
    }));
    
    // Mock for PUT /errors/:id
    mockDb.update.mockImplementation(() => Promise.resolve(1));
    
    // Mock for DELETE /errors/:id
    mockDb.del.mockImplementation(() => Promise.resolve(1));
    
    // Mock for GET /analytics
    mockDb.groupBy.mockImplementation(() => mockDb);
    mockDb.countDistinct.mockImplementation(() => mockDb);
    mockDb.as.mockImplementation(() => mockDb);
    mockDb.raw.mockImplementation(() => Promise.resolve([
      { date: '2025-05-01', count: 10 },
      { date: '2025-04-30', count: 15 },
      { date: '2025-04-29', count: 8 }
    ]));
  });
  
  describe('GET /api/v1/admin/error-tracking/errors', () => {
    test('should return a list of errors with pagination', async () => {
      // Mock the database response for the list of errors
      db('error_logs').select.mockReturnValueOnce(Promise.resolve([
        {
          id: 1,
          error_type: 'TEST_ERROR',
          error_message: 'Test error message',
          url: 'https://secura.com/test',
          created_at: '2025-05-01T01:00:00.000Z',
          environment: 'production',
          service: 'frontend',
          is_resolved: false
        },
        {
          id: 2,
          error_type: 'VALIDATION_ERROR',
          error_message: 'Validation failed',
          url: 'https://secura.com/form',
          created_at: '2025-04-30T23:00:00.000Z',
          environment: 'production',
          service: 'frontend',
          is_resolved: true
        }
      ]));
      
      const response = await request(app)
        .get('/api/v1/admin/error-tracking/errors')
        .query({ page: 1, limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.errors).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        total: 100,
        page: 1,
        limit: 10,
        pages: 10
      });
      
      // Verify the correct queries were made
      expect(db).toHaveBeenCalledWith('error_logs');
      expect(db('error_logs').select).toHaveBeenCalled();
      expect(db('error_logs').count).toHaveBeenCalled();
      expect(db('error_logs').orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(db('error_logs').limit).toHaveBeenCalledWith(10);
      expect(db('error_logs').offset).toHaveBeenCalledWith(0);
    });
    
    test('should filter errors by type', async () => {
      await request(app)
        .get('/api/v1/admin/error-tracking/errors')
        .query({ page: 1, limit: 10, type: 'VALIDATION_ERROR' });
      
      expect(db('error_logs').where).toHaveBeenCalledWith('error_type', 'VALIDATION_ERROR');
    });
    
    test('should filter errors by environment', async () => {
      await request(app)
        .get('/api/v1/admin/error-tracking/errors')
        .query({ page: 1, limit: 10, environment: 'production' });
      
      expect(db('error_logs').where).toHaveBeenCalledWith('environment', 'production');
    });
    
    test('should filter errors by service', async () => {
      await request(app)
        .get('/api/v1/admin/error-tracking/errors')
        .query({ page: 1, limit: 10, service: 'frontend' });
      
      expect(db('error_logs').where).toHaveBeenCalledWith('service', 'frontend');
    });
    
    test('should filter errors by resolution status', async () => {
      await request(app)
        .get('/api/v1/admin/error-tracking/errors')
        .query({ page: 1, limit: 10, resolved: 'true' });
      
      expect(db('error_logs').where).toHaveBeenCalledWith('is_resolved', true);
    });
    
    test('should filter errors by date range', async () => {
      const startDate = '2025-04-01';
      const endDate = '2025-05-01';
      
      await request(app)
        .get('/api/v1/admin/error-tracking/errors')
        .query({ page: 1, limit: 10, startDate, endDate });
      
      expect(db('error_logs').whereBetween).toHaveBeenCalledWith('created_at', [startDate, endDate]);
    });
  });
  
  describe('GET /api/v1/admin/error-tracking/errors/:id', () => {
    test('should return error details by ID', async () => {
      const response = await request(app)
        .get('/api/v1/admin/error-tracking/errors/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('error_type', 'TEST_ERROR');
      expect(response.body).toHaveProperty('error_message', 'Test error message');
      expect(response.body).toHaveProperty('context', { test: true });
      
      expect(db).toHaveBeenCalledWith('error_logs');
      expect(db('error_logs').where).toHaveBeenCalledWith('id', '1');
      expect(db('error_logs').first).toHaveBeenCalled();
    });
    
    test('should handle non-existent error ID', async () => {
      // Mock error not found
      db('error_logs').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get('/api/v1/admin/error-tracking/errors/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Error not found');
    });
  });
  
  describe('PUT /api/v1/admin/error-tracking/errors/:id', () => {
    test('should update error resolution status', async () => {
      const updateData = {
        is_resolved: true,
        resolution_notes: 'Fixed in version 1.2.3'
      };
      
      const response = await request(app)
        .put('/api/v1/admin/error-tracking/errors/1')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Error updated successfully');
      
      expect(db).toHaveBeenCalledWith('error_logs');
      expect(db('error_logs').where).toHaveBeenCalledWith('id', '1');
      expect(db('error_logs').update).toHaveBeenCalledWith({
        is_resolved: true,
        resolution_notes: 'Fixed in version 1.2.3',
        resolved_at: expect.any(String),
        resolved_by: 'admin-user'
      });
    });
    
    test('should handle non-existent error ID', async () => {
      // Mock error not found
      db('error_logs').update.mockResolvedValueOnce(0);
      
      const response = await request(app)
        .put('/api/v1/admin/error-tracking/errors/999')
        .send({ is_resolved: true });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Error not found');
    });
  });
  
  describe('DELETE /api/v1/admin/error-tracking/errors/:id', () => {
    test('should delete an error', async () => {
      const response = await request(app)
        .delete('/api/v1/admin/error-tracking/errors/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Error deleted successfully');
      
      expect(db).toHaveBeenCalledWith('error_logs');
      expect(db('error_logs').where).toHaveBeenCalledWith('id', '1');
      expect(db('error_logs').del).toHaveBeenCalled();
    });
    
    test('should handle non-existent error ID', async () => {
      // Mock error not found
      db('error_logs').del.mockResolvedValueOnce(0);
      
      const response = await request(app)
        .delete('/api/v1/admin/error-tracking/errors/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Error not found');
    });
  });
  
  describe('GET /api/v1/admin/error-tracking/analytics', () => {
    test('should return error analytics data', async () => {
      // Mock analytics data
      const mockAnalyticsData = {
        totalErrors: 100,
        criticalErrors: 25,
        criticalErrorsPercentage: 25,
        resolvedErrors: 40,
        resolvedPercentage: 40,
        mostCommonError: {
          type: 'VALIDATION_ERROR',
          count: 35
        },
        latestError: {
          type: 'API_ERROR',
          timestamp: '2025-05-01T01:00:00.000Z'
        },
        trends: [
          { date: '2025-05-01', count: 10 },
          { date: '2025-04-30', count: 15 },
          { date: '2025-04-29', count: 8 }
        ],
        byType: [
          { type: 'VALIDATION_ERROR', count: 35 },
          { type: 'API_ERROR', count: 25 },
          { type: 'UI_ERROR', count: 20 },
          { type: 'NETWORK_ERROR', count: 15 },
          { type: 'UNKNOWN_ERROR', count: 5 }
        ],
        byEnvironment: [
          { environment: 'production', count: 60 },
          { environment: 'staging', count: 30 },
          { environment: 'development', count: 10 }
        ],
        byService: [
          { service: 'frontend', count: 70 },
          { service: 'backend', count: 25 },
          { service: 'mobile-app', count: 5 }
        ]
      };
      
      // Mock the raw query results
      db('error_logs').raw.mockImplementation((query) => {
        if (query.includes('GROUP BY DATE(created_at)')) {
          return Promise.resolve(mockAnalyticsData.trends);
        } else if (query.includes('GROUP BY error_type')) {
          return Promise.resolve(mockAnalyticsData.byType);
        } else if (query.includes('GROUP BY environment')) {
          return Promise.resolve(mockAnalyticsData.byEnvironment);
        } else if (query.includes('GROUP BY service')) {
          return Promise.resolve(mockAnalyticsData.byService);
        }
        return Promise.resolve([]);
      });
      
      // Mock count queries
      db('error_logs').count.mockImplementation(() => {
        return Promise.resolve([{ count: mockAnalyticsData.totalErrors }]);
      });
      
      db('error_logs').where.mockImplementation((field, value) => {
        if (field === 'is_resolved' && value === true) {
          return {
            count: () => Promise.resolve([{ count: mockAnalyticsData.resolvedErrors }])
          };
        } else if (field === 'error_type' && value === 'CRITICAL_ERROR') {
          return {
            count: () => Promise.resolve([{ count: mockAnalyticsData.criticalErrors }])
          };
        }
        return mockDb;
      });
      
      const response = await request(app)
        .get('/api/v1/admin/error-tracking/analytics')
        .query({ timeRange: '7d' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalErrors');
      expect(response.body).toHaveProperty('criticalErrors');
      expect(response.body).toHaveProperty('resolvedErrors');
      expect(response.body).toHaveProperty('trends');
      expect(response.body).toHaveProperty('byType');
      expect(response.body).toHaveProperty('byEnvironment');
      expect(response.body).toHaveProperty('byService');
    });
    
    test('should filter analytics by time range', async () => {
      await request(app)
        .get('/api/v1/admin/error-tracking/analytics')
        .query({ timeRange: '30d' });
      
      expect(db('error_logs').whereRaw).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)'),
        [30]
      );
    });
    
    test('should filter analytics by environment', async () => {
      await request(app)
        .get('/api/v1/admin/error-tracking/analytics')
        .query({ timeRange: '7d', environment: 'production' });
      
      expect(db('error_logs').where).toHaveBeenCalledWith('environment', 'production');
    });
    
    test('should filter analytics by service', async () => {
      await request(app)
        .get('/api/v1/admin/error-tracking/analytics')
        .query({ timeRange: '7d', service: 'frontend' });
      
      expect(db('error_logs').where).toHaveBeenCalledWith('service', 'frontend');
    });
    
    test('should filter analytics by error types', async () => {
      await request(app)
        .get('/api/v1/admin/error-tracking/analytics')
        .query({ timeRange: '7d', errorTypes: 'VALIDATION_ERROR,API_ERROR' });
      
      expect(db('error_logs').whereIn).toHaveBeenCalledWith('error_type', ['VALIDATION_ERROR', 'API_ERROR']);
    });
  });
});
