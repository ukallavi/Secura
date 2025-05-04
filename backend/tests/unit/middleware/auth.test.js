/**
 * Unit tests for authentication middleware
 */
const { authenticate, authorize } = require('../../../middleware/auth');
const jwt = require('jsonwebtoken');
const { db } = require('../../../../database/db');

// Mock dependencies
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

jest.mock('../../../../database/db', () => {
  const mockDb = {
    select: jest.fn(() => mockDb),
    where: jest.fn(() => mockDb),
    first: jest.fn(() => mockDb)
  };
  
  return {
    db: jest.fn(() => mockDb)
  };
});

describe('Authentication Middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock request, response, and next function
    req = {
      headers: {},
      user: null
    };
    
    res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res)
    };
    
    next = jest.fn();
    
    // Set environment variable
    process.env.JWT_SECRET = 'test-jwt-secret';
  });
  
  describe('authenticate', () => {
    test('should call next() when valid token is provided', async () => {
      // Mock token in request
      req.headers.authorization = 'Bearer valid_token';
      
      // Mock JWT verification
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { id: 1, email: 'test@example.com', role: 'user' });
      });
      
      // Mock user found in database
      db().first.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      });
      
      // Call the middleware
      await authenticate(req, res, next);
      
      // Verify JWT was verified with correct parameters
      expect(jwt.verify).toHaveBeenCalledWith(
        'valid_token',
        'test-jwt-secret',
        expect.any(Function)
      );
      
      // Verify database was queried
      expect(db).toHaveBeenCalledWith('users');
      expect(db().where).toHaveBeenCalledWith('id', 1);
      expect(db().first).toHaveBeenCalled();
      
      // Verify user was set on request
      expect(req.user).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      });
      
      // Verify next was called
      expect(next).toHaveBeenCalled();
      
      // Verify response methods were not called
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
    
    test('should return 401 when no token is provided', async () => {
      // No authorization header
      
      // Call the middleware
      await authenticate(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      
      // Verify JWT was not verified
      expect(jwt.verify).not.toHaveBeenCalled();
      
      // Verify database was not queried
      expect(db).not.toHaveBeenCalled();
      
      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 401 when token format is invalid', async () => {
      // Invalid token format
      req.headers.authorization = 'InvalidFormat';
      
      // Call the middleware
      await authenticate(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token format' });
      
      // Verify JWT was not verified
      expect(jwt.verify).not.toHaveBeenCalled();
      
      // Verify database was not queried
      expect(db).not.toHaveBeenCalled();
      
      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 401 when token is invalid', async () => {
      // Mock token in request
      req.headers.authorization = 'Bearer invalid_token';
      
      // Mock JWT verification error
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('Invalid token'), null);
      });
      
      // Call the middleware
      await authenticate(req, res, next);
      
      // Verify JWT was verified with correct parameters
      expect(jwt.verify).toHaveBeenCalledWith(
        'invalid_token',
        'test-jwt-secret',
        expect.any(Function)
      );
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      
      // Verify database was not queried
      expect(db).not.toHaveBeenCalled();
      
      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 401 when user is not found in database', async () => {
      // Mock token in request
      req.headers.authorization = 'Bearer valid_token';
      
      // Mock JWT verification
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { id: 999, email: 'nonexistent@example.com', role: 'user' });
      });
      
      // Mock user not found in database
      db().first.mockResolvedValueOnce(null);
      
      // Call the middleware
      await authenticate(req, res, next);
      
      // Verify JWT was verified
      expect(jwt.verify).toHaveBeenCalled();
      
      // Verify database was queried
      expect(db).toHaveBeenCalledWith('users');
      expect(db().where).toHaveBeenCalledWith('id', 999);
      expect(db().first).toHaveBeenCalled();
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
      
      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe('authorize', () => {
    test('should call next() when user has required role', () => {
      // Set user with admin role
      req.user = {
        id: 1,
        email: 'admin@example.com',
        role: 'admin'
      };
      
      // Create middleware for admin role
      const adminMiddleware = authorize(['admin']);
      
      // Call the middleware
      adminMiddleware(req, res, next);
      
      // Verify next was called
      expect(next).toHaveBeenCalled();
      
      // Verify response methods were not called
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
    
    test('should call next() when user has one of multiple required roles', () => {
      // Set user with editor role
      req.user = {
        id: 1,
        email: 'editor@example.com',
        role: 'editor'
      };
      
      // Create middleware for admin or editor roles
      const middleware = authorize(['admin', 'editor']);
      
      // Call the middleware
      middleware(req, res, next);
      
      // Verify next was called
      expect(next).toHaveBeenCalled();
      
      // Verify response methods were not called
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
    
    test('should return 403 when user does not have required role', () => {
      // Set user with user role
      req.user = {
        id: 1,
        email: 'user@example.com',
        role: 'user'
      };
      
      // Create middleware for admin role
      const adminMiddleware = authorize(['admin']);
      
      // Call the middleware
      adminMiddleware(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      
      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 403 when user object is missing', () => {
      // No user object (should have been set by authenticate middleware)
      req.user = null;
      
      // Create middleware for any role
      const middleware = authorize(['admin', 'user']);
      
      // Call the middleware
      middleware(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      
      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });
  });
});
