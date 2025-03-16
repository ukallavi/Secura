const express = require('express');
const router = express.Router();
const { validateToken, logActivity } = require('../middleware/auth');
const { db } = require('../../database/db');
const { logger } = require('../utils/logger');
const { withTransaction } = require('../../database/db');

// All routes in this file require authentication
router.use(validateToken);

/**
 * Get dashboard statistics
 * GET /api/user/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get password count
    const [passwordCount] = await db('passwords')
      .where({ user_id: userId })
      .count('id as count');
    
    // Get favorite password count
    const [favoriteCount] = await db('passwords')
      .where({ 
        user_id: userId,
        favorite: true
      })
      .count('id as count');
    
    // Get password categories
    const categories = await db('passwords')
      .where({ user_id: userId })
      .select('category')
      .count('id as count')
      .groupBy('category');
    
    // Get recent passwords
    const recentPasswords = await db('passwords')
      .where({ user_id: userId })
      .select('id', 'title', 'username', 'website', 'updated_at')
      .orderBy('updated_at', 'desc')
      .limit(5);
    
    // Get weak passwords (implementation depends on your criteria)
    // This is just a placeholder example - weak passwords might be those under a certain length
    const weakPasswords = await db('passwords')
      .where({ user_id: userId })
      .whereRaw('LENGTH(password) < 8')
      .select('id', 'title')
      .limit(5);
    
    res.status(200).json({
      stats: {
        totalPasswords: passwordCount.count,
        favoritePasswords: favoriteCount.count,
        categories,
        recentPasswords,
        weakPasswords
      }
    });
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Server error while fetching dashboard data' });
  }
});

/**
 * Get user activity logs
 * GET /api/user/activity
 */
router.get('/activity', async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Get activity logs
    const logs = await db('activity_logs')
      .where({ user_id: userId })
      .select('id', 'action', 'details', 'ip_address', 'user_agent', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const [{ count }] = await db('activity_logs')
      .where({ user_id: userId })
      .count('id as count');
    
    res.status(200).json({
      logs,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching activity logs:', error);
    res.status(500).json({ message: 'Server error while fetching activity logs' });
  }
});

/**
 * Export user data
 * GET /api/user/export
 */
router.get('/export', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user profile
    const user = await db('users')
      .where({ id: userId })
      .first('id', 'email', 'role', 'two_factor_enabled', 'created_at', 'updated_at');
    
    // Get user settings
    const settings = await db('user_settings')
      .where({ user_id: userId })
      .first();
    
    // Get user passwords
    const passwords = await db('passwords')
      .where({ user_id: userId })
      .select(
        'id',
        'title',
        'website',
        'username',
        'password',
        'notes',
        'category',
        'favorite',
        'created_at',
        'updated_at'
      );
    
    // Check for encryption and decrypt if necessary
    let exportPasswords = passwords;
    
    if (settings && settings.encryption_enabled) {
      // If data is encrypted, require encryption key
      if (!req.user.encryptionKey) {
        return res.status(400).json({ 
          message: 'Encryption key required for exporting encrypted data',
          requiresKey: true
        });
      }
      
      // Decrypt passwords
      exportPasswords = passwords.map(pwd => ({
        ...pwd,
        password: decrypt(pwd.password, req.user.encryptionKey),
        notes: pwd.notes ? decrypt(pwd.notes, req.user.encryptionKey) : null
      }));
    }
    
    // Create export data
    const exportData = {
      profile: {
        email: user.email,
        role: user.role,
        twoFactorEnabled: !!user.two_factor_enabled,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      settings: settings ? {
        theme: settings.theme,
        autoLogoutTime: settings.auto_logout_time,
        passwordGenerator: JSON.parse(settings.password_generator || '{}'),
        encryptionEnabled: !!settings.encryption_enabled
      } : null,
      passwords: exportPasswords.map(pwd => ({
        title: pwd.title,
        website: pwd.website,
        username: pwd.username,
        password: pwd.password,
        notes: pwd.notes,
        category: pwd.category,
        favorite: !!pwd.favorite,
        createdAt: pwd.created_at,
        updatedAt: pwd.updated_at
      }))
    };
    
    // Log activity
    await logActivity(userId, 'EXPORT_DATA', {}, req);
    
    res.status(200).json(exportData);
  } catch (error) {
    logger.error('Error exporting user data:', error);
    res.status(500).json({ message: 'Server error while exporting user data' });
  }
});

/**
 * Import user data
 * POST /api/user/import
 */
