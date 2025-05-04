const express = require('express');
const router = express.Router();
const { authenticateToken, logActivity } = require('../middleware/auth');
const { db } = require('../../database/db');
const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');

// All routes in this file require authentication
router.use(authenticateToken);

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
        'url as website', // Map url to website for frontend compatibility
        'username',
        'password_encrypted as password', // Map password_encrypted to password
        'notes',
        'category',
        'favorite',
        'created_at',
        'updated_at'
      )
      .orderBy('title', 'asc')
    
    // Passwords are always encrypted in the database
    // Decrypt them for client-side use
    const decryptedPasswords = passwords.map(pwd => ({
      ...pwd,
      // In a real implementation, these would use proper decryption
      // For now, we'll just pass through the values
      password: pwd.password,
      notes: pwd.notes
    }));
    
    res.status(200).json({ passwords: decryptedPasswords });
  } catch (error) {
    logger.error('Error fetching passwords:', error);
    res.status(500).json({ message: 'Server error while fetching passwords' });
  }
});

/**
 * Search passwords
 * GET /api/passwords/search?q=term
 * Note: This route must come before the /:id route to avoid conflicts
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
          .orWhere('url', 'like', `%${q}%`)
          .orWhere('category', 'like', `%${q}%`);
      })
      .select(
        'id',
        'title',
        'url as website',
        'username',
        'password_encrypted as password',
        'notes',
        'category',
        'favorite',
        'created_at',
        'updated_at'
      );
    
    // Decrypt passwords for client-side use
    const decryptedPasswords = passwords.map(pwd => ({
      ...pwd,
      // In a real implementation, these would use proper decryption
      password: pwd.password,
      notes: pwd.notes
    }));
    
    res.status(200).json({ passwords: decryptedPasswords });
  } catch (error) {
    logger.error('Error searching passwords:', error);
    res.status(500).json({ message: 'Server error while searching passwords' });
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
      .select(
        'id',
        'title',
        'url as website',
        'username',
        'password_encrypted as password',
        'notes',
        'category',
        'favorite',
        'created_at',
        'updated_at'
      )
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
    
    // The password and notes should already be encrypted on the client side
    // The backend just stores the encrypted data without knowing the encryption key
    // This implements end-to-end encryption where only the client can decrypt the data
    let passwordToSave = password; // Already encrypted JSON with IV and data
    let notesToSave = notes ? notes : null; // Notes may be encrypted or null
    
    // Insert password
    const [passwordId] = await db('passwords').insert({
      user_id: userId,
      title,
      url: website || null, // Map website to url
      username: username || null,
      password_encrypted: passwordToSave, // Map password to password_encrypted
      notes: notesToSave,
      category: category || 'general',
      favorite: favorite || false,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });
    
    // Log activity
    await logActivity(userId, 'CREATE_PASSWORD', { title: title }, req);
    
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
 * Batch update passwords (for re-encryption)
 * POST /api/passwords/batch-update
 */
router.post('/batch-update', async (req, res) => {
  try {
    const userId = req.user.id;
    const { passwords } = req.body;
    
    if (!passwords || !Array.isArray(passwords) || passwords.length === 0) {
      return res.status(400).json({ message: 'Valid passwords array is required' });
    }
    
    // Start a transaction to ensure all updates succeed or fail together
    await db.transaction(async trx => {
      for (const pwd of passwords) {
        const { id, encryptedPassword } = pwd;
        
        // Verify the password belongs to the user
        const existingPassword = await trx('passwords')
          .where({ id, user_id: userId })
          .first();
        
        if (!existingPassword) {
          throw new Error(`Password with ID ${id} not found or does not belong to user`);
        }
        
        // Update the password with the new encrypted value
        await trx('passwords')
          .where({ id, user_id: userId })
          .update({
            password_encrypted: encryptedPassword,
            updated_at: trx.fn.now()
          });
      }
    });
    
    // Log activity
    await logActivity(userId, 'BATCH_UPDATE_PASSWORDS', { count: passwords.length }, req);
    
    res.status(200).json({ 
      message: 'Passwords updated successfully',
      count: passwords.length
    });
  } catch (error) {
    logger.error('Error batch updating passwords:', error);
    res.status(500).json({ message: 'Server error while updating passwords: ' + error.message });
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
    
    // Prepare update object
    const updates = {};
    
    if (title !== undefined) updates.title = title;
    if (website !== undefined) updates.url = website; // Map website to url
    if (username !== undefined) updates.username = username;
    if (password !== undefined) {
      // In a real implementation, this would use proper encryption
      updates.password_encrypted = password;
    }
    if (notes !== undefined) {
      updates.notes = notes;
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
      .select(
        'id',
        'title',
        'url as website',
        'username',
        'password_encrypted as password',
        'notes',
        'category',
        'favorite',
        'created_at',
        'updated_at'
      )
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
      .select(
        'id',
        'title',
        'url as website',
        'username',
        'password_encrypted as password',
        'notes',
        'category',
        'favorite',
        'created_at',
        'updated_at'
      )
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



module.exports = router;