/**
 * Unit tests for password management routes
 */
const request = require('supertest');
const express = require('express');
const passwordRoutes = require('../../../routes/passwords');
const { db } = require('../../../../database/db');
const { authenticate } = require('../../../middleware/auth');
const { encrypt, decrypt } = require('../../../utils/encryption');

// Mock dependencies
jest.mock('../../../../database/db', () => {
  const mockDb = {
    select: jest.fn(() => mockDb),
    where: jest.fn(() => mockDb),
    whereIn: jest.fn(() => mockDb),
    andWhere: jest.fn(() => mockDb),
    first: jest.fn(() => mockDb),
    insert: jest.fn(() => Promise.resolve([1])),
    update: jest.fn(() => Promise.resolve(1)),
    del: jest.fn(() => Promise.resolve(1)),
    orderBy: jest.fn(() => mockDb)
  };
  
  return {
    db: jest.fn(table => {
      if (table === 'passwords' || table === 'folders' || table === 'tags') {
        return mockDb;
      }
      return mockDb;
    })
  };
});

jest.mock('../../../middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'user' };
    next();
  }),
  authorize: jest.fn(roles => (req, res, next) => next())
}));

jest.mock('../../../utils/encryption', () => ({
  encrypt: jest.fn(data => `encrypted_${data}`),
  decrypt: jest.fn(data => data.replace('encrypted_', ''))
}));

// Setup express app for testing
const app = express();
app.use(express.json());
app.use('/api/v1/passwords', passwordRoutes);

