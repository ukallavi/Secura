/**
 * Unit tests for tag management routes
 */
const request = require('supertest');
const express = require('express');
const tagRoutes = require('../../../routes/tags');
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
    count: jest.fn(() => mockDb),
    join: jest.fn(() => mockDb),
    groupBy: jest.fn(() => mockDb)
  };
  
  return {
    db: jest.fn(table => {
      if (table === 'tags' || table === 'password_tags' || table === 'passwords') {
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
app.use('/api/v1/tags', tagRoutes);

describe('Tag Management Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/v1/tags', () => {
    test('should return a list of tags for the authenticated user', async () => {
      // Mock tags found
      db('tags').select.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 1,
          name: 'Important',
          color: '#ff0000',
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z'
        },
        {
          id: 2,
          user_id: 1,
          name: 'Social',
          color: '#0000ff',
          created_at: '2025-01-02T00:00:00.000Z',
          updated_at: '2025-01-02T00:00:00.000Z'
        }
      ]);
      
      const response = await request(app)
        .get('/api/v1/tags')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      
      // Verify first tag
      expect(response.body[0]).toHaveProperty('id', 1);
      expect(response.body[0]).toHaveProperty('name', 'Important');
      expect(response.body[0]).toHaveProperty('color', '#ff0000');
      
      // Verify second tag
      expect(response.body[1]).toHaveProperty('id', 2);
      expect(response.body[1]).toHaveProperty('name', 'Social');
      expect(response.body[1]).toHaveProperty('color', '#0000ff');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').select).toHaveBeenCalled();
      expect(db('tags').where).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').orderBy).toHaveBeenCalledWith('name', 'asc');
    });
    
    test('should return an empty array if no tags found', async () => {
      // Mock no tags found
      db('tags').select.mockResolvedValueOnce([]);
      
      const response = await request(app)
        .get('/api/v1/tags')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').select).toHaveBeenCalled();
      expect(db('tags').where).toHaveBeenCalledWith('user_id', 1);
    });
  });
  
  describe('GET /api/v1/tags/:id', () => {
    test('should return a specific tag by ID', async () => {
      // Mock tag found
      db('tags').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Important',
        color: '#ff0000',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      });
      
      // Mock password count
      db('password_tags').count.mockResolvedValueOnce([{ count: '3' }]);
      
      const response = await request(app)
        .get('/api/v1/tags/1')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name', 'Important');
      expect(response.body).toHaveProperty('color', '#ff0000');
      expect(response.body).toHaveProperty('passwordCount', 3);
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '1');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('password_tags');
      expect(db('password_tags').where).toHaveBeenCalledWith('tag_id', 1);
      expect(db('password_tags').count).toHaveBeenCalledWith('id as count');
    });
    
    test('should return 404 if tag not found', async () => {
      // Mock tag not found
      db('tags').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get('/api/v1/tags/999')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Tag not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '999');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      expect(db).not.toHaveBeenCalledWith('password_tags');
    });
  });
  
  describe('POST /api/v1/tags', () => {
    test('should create a new tag', async () => {
      // Mock insert success
      db('tags').insert.mockResolvedValueOnce([1]);
      
      const tagData = {
        name: 'New Tag',
        color: '#00ff00'
      };
      
      const response = await request(app)
        .post('/api/v1/tags')
        .set('Authorization', 'Bearer valid_token')
        .send(tagData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name', 'New Tag');
      expect(response.body).toHaveProperty('color', '#00ff00');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 1,
        name: 'New Tag',
        color: '#00ff00'
      }));
    });
    
    test('should validate required fields', async () => {
      const tagData = {
        // Missing name
        color: '#00ff00'
      };
      
      const response = await request(app)
        .post('/api/v1/tags')
        .set('Authorization', 'Bearer valid_token')
        .send(tagData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          param: 'name',
          msg: expect.stringContaining('required')
        })
      );
      
      // Verify database calls
      expect(db('tags').insert).not.toHaveBeenCalled();
    });
    
    test('should validate color format', async () => {
      const tagData = {
        name: 'New Tag',
        color: 'invalid-color'
      };
      
      const response = await request(app)
        .post('/api/v1/tags')
        .set('Authorization', 'Bearer valid_token')
        .send(tagData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          param: 'color',
          msg: expect.stringContaining('valid color')
        })
      );
      
      // Verify database calls
      expect(db('tags').insert).not.toHaveBeenCalled();
    });
  });
  
  describe('PUT /api/v1/tags/:id', () => {
    test('should update an existing tag', async () => {
      // Mock tag found
      db('tags').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Important',
        color: '#ff0000'
      });
      
      // Mock update success
      db('tags').update.mockResolvedValueOnce(1);
      
      const updateData = {
        name: 'Updated Tag',
        color: '#00ff00'
      };
      
      const response = await request(app)
        .put('/api/v1/tags/1')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('message', 'Tag updated successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '1');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      expect(db('tags').update).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Tag',
        color: '#00ff00',
        updated_at: expect.any(String)
      }));
    });
    
    test('should return 404 if tag not found', async () => {
      // Mock tag not found
      db('tags').first.mockResolvedValueOnce(null);
      
      const updateData = {
        name: 'Updated Tag',
        color: '#00ff00'
      };
      
      const response = await request(app)
        .put('/api/v1/tags/999')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Tag not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '999');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      expect(db('tags').update).not.toHaveBeenCalled();
    });
    
    test('should allow partial updates', async () => {
      // Mock tag found
      db('tags').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Important',
        color: '#ff0000'
      });
      
      // Mock update success
      db('tags').update.mockResolvedValueOnce(1);
      
      const updateData = {
        // Only updating name
        name: 'Updated Tag'
      };
      
      const response = await request(app)
        .put('/api/v1/tags/1')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('message', 'Tag updated successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').update).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Tag',
        updated_at: expect.any(String)
      }));
      // Should not contain color in the update
      expect(db('tags').update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          color: expect.anything()
        })
      );
    });
  });
  
  describe('DELETE /api/v1/tags/:id', () => {
    test('should delete a tag', async () => {
      // Mock tag found
      db('tags').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Important'
      });
      
      // Mock delete success for password_tags
      db('password_tags').del.mockResolvedValueOnce(3);
      
      // Mock delete success for tag
      db('tags').del.mockResolvedValueOnce(1);
      
      const response = await request(app)
        .delete('/api/v1/tags/1')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Tag deleted successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '1');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('password_tags');
      expect(db('password_tags').where).toHaveBeenCalledWith('tag_id', 1);
      expect(db('password_tags').del).toHaveBeenCalled();
      
      expect(db('tags').where).toHaveBeenCalledWith('id', '1');
      expect(db('tags').del).toHaveBeenCalled();
    });
    
    test('should return 404 if tag not found', async () => {
      // Mock tag not found
      db('tags').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .delete('/api/v1/tags/999')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Tag not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '999');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      expect(db('password_tags').del).not.toHaveBeenCalled();
      expect(db('tags').del).not.toHaveBeenCalled();
    });
  });
  
  describe('POST /api/v1/tags/:id/passwords', () => {
    test('should add a password to a tag', async () => {
      // Mock tag found
      db('tags').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Important'
      });
      
      // Mock password found
      db('passwords').first.mockResolvedValueOnce({
        id: 2,
        user_id: 1,
        title: 'Test Password'
      });
      
      // Mock password_tag not found (to avoid duplicate)
      db('password_tags').first.mockResolvedValueOnce(null);
      
      // Mock insert success
      db('password_tags').insert.mockResolvedValueOnce([1]);
      
      const response = await request(app)
        .post('/api/v1/tags/1/passwords')
        .set('Authorization', 'Bearer valid_token')
        .send({ password_id: 2 });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Password added to tag successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '1');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', 2);
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('password_tags');
      expect(db('password_tags').where).toHaveBeenCalledWith('tag_id', 1);
      expect(db('password_tags').andWhere).toHaveBeenCalledWith('password_id', 2);
      expect(db('password_tags').first).toHaveBeenCalled();
      
      expect(db('password_tags').insert).toHaveBeenCalledWith({
        tag_id: 1,
        password_id: 2
      });
    });
    
    test('should return 404 if tag not found', async () => {
      // Mock tag not found
      db('tags').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/api/v1/tags/999/passwords')
        .set('Authorization', 'Bearer valid_token')
        .send({ password_id: 2 });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Tag not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '999');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      expect(db('passwords').first).not.toHaveBeenCalled();
      expect(db('password_tags').insert).not.toHaveBeenCalled();
    });
    
    test('should return 404 if password not found', async () => {
      // Mock tag found
      db('tags').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Important'
      });
      
      // Mock password not found
      db('passwords').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/api/v1/tags/1/passwords')
        .set('Authorization', 'Bearer valid_token')
        .send({ password_id: 999 });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Password not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', 999);
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
      
      expect(db('password_tags').insert).not.toHaveBeenCalled();
    });
    
    test('should return 400 if password already has the tag', async () => {
      // Mock tag found
      db('tags').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Important'
      });
      
      // Mock password found
      db('passwords').first.mockResolvedValueOnce({
        id: 2,
        user_id: 1,
        title: 'Test Password'
      });
      
      // Mock password_tag found (already exists)
      db('password_tags').first.mockResolvedValueOnce({
        id: 1,
        tag_id: 1,
        password_id: 2
      });
      
      const response = await request(app)
        .post('/api/v1/tags/1/passwords')
        .set('Authorization', 'Bearer valid_token')
        .send({ password_id: 2 });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Password already has this tag');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('password_tags');
      expect(db('password_tags').where).toHaveBeenCalledWith('tag_id', 1);
      expect(db('password_tags').andWhere).toHaveBeenCalledWith('password_id', 2);
      expect(db('password_tags').first).toHaveBeenCalled();
      
      expect(db('password_tags').insert).not.toHaveBeenCalled();
    });
  });
  
  describe('DELETE /api/v1/tags/:id/passwords/:passwordId', () => {
    test('should remove a password from a tag', async () => {
      // Mock tag found
      db('tags').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Important'
      });
      
      // Mock password found
      db('passwords').first.mockResolvedValueOnce({
        id: 2,
        user_id: 1,
        title: 'Test Password'
      });
      
      // Mock delete success
      db('password_tags').del.mockResolvedValueOnce(1);
      
      const response = await request(app)
        .delete('/api/v1/tags/1/passwords/2')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Password removed from tag successfully');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '1');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', '2');
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('password_tags');
      expect(db('password_tags').where).toHaveBeenCalledWith('tag_id', 1);
      expect(db('password_tags').andWhere).toHaveBeenCalledWith('password_id', 2);
      expect(db('password_tags').del).toHaveBeenCalled();
    });
    
    test('should return 404 if tag not found', async () => {
      // Mock tag not found
      db('tags').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .delete('/api/v1/tags/999/passwords/2')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Tag not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').where).toHaveBeenCalledWith('id', '999');
      expect(db('tags').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('tags').first).toHaveBeenCalled();
      expect(db('passwords').first).not.toHaveBeenCalled();
      expect(db('password_tags').del).not.toHaveBeenCalled();
    });
    
    test('should return 404 if password not found', async () => {
      // Mock tag found
      db('tags').first.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        name: 'Important'
      });
      
      // Mock password not found
      db('passwords').first.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .delete('/api/v1/tags/1/passwords/999')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Password not found');
      
      // Verify database calls
      expect(db).toHaveBeenCalledWith('tags');
      expect(db('tags').first).toHaveBeenCalled();
      
      expect(db).toHaveBeenCalledWith('passwords');
      expect(db('passwords').where).toHaveBeenCalledWith('id', '999');
      expect(db('passwords').andWhere).toHaveBeenCalledWith('user_id', 1);
      expect(db('passwords').first).toHaveBeenCalled();
      
      expect(db('password_tags').del).not.toHaveBeenCalled();
    });
  });
});
