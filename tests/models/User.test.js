// tests/models/User.test.js
const User = require('../../backend/models/User');
const { db } = require('../../database/db');

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
  // Clear the users table before each test
  await db('users').del();
});

describe('User Model', () => {
  test('should create a new user', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'hashedpassword123',
      role: 'user'
    };
    
    const userId = await User.create(userData);
    expect(userId).toBeDefined();
    
    const user = await User.findById(userId);
    expect(user).toBeDefined();
    expect(user.email).toBe(userData.email);
  });
  
  test('should find a user by email', async () => {
    const userData = {
      email: 'find-me@example.com',
      password: 'hashedpassword123',
      role: 'user'
    };
    
    await User.create(userData);
    
    const user = await User.findByEmail(userData.email);
    expect(user).toBeDefined();
    expect(user.email).toBe(userData.email);
  });
  
  test('should update a user', async () => {
    const userData = {
      email: 'update-me@example.com',
      password: 'hashedpassword123',
      role: 'user'
    };
    
    const userId = await User.create(userData);
    
    const updateData = {
      email: 'updated@example.com'
    };
    
    await User.update(userId, updateData);
    
// tests/models/User.test.js (continued)
    const updatedUser = await User.findById(userId);
    expect(updatedUser.email).toBe(updateData.email);
  });
  
  test('should delete a user', async () => {
    const userData = {
      email: 'delete-me@example.com',
      password: 'hashedpassword123',
      role: 'user'
    };
    
    const userId = await User.create(userData);
    
    // Verify user exists
    let user = await User.findById(userId);
    expect(user).toBeDefined();
    
    // Delete user
    await User.delete(userId);
    
    // Verify user is deleted
    user = await User.findById(userId);
    expect(user).toBeUndefined();
  });
  
  test('should update 2FA settings', async () => {
    const userData = {
      email: 'twofa@example.com',
      password: 'hashedpassword123',
      role: 'user'
    };
    
    const userId = await User.create(userData);
    
    const twoFAData = {
      totpSecret: 'ABCDEFGHIJKLMNOP',
      totpEnabled: true
    };
    
    await User.updateTwoFactorSettings(userId, twoFAData);
    
    const updatedUser = await User.findById(userId);
    expect(updatedUser.totp_secret).toBe(twoFAData.totpSecret);
    expect(updatedUser.totp_enabled).toBe(1); // MySQL boolean is 1/0
  });
  
  test('should find all users', async () => {
    // Create multiple users
    const users = [
      { email: 'user1@example.com', password: 'hash1', role: 'user' },
      { email: 'user2@example.com', password: 'hash2', role: 'user' },
      { email: 'admin@example.com', password: 'hash3', role: 'admin' }
    ];
    
    for (const user of users) {
      await User.create(user);
    }
    
    const allUsers = await User.findAll();
    expect(allUsers).toHaveLength(3);
    
    // Check pagination
    const limitedUsers = await User.findAll(2, 0);
    expect(limitedUsers).toHaveLength(2);
    
    const offsetUsers = await User.findAll(2, 2);
    expect(offsetUsers).toHaveLength(1);
  });
});