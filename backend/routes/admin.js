const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../../database/db');
const { authenticateToken, authorizeRole, logActivity } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// All routes in this file require admin privileges
router.use(authenticateToken, authorizeRole(['admin']));

/**
 * Get all users
 * GET /api/admin/users
 */
router.get('/users', async (req, res) => {
  try {
    const users = await db('users')
      .select(
        'id', 
        'email', 
        'role', 
        'two_factor_enabled', 
        'created_at', 
        'updated_at'
      )
      .select(db.raw('(SELECT MAX(created_at) FROM activity_logs WHERE user_id = users.id) as last_login'))
      .orderBy('email', 'asc');
    
    // Don't send password hashes
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      twoFactorEnabled: !!user.two_factor_enabled,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLogin: user.last_login
    }));
    
    res.status(200).json({ users: sanitizedUsers });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error while fetching users.' });
  }
});

/**
 * Create a new user
 * POST /api/admin/users
 */
router.post('/users', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const [userId] = await db('users').insert({
      email,
      password: hashedPassword,
      role: role || 'user',
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });
    
    res.status(201).json({ 
      message: 'User created successfully.',
      userId
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error while creating user.' });
  }
});

/**
 * Update a user
 * PUT /api/admin/users/:id
 */
router.put('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { email, password, role } = req.body;
    
    // Check if user exists
    const user = await db('users').where({ id: userId }).first();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    // Prepare update object
    const updates = {};
    
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }
    
    updates.updated_at = db.fn.now();
    
    // Update user
    await db('users')
      .where({ id: userId })
      .update(updates);
    
    res.status(200).json({ message: 'User updated successfully.' });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error while updating user.' });
  }
});

/**
 * Delete a user
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent deleting the primary admin or self
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete yourself.' });
    }
    
    const user = await db('users').where({ id: userId }).first();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    if (user.role === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete admin users.' });
    }
    
    // Delete user (consider using a transaction here for more complex deletions)
    await db('users').where({ id: userId }).del();
    
    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error while deleting user.' });
  }
});

/**
 * Get activity logs
 * GET /api/admin/logs
 */
router.get('/logs', async (req, res) => {
  try {
    const logs = await db('activity_logs as l')
      .select(
        'l.id', 
        'l.user_id', 
        'u.email as user_email', 
        'l.action', 
        'l.details',
        'l.ip_address', 
        'l.user_agent', 
        'l.created_at'
      )
      .leftJoin('users as u', 'l.user_id', 'u.id')
      .orderBy('l.created_at', 'desc')
      .limit(100);
    
    res.status(200).json({ logs });
  } catch (error) {
    logger.error('Error fetching activity logs:', error);
    res.status(500).json({ message: 'Server error while fetching activity logs.' });
  }
});

/**
 * Get system statistics
 * GET /api/admin/stats
 */
router.get('/stats', async (req, res) => {
  try {
    // Get user count - log the query for debugging
    console.log('Executing user count query');
    const users = await db('users').select('id', 'email', 'role');
    console.log('Users in database:', users);
    const userCount = { count: users.length };
    
    // Get active user count (users who logged in within the last 24 hours)
    // For now, consider all users active for testing
    console.log('Executing active user count query');
    const activeUserCount = { count: users.length };
    
    // Log the user count for debugging
    console.log('User count:', userCount.count);
    console.log('Active user count:', activeUserCount.count);
    
    // Get password count
    const [passwordCount] = await db('passwords').count('id as count');
    
    // Get today's login count
    const [todayLoginCount] = await db('activity_logs')
      .where('action', 'LOGIN')
      .where('created_at', '>', db.raw('CURDATE()'))
      .count('id as count');
    
    // Get weak passwords count (passwords with length < 8)
    const [weakPasswordsCount] = await db('passwords')
      .whereRaw('LENGTH(password_encrypted) < 8')
      .count('id as count');
    
    // Get reused passwords count (estimate based on similar passwords)
    // This is a simplified approach - in a real system you'd use a more sophisticated algorithm
    const [reusedPasswordsCount] = await db.raw(`
      SELECT COUNT(DISTINCT p1.id) as count
      FROM passwords p1
      JOIN passwords p2 ON p1.user_id = p2.user_id AND p1.id <> p2.id
      WHERE p1.password_encrypted = p2.password_encrypted
    `);
    
    // Get shared passwords count
    const [sharedPasswordsCount] = await db('shared_passwords').count('id as count');
    
    // Get security alerts count (failed login attempts in the last 24 hours)
    const [securityAlertsCount] = await db('activity_logs')
      .where('action', 'FAILED_LOGIN')
      .where('created_at', '>', db.raw('DATE_SUB(NOW(), INTERVAL 24 HOUR)'))
      .count('id as count');
    
    // Log the final stats for debugging
    const stats = {
      totalUsers: parseInt(userCount.count) || 0,
      activeUsers: parseInt(activeUserCount.count) || 0,
      totalPasswords: parseInt(passwordCount?.count) || 0,
      todayLogins: parseInt(todayLoginCount?.count) || 0,
      weakPasswords: parseInt(weakPasswordsCount?.count) || 0,
      reusedPasswords: parseInt(reusedPasswordsCount?.count) || 0,
      sharedPasswords: parseInt(sharedPasswordsCount?.count) || 0,
      securityAlerts: parseInt(securityAlertsCount?.count) || 0
    };
    
    console.log('Returning stats to frontend:', stats);
    res.status(200).json(stats);
  } catch (error) {
    logger.error('Error fetching system stats:', error);
    res.status(500).json({ message: 'Server error while fetching system stats.', error: error.message });
  }
});

/**
 * Get anonymized user activity for admin dashboard
 * GET /api/admin/activity
 */
router.get('/activity', async (req, res) => {
  try {
    // Get recent activity logs (last 24 hours), but anonymize the data
    const activityLogs = await db('activity_logs as l')
      .select(
        'l.id',
        'l.user_id as userId',
        'l.action',
        'l.ip_address as ipAddress',
        'l.created_at as timestamp'
      )
      .where('l.created_at', '>', db.raw('DATE_SUB(NOW(), INTERVAL 24 HOUR)'))
      .orderBy('l.created_at', 'desc')
      .limit(50);
    
    // Anonymize user IDs for privacy while still showing patterns
    // This maintains consistency so the same user always gets the same anonymized ID
    const userIdMap = new Map();
    let nextAnonymousId = 1;
    
    const anonymizedLogs = activityLogs.map(log => {
      // Generate a consistent anonymous ID for each user
      if (!userIdMap.has(log.userId)) {
        userIdMap.set(log.userId, `user${nextAnonymousId++}`);
      }
      
      return {
        id: log.id,
        userId: userIdMap.get(log.userId),
        action: log.action,
        ipAddress: log.ipAddress,
        timestamp: log.timestamp
      };
    });
    
    res.status(200).json({ activities: anonymizedLogs });
  } catch (error) {
    logger.error('Error fetching activity data:', error);
    res.status(500).json({ message: 'Server error while fetching activity data.', error: error.message });
  }
});

module.exports = router;