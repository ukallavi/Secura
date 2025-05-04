/**
 * Tests for CSRF middleware
 */
const { generateCsrfToken, validateCsrfToken, clearExpiredTokens } = require('../../../middleware/csrf');

describe('CSRF Middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    // Mock request, response, and next function
    req = {
      cookies: {},
      headers: {},
      ip: '127.0.0.1',
      session: {
        id: 'test-session-id'
      }
    };
    
    res = {
      cookie: jest.fn(),
      status: jest.fn(() => res),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    // Reset the token store between tests
    jest.resetModules();
  });
  
  describe('generateCsrfToken', () => {
    test('should generate a CSRF token and set it in the response cookie', () => {
      generateCsrfToken(req, res, next);
      
      // Token should be set in the response cookie
      expect(res.cookie).toHaveBeenCalledWith(
        'csrf_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: expect.any(Boolean),
          sameSite: 'strict',
          maxAge: expect.any(Number)
        })
      );
      
      // Next middleware should be called
      expect(next).toHaveBeenCalled();
      
      // Token should be accessible in the request
      expect(req.csrfToken).toBeDefined();
      expect(typeof req.csrfToken).toBe('string');
    });
    
    test('should reuse existing token if present in cookies', () => {
      const existingToken = 'existing-csrf-token';
      req.cookies.csrf_token = existingToken;
      
      generateCsrfToken(req, res, next);
      
      // Should not set a new cookie
      expect(res.cookie).not.toHaveBeenCalled();
      
      // Next middleware should be called
      expect(next).toHaveBeenCalled();
      
      // Token should be the existing one
      expect(req.csrfToken).toBe(existingToken);
    });
    
    test('should generate a new token if the existing one is invalid', () => {
      const invalidToken = 'invalid-csrf-token';
      req.cookies.csrf_token = invalidToken;
      
      // Mock the token store to not have the invalid token
      jest.doMock('../../../middleware/csrf', () => {
        const original = jest.requireActual('../../../middleware/csrf');
        const tokenStore = new Map();
        return {
          ...original,
          tokenStore
        };
      });
      
      const { generateCsrfToken: newGenerateCsrfToken } = require('../../../middleware/csrf');
      
      newGenerateCsrfToken(req, res, next);
      
      // Should set a new cookie
      expect(res.cookie).toHaveBeenCalled();
      
      // Next middleware should be called
      expect(next).toHaveBeenCalled();
      
      // Token should not be the invalid one
      expect(req.csrfToken).not.toBe(invalidToken);
    });
  });
  
  describe('validateCsrfToken', () => {
    test('should validate a valid CSRF token in the request body', () => {
      // First generate a token
      generateCsrfToken(req, res, next);
      const token = req.csrfToken;
      
      // Reset mocks
      res.status.mockClear();
      res.json.mockClear();
      next.mockClear();
      
      // Set up request with the token
      req.body = { csrf_token: token };
      
      validateCsrfToken(req, res, next);
      
      // Next middleware should be called
      expect(next).toHaveBeenCalled();
      
      // Status and json should not be called
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
    
    test('should validate a valid CSRF token in the request headers', () => {
      // First generate a token
      generateCsrfToken(req, res, next);
      const token = req.csrfToken;
      
      // Reset mocks
      res.status.mockClear();
      res.json.mockClear();
      next.mockClear();
      
      // Set up request with the token in headers
      req.headers['x-csrf-token'] = token;
      
      validateCsrfToken(req, res, next);
      
      // Next middleware should be called
      expect(next).toHaveBeenCalled();
      
      // Status and json should not be called
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
    
    test('should reject a request with no CSRF token', () => {
      validateCsrfToken(req, res, next);
      
      // Next middleware should not be called
      expect(next).not.toHaveBeenCalled();
      
      // Should return 403 Forbidden
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('CSRF token is missing')
      }));
    });
    
    test('should reject a request with an invalid CSRF token', () => {
      // First generate a token
      generateCsrfToken(req, res, next);
      
      // Reset mocks
      res.status.mockClear();
      res.json.mockClear();
      next.mockClear();
      
      // Set up request with an invalid token
      req.body = { csrf_token: 'invalid-token' };
      
      validateCsrfToken(req, res, next);
      
      // Next middleware should not be called
      expect(next).not.toHaveBeenCalled();
      
      // Should return 403 Forbidden
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('Invalid CSRF token')
      }));
    });
    
    test('should reject a request with an expired CSRF token', () => {
      // Mock an expired token
      jest.doMock('../../../middleware/csrf', () => {
        const original = jest.requireActual('../../../middleware/csrf');
        const tokenStore = new Map();
        // Add an expired token (created 1 hour ago)
        const expiredToken = 'expired-token';
        tokenStore.set(expiredToken, {
          sessionId: 'test-session-id',
          ip: '127.0.0.1',
          created: Date.now() - (60 * 60 * 1000 + 1000) // 1 hour and 1 second ago
        });
        return {
          ...original,
          tokenStore
        };
      });
      
      const { validateCsrfToken: newValidateCsrfToken } = require('../../../middleware/csrf');
      
      // Set up request with the expired token
      req.body = { csrf_token: 'expired-token' };
      
      newValidateCsrfToken(req, res, next);
      
      // Next middleware should not be called
      expect(next).not.toHaveBeenCalled();
      
      // Should return 403 Forbidden
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('CSRF token has expired')
      }));
    });
  });
  
  describe('clearExpiredTokens', () => {
    test('should remove expired tokens from the token store', () => {
      // Mock the token store with some expired and valid tokens
      const mockTokenStore = new Map();
      
      // Add expired tokens (created 1 hour ago)
      mockTokenStore.set('expired-token-1', {
        sessionId: 'session-1',
        ip: '127.0.0.1',
        created: Date.now() - (60 * 60 * 1000 + 1000) // 1 hour and 1 second ago
      });
      
      mockTokenStore.set('expired-token-2', {
        sessionId: 'session-2',
        ip: '127.0.0.2',
        created: Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago
      });
      
      // Add valid tokens (created recently)
      mockTokenStore.set('valid-token-1', {
        sessionId: 'session-3',
        ip: '127.0.0.3',
        created: Date.now() - (30 * 60 * 1000) // 30 minutes ago
      });
      
      mockTokenStore.set('valid-token-2', {
        sessionId: 'session-4',
        ip: '127.0.0.4',
        created: Date.now() - (5 * 60 * 1000) // 5 minutes ago
      });
      
      // Mock the module with our token store
      jest.doMock('../../../middleware/csrf', () => {
        const original = jest.requireActual('../../../middleware/csrf');
        return {
          ...original,
          tokenStore: mockTokenStore
        };
      });
      
      const { clearExpiredTokens: newClearExpiredTokens } = require('../../../middleware/csrf');
      
      // Clear expired tokens
      const result = newClearExpiredTokens();
      
      // Should have removed 2 expired tokens
      expect(result).toBe(2);
      
      // Token store should only have the valid tokens
      expect(mockTokenStore.size).toBe(2);
      expect(mockTokenStore.has('expired-token-1')).toBe(false);
      expect(mockTokenStore.has('expired-token-2')).toBe(false);
      expect(mockTokenStore.has('valid-token-1')).toBe(true);
      expect(mockTokenStore.has('valid-token-2')).toBe(true);
    });
    
    test('should handle empty token store', () => {
      // Mock an empty token store
      jest.doMock('../../../middleware/csrf', () => {
        const original = jest.requireActual('../../../middleware/csrf');
        return {
          ...original,
          tokenStore: new Map()
        };
      });
      
      const { clearExpiredTokens: newClearExpiredTokens } = require('../../../middleware/csrf');
      
      // Clear expired tokens
      const result = newClearExpiredTokens();
      
      // Should have removed 0 tokens
      expect(result).toBe(0);
    });
  });
});
