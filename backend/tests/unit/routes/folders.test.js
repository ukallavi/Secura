/**
 * Unit tests for folder management routes
 */
const request = require('supertest');
const express = require('express');
const folderRoutes = require('../../../routes/folders');
const { db } = require('../../../../database/db');
const { authenticate } = require('../../../middleware/auth');

// Mock dependencies
jest.mock('../../../../database/db', () => {
  const mockDb = {
    select: jest.fn(() => mockDb),
    where: jest.fn(() => mockDb),
    andWhere: jest.fn(() => mockDb),
    first: jest.fn(() => mockDb),
    insert: jest.fn(() => Promise.resolve([1])),
    update: jest.fn(() => Promise.resolve(1)),
    del: jest.fn(() => Promise.resolve(1)),
    orderBy: jest.fn(() => mockDb),
    count: jest.fn(() => mockDb)
  };
  
  return {
    db: jest.fn(table => {
      if (table === 'folders' || table === 'passwords') {
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

// Setup express app for testing
const app = express();
app.use(express.json());
app.use('/api/v1/folders', folderRoutes);

describe('Folder Management Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/v1/folders', () => {
    test('should return a list of folders for the authenticated user', async () => {
      // Mock folders found
      db('folders').select.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 1,
          name: 'Work',
          description: 'Work-related passwords',
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z'
        },
        {
          id: 2,
          user_id: 1,
          name: 'Personal',
          description: 'Personal passwords',
          created_at: '2025-01-02T00:00:00.000Z',
          updated_at: '2025-01-02T00:00:00.000Z'
        }
      ]);
      
      const response = await request(app)
        .get('/api/v1/folders')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      
      // Verify first folder
      expect(response.body[0]).toHaveProperty('id', 1);
      expect(response.body[0]).toHaveProperty('name', 'Work');
      expect(response.body[0]).toHaveProperty('description', 'Work-related passwords');
      
      // Verify second folder
      expect(response.body[1]).toHaveProperty('id', 2);
      expect(response.body[1]).toHaveProperty('name', 'Personal');
      expect(response.body[1]).toHaveProperty('description', 'Personal passwords');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').select).toHaveBeenCalled();
      expect(db('folders').where).toHaveBeenCalledWith('user_id', 1);
      expect(db('folders').orderBy).toHaveBeenCalledWith('name', 'asc');
    });
    
    test('should return an empty array if no folders found', async () => {
      // Mock no folders found
      db('folders').select.mockResolvedValueOnce([]);
      
      const response = await request(app)
        .get('/api/v1/folders')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').select).toHaveBeenCalled();
      expect(db('folders').where).toHaveBeenCalledWith('user_id', 1);
    });
  });
  
  describe('GET /api/v1/folders/:id', () => {
    test('should return a specific folder by ID', async () => {
      // Mock folder found
      db('folders').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Work',
        description: 'Work-related passwords',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      });
      
      // Mock password count
      db('passwords').count.mockResolvedValueOnce([{ count: '5' }]);
      
      const response = await request(app)
        .get('/api/v1/folders/1')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name', 'Work');
      expect(response.body).toHaveProperty('description', 'Work-related passwords');
      expect(response.body).toHaveProperty('passwordCount', 5);
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').where).toHaveBeenCalledWith('id', '1');
      expect(db('folders').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('folders').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('folder_id', 1);
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').count).toHaveBeenCalledWith('id as count');
    });
    
    test('should return 404 if folder not found', async () => {
      // Mock folder not found
      db('folders').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get('/api/v1/folders/999')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Folder not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').where).toHaveBeenCalledWith('id', '999');
      expect(db('folders').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('folders').first).toHaveBeenCalled();
      expect(db).not.toHaveBeenCalledWith('passwords');
    });
  });
  
  describe('POST /api/v1/folders', () => {
    test('should create a new folder', async () => {
      // Mock insert success
      db('folders').insert.mockResolvedValueOnce([1]);
      
      const folderData = {
        name: 'New Folder',
        description: 'A new folder for passwords'
      };
      
      const response = await request(app)
        .post('/api/v1/folders')
        .set('Authorization', 'Bearer valid_token')
        .send(folderData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name', 'New Folder');
      expect(response.body).toHaveProperty('description', 'A new folder for passwords');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 1,
        name: 'New Folder',
        description: 'A new folder for passwords'
      }));
    });
    
    test('should validate required fields', async () => {
      const folderData = {
        // Missing name
        description: 'A new folder for passwords'
      };
      
      const response = await request(app)
        .post('/api/v1/folders')
        .set('Authorization', 'Bearer valid_token')
        .send(folderData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          param: 'name',
          msg: expect.stringContaining('required')
        })
      );
      
      // Verify database calls
      expect(db('folders').insert).not.toHaveBeenCalled();
    });
  });
  
  describe('PUT /api/v1/folders/:id', () => {
    test('should update an existing folder', async () => {
      // Mock folder found
      db('folders').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Work',
        description: 'Work-related passwords'
      });
      
      // Mock update success
      db('folders').update.mockResolvedValueOnce(1);
      
      const updateData = {
        name: 'Updated Folder',
        description: 'Updated description'
      };
      
      const response = await request(app)
        .put('/api/v1/folders/1')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('message', 'Folder updated successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').where).toHaveBeenCalledWith('id', '1');
      expect(db('folders').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('folders').first).toHaveBeenCalled();
      expect(db('folders').update).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Folder',
        description: 'Updated description',
        updated_at: expect.any(String)
      }));
    });
    
    test('should return 404 if folder not found', async () => {
      // Mock folder not found
      db('folders').first.mockResolvedValueOnce(null);
      
      const updateData = {
        name: 'Updated Folder',
        description: 'Updated description'
      };
      
      const response = await request(app)
        .put('/api/v1/folders/999')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Folder not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').where).toHaveBeenCalledWith('id', '999');
      expect(db('folders').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('folders').first).toHaveBeenCalled();
      expect(db('folders').update).not.toHaveBeenCalled();
    });
    
    test('should allow partial updates', async () => {
      // Mock folder found
      db('folders').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Work',
        description: 'Work-related passwords'
      });
      
      // Mock update success
      db('folders').update.mockResolvedValueOnce(1);
      
      const updateData = {
        // Only updating name
        name: 'Updated Folder'
      };
      
      const response = await request(app)
        .put('/api/v1/folders/1')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('message', 'Folder updated successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').update).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Folder',
        updated_at: expect.any(String)
      }));
      // Should not contain description in the update
      expect(db('folders').update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.anything()
        })
      );
    });
  });
  
  describe('DELETE /api/v1/folders/:id', () => {
    test('should delete a folder', async () => {
      // Mock folder found
      db('folders').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Work'
      });
      
      // Mock password count (no passwords in folder)
      db('passwords').count.mockResolvedValueOnce([{ count: '0' }]);
      
      // Mock delete success
      db('folders').del.mockResolvedValueOnce(1);
      
      const response = await request(app)
        .delete('/api/v1/folders/1')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Folder deleted successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').where).toHaveBeenCalledWith('id', '1');
      expect(db('folders').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('folders').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('folder_id', 1);
      expect(db('passwords').count).toHaveBeenCalledWith('id as count');
      
      expect(db('folders').where).toHaveBeenCalledWith('id', '1');
      expect(db('folders').del).toHaveBeenCalled();
    });
    
    test('should return 404 if folder not found', async () => {
      // Mock folder not found
      db('folders').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .delete('/api/v1/folders/999')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Folder not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').where).toHaveBeenCalledWith('id', '999');
      expect(db('folders').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('folders').first).toHaveBeenCalled();
      expect(db('passwords').count).not.toHaveBeenCalled();
      expect(db('folders').del).not.toHaveBeenCalled();
    });
    
    test('should return 400 if folder contains passwords', async () => {
      // Mock folder found
      db('folders').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Work'
      });
      
      // Mock password count (folder has passwords)
      db('passwords').count.mockResolvedValueOnce([{ count: '5' }]);
      
      const response = await request(app)
        .delete('/api/v1/folders/1')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Cannot delete folder that contains passwords');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('folders');
      expect(db('folders').where).toHaveBeenCalledWith('id', '1');
      expect(db('folders').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('folders').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('folder_id', 1);
      expect(db('passwords').count).toHaveBeenCalledWith('id as count');
      
      expect(db('folders').del).not.toHaveBeenCalled();
    });
  });
});
