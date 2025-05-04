/**
 * Unit tests for authentication routes
 */
const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authRoutes = require('../../../routes/auth');
const { db } = require('../../../../database/db');
const { generateToken } = require('../../../utils/auth');
const { authLimiter } = require('../../../middleware/security');

// Mock dependencies
jest.mock('../../../../database/db', () => {
  const mockDb = {
    select: jest.fn(() => mockDb),
    where: jest.fn(() => mockDb),
    first: jest.fn(() => mockDb),
    insert: jest.fn(() => Promise.resolve([1])),
    update: jest.fn(() => Promise.resolve(1))
  };
  
  return {
    db: jest.fn(table => {
      if (table === 'users') {
        return mockDb;
      }
      return mockDb;
    })
  };
});

jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('hashed_password')),
  compare: jest.fn(() => Promise.resolve(true))
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock_token')
}));

jest.mock('../../../utils/auth', () => ({
  generateToken: jest.fn(() => 'mock_token')
}));

jest.mock('../../../middleware/security', () => ({
  authLimiter: jest.fn((req, res, next) => next())
}));

// Setup express app for testing
const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

describe('Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /api/v1/auth/register', () => {
    test('should register a new user successfully', async () => {
      // Mock user not found (for unique email check)
      db('users').first.mockResolvedValueOnce(null);
      
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('users');
      expect(db('users').where).toHaveBeenCalledWith('email', userData.email);
      expect(db('users').first).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, expect.any(Number));
      expect(db('users').insert).toHaveBeenCalledWith(expect.objectContaining({
        email: userData.email,
        name: userData.name,
        password: 'hashed_password'
      }));
    });
    
    test('should return 400 if email already exists', async () => {
      // Mock user found (email already exists)
      db('users').first.mockResolvedValueOnce({ id: 1, email: 'test@example.com' });
      
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email already in use');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('users');
      expect(db('users').where).toHaveBeenCalledWith('email', userData.email);
      expect(db('users').first).toHaveBeenCalled();
      expect(db('users').insert).not.toHaveBeenCalled();
    });
    
    test('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'Password123!',
        name: 'Test User'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          param: 'email',
          msg: expect.stringContaining('valid email')
        })
      );
    });
    
    test('should validate password strength', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          param: 'password',
          msg: expect.stringContaining('Password must')
        })
      );
    });
  });
  
  describe('POST /api/v1/auth/login', () => {
    test('should login a user successfully', async () => {
      // Mock user found
      db('users').first.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        role: 'user'
      });
      
      // Mock password comparison
      bcrypt.compare.mockResolvedValueOnce(true);
      
      const loginData = {
        email: 'test@example.com',
        password: 'Password123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', 'mock_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', 1);
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.user).toHaveProperty('name', 'Test User');
      expect(response.body.user).not.toHaveProperty('password');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('users');
      expect(db('users').where).toHaveBeenCalledWith('email', loginData.email);
      expect(db('users').first).toHaveBeenCalled();
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, 'hashed_password');
      expect(generateToken).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        email: 'test@example.com',
        role: 'user'
      }));
    });
    
    test('should return 401 if user not found', async () => {
      // Mock user not found
      db('users').first.mockResolvedValueOnce(null);
      
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('users');
      expect(db('users').where).toHaveBeenCalledWith('email', loginData.email);
      expect(db('users').first).toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(generateToken).not.toHaveBeenCalled();
    });
    
    test('should return 401 if password is incorrect', async () => {
      // Mock user found
      db('users').first.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User'
      });
      
      // Mock password comparison (incorrect password)
      bcrypt.compare.mockResolvedValueOnce(false);
      
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('users');
      expect(db('users').where).toHaveBeenCalledWith('email', loginData.email);
      expect(db('users').first).toHaveBeenCalled();
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, 'hashed_password');
      expect(generateToken).not.toHaveBeenCalled();
    });
    
    test('should validate required fields', async () => {
      const loginData = {
        // Missing email and password
      };
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          param: 'email',
          msg: expect.stringContaining('required')
        })
      );
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          param: 'password',
          msg: expect.stringContaining('required')
        })
      );
    });
  });
  
  describe('POST /api/v1/auth/refresh', () => {
    test('should refresh token successfully', async () => {
      // Mock JWT verification
      jwt.verify = jest.fn((token, secret, callback) => {
        callback(null, { id: 1, email: 'test@example.com', role: 'user' });
      });
      
      // Mock user found
      db('users').first.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      });
      
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer valid_refresh_token')
        .send();
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', 'mock_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', 1);
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.user).toHaveProperty('name', 'Test User');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('users');
      expect(db('users').where).toHaveBeenCalledWith('id', 1);
      expect(db('users').first).toHaveBeenCalled();
      expect(generateToken).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        email: 'test@example.com',
        role: 'user'
      }));
    });
    
    test('should return 401 if token is invalid', async () => {
      // Mock JWT verification (invalid token)
      jwt.verify = jest.fn((token, secret, callback) => {
        callback(new Error('Invalid token'), null);
      });
      
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer invalid_token')
        .send();
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid or expired token');
      
      // Verify database calls
      expect(db).not.toHaveBeenCalled();
      expect(generateToken).not.toHaveBeenCalled();
    });
    
    test('should return 401 if user not found', async () => {
      // Mock JWT verification
      jwt.verify = jest.fn((token, secret, callback) => {
        callback(null, { id: 999, email: 'nonexistent@example.com', role: 'user' });
      });
      
      // Mock user not found
      db('users').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer valid_refresh_token')
        .send();
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'User not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('users');
      expect(db('users').where).toHaveBeenCalledWith('id', 999);
      expect(db('users').first).toHaveBeenCalled();
      expect(generateToken).not.toHaveBeenCalled();
    });
    
    test('should return 401 if no token provided', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send();
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No token provided');
      
      // Verify database calls
      expect(db).not.toHaveBeenCalled();
      expect(generateToken).not.toHaveBeenCalled();
    });
  });
});
