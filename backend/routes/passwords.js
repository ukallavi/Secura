const express = require('express');
const router = express.Router();
const { validateToken, logActivity } = require('../middleware/auth');
const { db } = require('../../database/db');
const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');

// All routes in this file require authentication
router.use(validateToken);

/**
 * Get all passwords for the authenticated user
 * GET /api/passwords
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
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
      )
      .orderBy('title', 'asc');
    
    // Decrypt passwords if they're encrypted
    // This assumes you have a user preference or setting for encryption
    const user = await db('users')
      .where({ id: userId })
      .first('encryption_enabled');
    
    let decryptedPasswords = passwords;
    
    if (user && user.encryption_enabled) {
      // You'll need to implement the decryption logic
      // This is just a placeholder for the concept
      decryptedPasswords = passwords.map(pwd => ({
        ...pwd,
        password: decrypt(pwd.password, req.user.encryptionKey), // encryptionKey would be from the req
        notes: pwd.notes ? decrypt(pwd.notes, req.user.encryptionKey) : null
      }));
    }
    
    res.status(200).json({ passwords: decryptedPasswords });
  } catch (error) {
    logger.error('Error fetching passwords:', error);
    res.status(500).json({ message: 'Server error while fetching passwords' });
  }
});

/**
 * Get a specific password
 * GET /api/passwords/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const passwordId = req.params.id;
    
    const password = await db('passwords')
      .where({ 
        id: passwordId,
        user_id: userId 
      })
      .first();
    
    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }
    
    // Decrypt if necessary
    // Similar logic to the GET all passwords route
    
    res.status(200).json({ password });
  } catch (error) {
    logger.error('Error fetching password:', error);
    res.status(500).json({ message: 'Server error while fetching password' });
  }
});

/**
 * Create a new password
 * POST /api/passwords
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, website, username, password, notes, category, favorite } = req.body;
    
    if (!title || !password) {
      return res.status(400).json({ message: 'Title and password are required' });
    }
    
    // Check for encryption
    const user = await db('users')
      .where({ id: userId })
      .first('encryption_enabled');
    
    let passwordToSave = password;
    let notesToSave = notes;
    
    if (user && user.encryption_enabled) {
      // Encrypt sensitive data
      passwordToSave = encrypt(password, req.user.encryptionKey);
      notesToSave = notes ? encrypt(notes, req.user.encryptionKey) : null;
    }
    
    // Insert password
    const [passwordId] = await db('passwords').insert({
      user_id: userId,
      title,
      website: website || null,
      username: username || null,
      password: passwordToSave,
      notes: notesToSave,
      category: category || 'general',
      favorite: favorite || false,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });
    
    // Log activity
    await logActivity(userId, 'CREATE_PASSWORD', { title }, req);
    
    res.status(201).json({ 
      message: 'Password created successfully',
      passwordId 
    });
  } catch (error) {
    logger.error('Error creating password:', error);
    res.status(500).json({ message: 'Server error while creating password' });
  }
});

/**
 * Update a password
 * PUT /api/passwords/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const passwordId = req.params.id;
    const { title, website, username, password, notes, category, favorite } = req.body;
    
    // Check if password exists and belongs to user
    const existingPassword = await db('passwords')
      .where({ 
        id: passwordId,
        user_id: userId 
      })
      .first();
    
    if (!existingPassword) {
      return res.status(404).json({ message: 'Password not found' });
    }
    
    // Check for encryption
    const user = await db('users')
      .where({ id: userId })
      .first('encryption_enabled');
    
    // Prepare update object
    const updates = {};
    
    if (title !== undefined) updates.title = title;
    if (website !== undefined) updates.website = website;
    if (username !== undefined) updates.username = username;
    if (password !== undefined) {
      updates.password = user && user.encryption_enabled
        ? encrypt(password, req.user.encryptionKey)
        : password;
    }
    if (notes !== undefined) {
      updates.notes = notes && user && user.encryption_enabled
        ? encrypt(notes, req.user.encryptionKey)
        : notes;
    }
    if (category !== undefined) updates.category = category;
    if (favorite !== undefined) updates.favorite = favorite;
    
    updates.updated_at = db.fn.now();
    
    // Update password
    await db('passwords')
      .where({ 
        id: passwordId,
        user_id: userId 
      })
      .update(updates);
    
    // Log activity
    await logActivity(userId, 'UPDATE_PASSWORD', { title: existingPassword.title }, req);
    
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error while updating password' });
  }
});

/**
 * Delete a password
 * DELETE /api/passwords/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const passwordId = req.params.id;
    
    // Check if password exists and belongs to user
    const password = await db('passwords')
      .where({ 
        id: passwordId,
        user_id: userId 
      })
      .first();
    
    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }
    
    // Delete password
    await db('passwords')
      .where({ 
        id: passwordId,
        user_id: userId 
      })
      .del();
    
    // Log activity
    await logActivity(userId, 'DELETE_PASSWORD', { title: password.title }, req);
    
    res.status(200).json({ message: 'Password deleted successfully' });
  } catch (error) {
    logger.error('Error deleting password:', error);
    res.status(500).json({ message: 'Server error while deleting password' });
  }
});

/**
 * Toggle favorite status
 * PATCH /api/passwords/:id/favorite
 */
router.patch('/:id/favorite', async (req, res) => {
  try {
    const userId = req.user.id;
    const passwordId = req.params.id;
    
    // Check if password exists and belongs to user
    const password = await db('passwords')
      .where({ 
        id: passwordId,
        user_id: userId 
      })
      .first();
    
    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }
    
    // Toggle favorite status
    await db('passwords')
      .where({ 
        id: passwordId,
        user_id: userId 
      })
      .update({ 
        favorite: !password.favorite,
        updated_at: db.fn.now()
      });
    
    res.status(200).json({ 
      message: 'Favorite status updated',
      favorite: !password.favorite
    });
  } catch (error) {
    logger.error('Error toggling favorite status:', error);
    res.status(500).json({ message: 'Server error while updating favorite status' });
  }
});

/**
 * Search passwords
 * GET /api/passwords/search?q=term
 */
router.get('/search', async (req, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: 'Search term is required' });
    }
    
    const passwords = await db('passwords')
      .where({ user_id: userId })
      .where(function() {
        this.where('title', 'like', `%${q}%`)
          .orWhere('username', 'like', `%${q}%`)
          .orWhere('website', 'like', `%${q}%`)
          .orWhere('category', 'like', `%${q}%`);
      })
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
    
    // Decrypt if necessary, similar to GET all
    
    res.status(200).json({ passwords });
  } catch (error) {
    logger.error('Error searching passwords:', error);
    res.status(500).json({ message: 'Server error while searching passwords' });
  }
});

module.exports = router;