describe('Password Management Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/v1/passwords', () => {
    test('should return a list of passwords for the authenticated user', async () => {
      // Mock passwords found
      db('passwords').select.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 1,
          title: 'Test Password',
          username: 'encrypted_testuser',
          password: 'encrypted_testpass',
          url: 'encrypted_https://example.com',
          notes: 'encrypted_test notes',
          folder_id: 1,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z'
        },
        {
          id: 2,
          user_id: 1,
          title: 'Another Password',
          username: 'encrypted_anotheruser',
          password: 'encrypted_anotherpass',
          url: 'encrypted_https://another.com',
          notes: 'encrypted_another notes',
          folder_id: 2,
          created_at: '2025-01-02T00:00:00.000Z',
          updated_at: '2025-01-02T00:00:00.000Z'
        }
      ]);
      
      const response = await request(app)
        .get('/api/v1/passwords')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      
      // Verify first password is decrypted
      expect(response.body[0]).toHaveProperty('id', 1);
      expect(response.body[0]).toHaveProperty('title', 'Test Password');
      expect(response.body[0]).toHaveProperty('username', 'testuser');
      expect(response.body[0]).toHaveProperty('password', 'testpass');
      expect(response.body[0]).toHaveProperty('url', 'https://example.com');
      expect(response.body[0]).toHaveProperty('notes', 'test notes');
      
      // Verify second password is decrypted
      expect(response.body[1]).toHaveProperty('id', 2);
      expect(response.body[1]).toHaveProperty('title', 'Another Password');
      expect(response.body[1]).toHaveProperty('username', 'anotheruser');
      expect(response.body[1]).toHaveProperty('password', 'anotherpass');
      expect(response.body[1]).toHaveProperty('url', 'https://another.com');
      expect(response.body[1]).toHaveProperty('notes', 'another notes');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').select).toHaveBeenCalled();
      expect(db('passwords').where).toHaveBeenCalledWith('user_id', 1);
      expect(decrypt).toHaveBeenCalledTimes(8); // 4 fields x 2 passwords
    });
    
    test('should filter passwords by folder_id', async () => {
      // Mock passwords found
      db('passwords').select.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 1,
          title: 'Test Password',
          username: 'encrypted_testuser',
          password: 'encrypted_testpass',
          url: 'encrypted_https://example.com',
          notes: 'encrypted_test notes',
          folder_id: 1,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z'
        }
      ]);
      
      const response = await request(app)
        .get('/api/v1/passwords?folder_id=1')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').select).toHaveBeenCalled();
      expect(db('passwords').where).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').andWhere).toHaveBeenCalledWith('folder_id', '1');
    });
    
    test('should filter passwords by tag_id', async () => {
      // Mock password_tags found
      db('password_tags').select.mockResolvedValueOnce([
        { password_id: 1 },
        { password_id: 3 }
      ]);
      
      // Mock passwords found
      db('passwords').select.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 1,
          title: 'Test Password',
          username: 'encrypted_testuser',
          password: 'encrypted_testpass',
          url: 'encrypted_https://example.com',
          notes: 'encrypted_test notes',
          folder_id: 1,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z'
        },
        {
          id: 3,
          user_id: 1,
          title: 'Third Password',
          username: 'encrypted_thirduser',
          password: 'encrypted_thirdpass',
          url: 'encrypted_https://third.com',
          notes: 'encrypted_third notes',
          folder_id: 2,
          created_at: '2025-01-03T00:00:00.000Z',
          updated_at: '2025-01-03T00:00:00.000Z'
        }
      ]);
      
      const response = await request(app)
        .get('/api/v1/passwords?tag_id=2')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('password_tags');
      expect(db('password_tags').select).toHaveBeenCalled();
      expect(db('password_tags').where).toHaveBeenCalledWith('tag_id', '2');
      
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').select).toHaveBeenCalled();
      expect(db('passwords').where).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').whereIn).toHaveBeenCalledWith('id', [1, 3]);
    });
    
    test('should return an empty array if no passwords found', async () => {
      // Mock no passwords found
      db('passwords').select.mockResolvedValueOnce([]);
      
      const response = await request(app)
        .get('/api/v1/passwords')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').select).toHaveBeenCalled();
      expect(db('passwords').where).toHaveBeenCalledWith('user_id', 1);
    });
  });
  
  describe('GET /api/v1/passwords/:id', () => {
    test('should return a specific password by ID', async () => {
      // Mock password found
      db('passwords').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        title: 'Test Password',
        username: 'encrypted_testuser',
        password: 'encrypted_testpass',
        url: 'encrypted_https://example.com',
        notes: 'encrypted_test notes',
        folder_id: 1,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      });
      
      const response = await request(app)
        .get('/api/v1/passwords/1')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('title', 'Test Password');
      expect(response.body).toHaveProperty('username', 'testuser');
      expect(response.body).toHaveProperty('password', 'testpass');
      expect(response.body).toHaveProperty('url', 'https://example.com');
      expect(response.body).toHaveProperty('notes', 'test notes');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', '1');
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
      expect(decrypt).toHaveBeenCalledTimes(4); // 4 encrypted fields
    });
    
    test('should return 404 if password not found', async () => {
      // Mock password not found
      db('passwords').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get('/api/v1/passwords/999')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Password not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', '999');
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
    });
    
    test('should return 403 if password belongs to another user', async () => {
      // Mock password found but belongs to another user
      db('passwords').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get('/api/v1/passwords/2')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Password not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', '2');
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/v1/passwords', () => {
    test('should create a new password', async () => {
      // Mock insert success
      db('passwords').insert.mockResolvedValueOnce([1]);
      
      const passwordData = {
        title: 'New Password',
        username: 'newuser',
        password: 'newpass',
        url: 'https://new.com',
        notes: 'new notes',
        folder_id: 1
      };
      
      const response = await request(app)
        .post('/api/v1/passwords')
        .set('Authorization', 'Bearer valid_token')
        .send(passwordData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('title', 'New Password');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 1,
        title: 'New Password',
        username: 'encrypted_newuser',
        password: 'encrypted_newpass',
        url: 'encrypted_https://new.com',
        notes: 'encrypted_new notes',
        folder_id: 1
      }));
      expect(encrypt).toHaveBeenCalledTimes(4); // 4 fields to encrypt
    });
    
    test('should validate required fields', async () => {
      const passwordData = {
        // Missing title and password
        username: 'newuser',
        url: 'https://new.com'
      };
      
      const response = await request(app)
        .post('/api/v1/passwords')
        .set('Authorization', 'Bearer valid_token')
        .send(passwordData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          param: 'title',
          msg: expect.stringContaining('required')
        })
      );
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          param: 'password',
          msg: expect.stringContaining('required')
        })
      );
      
      // Verify database calls
      expect(db('passwords').insert).not.toHaveBeenCalled();
    });
  });
  
  describe('PUT /api/v1/passwords/:id', () => {
    test('should update an existing password', async () => {
      // Mock password found
      db('passwords').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        title: 'Test Password',
        username: 'encrypted_testuser',
        password: 'encrypted_testpass',
        url: 'encrypted_https://example.com',
        notes: 'encrypted_test notes',
        folder_id: 1
      });
      
      // Mock update success
      db('passwords').update.mockResolvedValueOnce(1);
      
      const updateData = {
        title: 'Updated Password',
        username: 'updateduser',
        password: 'updatedpass',
        url: 'https://updated.com',
        notes: 'updated notes',
        folder_id: 2
      };
      
      const response = await request(app)
        .put('/api/v1/passwords/1')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('message', 'Password updated successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', '1');
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
      expect(db('passwords').update).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Updated Password',
        username: 'encrypted_updateduser',
        password: 'encrypted_updatedpass',
        url: 'encrypted_https://updated.com',
        notes: 'encrypted_updated notes',
        folder_id: 2,
        updated_at: expect.any(String)
      }));
      expect(encrypt).toHaveBeenCalledTimes(4); // 4 fields to encrypt
    });
    
    test('should return 404 if password not found', async () => {
      // Mock password not found
      db('passwords').first.mockResolvedValueOnce(null);
      
      const updateData = {
        title: 'Updated Password',
        password: 'updatedpass'
      };
      
      const response = await request(app)
        .put('/api/v1/passwords/999')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Password not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', '999');
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
      expect(db('passwords').update).not.toHaveBeenCalled();
    });
    
    test('should allow partial updates', async () => {
      // Mock password found
      db('passwords').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        title: 'Test Password',
        username: 'encrypted_testuser',
        password: 'encrypted_testpass',
        url: 'encrypted_https://example.com',
        notes: 'encrypted_test notes',
        folder_id: 1
      });
      
      // Mock update success
      db('passwords').update.mockResolvedValueOnce(1);
      
      const updateData = {
        // Only updating title and password
        title: 'Updated Password',
        password: 'updatedpass'
      };
      
      const response = await request(app)
        .put('/api/v1/passwords/1')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('message', 'Password updated successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').update).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Updated Password',
        password: 'encrypted_updatedpass',
        updated_at: expect.any(String)
      }));
      expect(encrypt).toHaveBeenCalledTimes(1); // Only password is encrypted
    });
  });
  
  describe('DELETE /api/v1/passwords/:id', () => {
    test('should delete a password', async () => {
      // Mock password found
      db('passwords').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        title: 'Test Password'
      });
      
      // Mock delete success
      db('passwords').del.mockResolvedValueOnce(1);
      
      const response = await request(app)
        .delete('/api/v1/passwords/1')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Password deleted successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', '1');
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
      expect(db('passwords').where).toHaveBeenCalledWith('id', '1');
      expect(db('passwords').del).toHaveBeenCalled();
    });
    
    test('should return 404 if password not found', async () => {
      // Mock password not found
      db('passwords').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .delete('/api/v1/passwords/999')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Password not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', '999');
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
      expect(db('passwords').del).not.toHaveBeenCalled();
    });
  });
});