router.post('/import', async (req, res) => {
  try {
    const userId = req.user.id;
    const { passwords, settings } = req.body;
    
    if (!passwords || !Array.isArray(passwords)) {
      return res.status(400).json({ message: 'Valid passwords array is required' });
    }
    
    // Get user settings for encryption check
    const userSettings = await db('user_settings')
      .where({ user_id: userId })
      .first('encryption_enabled');
    
    const isEncryptionEnabled = userSettings && userSettings.encryption_enabled;
    
    // Start a transaction
    await withTransaction(async (trx) => {
      // Import passwords
      for (const pwd of passwords) {
        // Validate required fields
        if (!pwd.title || !pwd.password) {
          continue; // Skip invalid entries
        }
        
        // Check for duplicates
        const existingPassword = await trx('passwords')
          .where({ 
            user_id: userId,
            title: pwd.title
          })
          .first('id');
        
        let passwordToSave = pwd.password;
        let notesToSave = pwd.notes;
        
        // Encrypt if necessary
        if (isEncryptionEnabled) {
          if (!req.user.encryptionKey) {
            throw new Error('Encryption key required for importing with encryption enabled');
          }
          
          passwordToSave = encrypt(pwd.password, req.user.encryptionKey);
          notesToSave = pwd.notes ? encrypt(pwd.notes, req.user.encryptionKey) : null;
        }
        
        // Insert or update password
        if (existingPassword) {
          await trx('passwords')
            .where({ id: existingPassword.id })
            .update({
              username: pwd.username || null,
              website: pwd.website || null,
              password: passwordToSave,
              notes: notesToSave,
              category: pwd.category || 'general',
              favorite: pwd.favorite || false,
              updated_at: db.fn.now()
            });
        } else {
          await trx('passwords').insert({
            user_id: userId,
            title: pwd.title,
            username: pwd.username || null,
            website: pwd.website || null,
            password: passwordToSave,
            notes: notesToSave,
            category: pwd.category || 'general',
            favorite: pwd.favorite || false,
            created_at: db.fn.now(),
            updated_at: db.fn.now()
          });
        }
      }
      
      // Import settings if provided
      if (settings) {
        const existingSettings = await trx('user_settings')
          .where({ user_id: userId })
          .first();
        
        const settingsData = {
          theme: settings.theme || 'light',
          auto_logout_time: settings.autoLogoutTime || 15,
          password_generator: settings.passwordGenerator 
            ? JSON.stringify(settings.passwordGenerator)
            : null,
          updated_at: db.fn.now()
        };
        
        if (existingSettings) {
          await trx('user_settings')
            .where({ user_id: userId })
            .update(settingsData);
        } else {
          await trx('user_settings').insert({
            user_id: userId,
            ...settingsData,
            encryption_enabled: isEncryptionEnabled, // Keep existing encryption setting
            created_at: db.fn.now()
          });
        }
      }
    });
    
    // Log activity
    await logActivity(userId, 'IMPORT_DATA', { count: passwords.length }, req);
    
    res.status(200).json({ 
      message: 'Data imported successfully',
      imported: passwords.length
    });
  } catch (error) {
    logger.error('Error importing user data:', error);
    res.status(500).json({ message: error.message || 'Server error while importing user data' });
  }
});

/**
 * Update user profile
 * PUT /api/user/profile
 */
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Check if email is already taken by another user
    const existingUser = await db('users')
      .where({ email })
      .whereNot({ id: userId })
      .first();
    
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already in use' });
    }
    
    // Update user profile
    await withTransaction(async (trx) => {
      await trx('users')
        .where({ id: userId })
        .update({ 
          email,
          updated_at: trx.fn.now()
        });
      
      // Log activity within the same transaction
      await logActivity(userId, 'UPDATE_PROFILE', { email }, req, trx);
    });
    
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
});

/**
 * Delete user account
 * DELETE /api/user
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete account' });
    }
    
    // Get user with password
    const user = await db('users')
      .where({ id: userId })
      .first('password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    // Start a transaction to delete all user data
    await withTransaction(async (trx) => {
      // Delete passwords
      await trx('passwords')
        .where({ user_id: userId })
        .del();
      
      // Delete settings
      await trx('user_settings')
        .where({ user_id: userId })
        .del();
      
      // Delete activity logs
      await trx('activity_logs')
        .where({ user_id: userId })
        .del();
      
      // Delete user
      await trx('users')
        .where({ id: userId })
        .del();
    });
    
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({ message: 'Server error while deleting account' });
  }
});

module.exports = router;