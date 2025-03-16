// tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../server');
const { db } = require('../../database/db');
const bcrypt = require('bcrypt');

// Setup and teardown
beforeAll(async () => {
  // Run migrations
  await db.migrate.latest();
});

afterAll(async () => {
  // Close database connection
  await db.destroy();
});

beforeEach(async () => {
  // Clear relevant tables before each test
  await db('activity_logs').del();
  await db('users').del();
  
  // Create a test user
  const hashedPassword = await bcrypt.hash('Test123!', 10);
  await db('users').insert({
    email: 'test@example.com',
    password: hashedPassword,
    role: 'user',
    created_at: db.fn.now(),
    updated_at: db.fn.now()
  });
});

describe('Authentication API', () => {
  test('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!'
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    
    // Verify activity log was created
    const logs = await db('activity_logs')
      .where({ user_id: res.body.user.id, action: 'LOGIN_SUCCESS' });
    expect(logs).toHaveLength(1);
  });
  
  test('should fail login with invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'WrongPassword123!'
      });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBeDefined();
    
    // Verify failed login was logged
    const logs = await db('activity_logs')
      .where({ action: 'LOGIN_FAILED' });
    expect(logs).toHaveLength(1);
  });
  
  test('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'NewUser123!',
        confirmPassword: 'NewUser123!'
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    
    // Verify user was created in database
    const user = await db('users')
      .where({ email: 'newuser@example.com' })
      .first();
    expect(user).toBeDefined();
    
    // Verify activity was logged
    const logs = await db('activity_logs')
      .where({ user_id: user.id, action: 'REGISTER' });
    expect(logs).toHaveLength(1);
  });
});