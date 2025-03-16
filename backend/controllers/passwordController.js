// backend/controllers/passwordController.js
const crypto = require('crypto');
const { db } = require('../../database/db');
const Password = require('../models/Password');
const SharedPassword = require('../models/SharedPassword');
const User = require('../../database/models/User');
const Folder = require('../models/Folder');
const ActivityLog = require('../models/ActivityLog');
const { generatePasswordHash } = require('../utils/crypto');
const { logger } = require('../utils/logger');
const { validatePasswordStrength } = require('../utils/validation');

// Get all passwords for a user
exports.getPasswords = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's passwords
    const passwords = await Password.query()
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
    
    // Get passwords shared with the user
    const sharedPasswords = await SharedPassword.query()
      .where({ shared_with: userId })
      .innerJoin('passwords', 'shared_passwords.password_id', 'passwords.id')
      .select(
        'passwords.*',
        'shared_passwords.id as shared_id',
        'shared_passwords.permission',
        'shared_passwords.shared_by',
        'shared_passwords.created_at as shared_at'
      );
    
    return res.status(200).json({
      success: true,
      passwords,
      sharedPasswords
    });
  } catch (error) {
    logger.error('Error fetching passwords:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching passwords'
    });
  }
};

// Get a specific password
exports.getPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Try to find the password owned by the user
    let password = await Password.query()
      .findById(id)
      .where({ user_id: userId })
      .first();
    
    // If not found directly, check if it's shared with the user
    if (!password) {
      const sharedPassword = await SharedPassword.query()
        .where({ 
          password_id: id,
          shared_with: userId
        })
        .innerJoin('passwords', 'shared_passwords.password_id', 'passwords.id')
        .select(
          'passwords.*',
          'shared_passwords.id as shared_id',
          'shared_passwords.permission',
          'shared_passwords.shared_by',
          'shared_passwords.created_at as shared_at'
        )
        .first();
      
      if (!sharedPassword) {
        return res.status(404).json({
          success: false,
          message: 'Password not found'
        });
      }
      
      password = sharedPassword;
    }
    
    // Log the access
    await ActivityLog.query().insert({
      user_id: userId,
      action: 'PASSWORD_ACCESSED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: JSON.stringify({
        password_id: id
      })
    });
    
    return res.status(200).json({
      success: true,
      password
    });
  } catch (error) {
    logger.error('Error fetching password:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching password'
    });
  }
};

// Create a new password
exports.createPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, username, password, url, notes, folder_id, tags, strength } = req.body;
    
    // Validate required fields
    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name and password are required'
      });
    }
    
    // Check folder exists if provided
    if (folder_id) {
      const folder = await Folder.query()
        .findById(folder_id)
        .where({ user_id: userId })
        .first();
      
      if (!folder) {
        return res.status(404).json({
          success: false,
          message: 'Folder not found'
        });
      }
    }
    
    // Check password strength
    const strengthResult = validatePasswordStrength(password);
    if (strengthResult.score < 3) {
      return res.status(400).json({
        success: false,
        message: 'Password is too weak',
        details: strengthResult
      });
    }
    
    // Create the password record
    const newPassword = await withTransaction(db, async (trx) => {
      // Insert the password
      const createdPassword = await Password.query(trx).insert({
        user_id: userId,
        name,
        username: username || null,
        password: password, // Note: This should be encrypted on the client side
        url: url || null,
        notes: notes || null,
        folder_id: folder_id || null,
        tags: tags ? JSON.stringify(tags) : null,
        strength: strength || strengthResult.score
      });
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'PASSWORD_CREATED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          password_id: createdPassword.id,
          name: createdPassword.name
        })
      });
      
      return createdPassword;
    });
    
    return res.status(201).json({
      success: true,
      password: newPassword
    });
  } catch (error) {
    logger.error('Error creating password:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating password'
    });
  }
};

// Update a password
exports.updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, username, password, url, notes, folder_id, tags, strength } = req.body;
    
    // Find the password
    const existingPassword = await Password.query()
      .findById(id)
      .where({ user_id: userId })
      .first();
    
    // Check if password exists and belongs to user
    if (!existingPassword) {
      // Check if it's a shared password with edit permission
      const sharedPassword = await SharedPassword.query()
        .where({ 
          password_id: id,
          shared_with: userId,
          permission: 'EDIT'
        })
        .first();
      
      if (!sharedPassword) {
        return res.status(404).json({
          success: false,
          message: 'Password not found or you do not have edit permission'
        });
      }
    }
    
    // Check folder exists if provided
    if (folder_id) {
      const folder = await Folder.query()
        .findById(folder_id)
        .where({ user_id: userId })
        .first();
      
      if (!folder) {
        return res.status(404).json({
          success: false,
          message: 'Folder not found'
        });
      }
    }
    
    // Check password strength if password is being updated
    let strengthScore = strength;
    if (password) {
      const strengthResult = validatePasswordStrength(password);
      if (strengthResult.score < 3) {
        return res.status(400).json({
          success: false,
          message: 'Password is too weak',
          details: strengthResult
        });
      }
      strengthScore = strengthResult.score;
    }
    
    // Update the password
    const updatedPassword = await withTransaction(db, async (trx) => {
      // Build update object with only provided fields
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (username !== undefined) updateData.username = username;
      if (password !== undefined) updateData.password = password;
      if (url !== undefined) updateData.url = url;
      if (notes !== undefined) updateData.notes = notes;
      if (folder_id !== undefined) updateData.folder_id = folder_id;
      if (tags !== undefined) updateData.tags = tags ? JSON.stringify(tags) : null;
      if (strengthScore !== undefined) updateData.strength = strengthScore;
      
      // Update the password
      const updated = await Password.query(trx)
        .findById(id)
        .patch(updateData)
        .returning('*');
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'PASSWORD_UPDATED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          password_id: id,
          name: name || existingPassword.name
        })
      });
      
      return updated;
    });
    
    return res.status(200).json({
      success: true,
      password: updatedPassword
    });
  } catch (error) {
    logger.error('Error updating password:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating password'
    });
  }
};

// Delete a password
exports.deletePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Find the password first to verify ownership
    const password = await Password.query()
      .findById(id)
      .where({ user_id: userId })
      .first();
    
    if (!password) {
      return res.status(404).json({
        success: false,
        message: 'Password not found or you do not have permission to delete it'
      });
    }
    
    await withTransaction(db, async (trx) => {
      // Delete shared password entries first (foreign key constraint)
      await SharedPassword.query(trx)
        .where({ password_id: id })
        .delete();
      
      // Delete the password
      await Password.query(trx)
        .deleteById(id);
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'PASSWORD_DELETED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          password_id: id,
          name: password.name
        })
      });
    });
    
    return res.status(200).json({
      success: true,
      message: 'Password deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting password:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting password'
    });
  }
};

// Share a password with another user
exports.sharePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { email, permission = 'VIEW', expiry_date = null } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    if (!['VIEW', 'EDIT'].includes(permission)) {
      return res.status(400).json({
        success: false,
        message: 'Permission must be either VIEW or EDIT'
      });
    }
    
    // Find the password first to verify ownership
    const password = await Password.query()
      .findById(id)
      .where({ user_id: userId })
      .first();
    
    if (!password) {
      return res.status(404).json({
        success: false,
        message: 'Password not found'
      });
    }
    
    // Find the user to share with
    const recipient = await User.query()
      .where({ email })
      .first();
    
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found'
      });
    }
    
    // Don't allow sharing with self
    if (recipient.id === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot share a password with yourself'
      });
    }
    
    // Check if already shared
    const existingShare = await SharedPassword.query()
      .where({
        password_id: id,
        shared_with: recipient.id
      })
      .first();
    
    if (existingShare) {
      return res.status(400).json({
        success: false,
        message: 'Password already shared with this user'
      });
    }
    
    // Create the shared password record
    const sharedPassword = await withTransaction(db, async (trx) => {
      // Create the share
      const newShare = await SharedPassword.query(trx).insert({
        password_id: id,
        shared_by: userId,
        shared_with: recipient.id,
        permission,
        expiry_date: expiry_date ? new Date(expiry_date) : null
      });
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'PASSWORD_SHARED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          password_id: id,
          password_name: password.name,
          shared_with: recipient.id,
          recipient_email: recipient.email,
          permission
        })
      });
      
      return newShare;
    });
    
    return res.status(200).json({
      success: true,
      message: 'Password shared successfully',
      sharedPassword
    });
  } catch (error) {
    logger.error('Error sharing password:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error sharing password'
    });
  }
};

// Remove password sharing
exports.removeSharing = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, shareId } = req.params;
    
    // Find the shared password
    const sharedPassword = await SharedPassword.query()
      .findById(shareId)
      .where({ password_id: id })
      .first();
    
    if (!sharedPassword) {
      return res.status(404).json({
        success: false,
        message: 'Shared password not found'
      });
    }
    
    // Verify ownership of the original password or the recipient removing their own access
    const password = await Password.query()
      .findById(id)
      .first();
    
    if (password.user_id !== userId && sharedPassword.shared_with !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove this shared password'
      });
    }
    
    await withTransaction(db, async (trx) => {
      // Delete the shared password
      await SharedPassword.query(trx)
        .deleteById(shareId);
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'PASSWORD_SHARING_REMOVED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          password_id: id,
          shared_id: shareId,
          password_name: password.name,
          removed_by: userId,
          was_shared_with: sharedPassword.shared_with
        })
      });
    });
    
    return res.status(200).json({
      success: true,
      message: 'Password sharing removed successfully'
    });
  } catch (error) {
    logger.error('Error removing password sharing:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error removing password sharing'
    });
  }
};

// Generate a secure password
exports.generatePassword = async (req, res) => {
  try {
    const { length = 16, includeUppercase = true, includeLowercase = true, 
            includeNumbers = true, includeSymbols = true } = req.body;
    
    // Validate parameters
    if (length < 8 || length > 128) {
      return res.status(400).json({
        success: false,
        message: 'Password length must be between 8 and 128 characters'
      });
    }
    
    if (!includeUppercase && !includeLowercase && !includeNumbers && !includeSymbols) {
      return res.status(400).json({
        success: false,
        message: 'At least one character type must be included'
      });
    }
    
    // Define character sets
    const charSets = [];
    if (includeUppercase) charSets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    if (includeLowercase) charSets.push('abcdefghijklmnopqrstuvwxyz');
    if (includeNumbers) charSets.push('0123456789');
    if (includeSymbols) charSets.push('!@#$%^&*()_+-=[]{}|;:,.<>?');
    
    const allChars = charSets.join('');
    
    // Generate the password
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    // Ensure at least one character from each selected set
    charSets.forEach(set => {
      const randomIndex = crypto.randomInt(0, set.length);
      password += set[randomIndex];
    });
    
    // Fill the rest of the password
    for (let i = charSets.length; i < length; i++) {
      const randomIndex = randomBytes[i] % allChars.length;
      password += allChars[randomIndex];
    }
    
    // Shuffle the password characters
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    
    // Calculate strength
    const strengthResult = validatePasswordStrength(password);
    
    return res.status(200).json({
      success: true,
      password,
      strength: strengthResult
    });
  } catch (error) {
    logger.error('Error generating password:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating password'
    });
  }
};

// Check password strength
exports.checkPasswordStrength = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }
    
    const strengthResult = validatePasswordStrength(password);
    
    return res.status(200).json({
      success: true,
      strength: strengthResult
    });
  } catch (error) {
    logger.error('Error checking password strength:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error checking password strength'
    });
  }
};

// Get password history
exports.getPasswordHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Check if user owns the password or has access via sharing
    const password = await Password.query()
      .findById(id)
      .where({ user_id: userId })
      .first();
    
    if (!password) {
      const sharedPassword = await SharedPassword.query()
        .where({ 
          password_id: id,
          shared_with: userId
        })
        .first();
      
      if (!sharedPassword) {
        return res.status(404).json({
          success: false,
          message: 'Password not found or you do not have access to it'
        });
      }
    }
    
    // Get password history from the history table
    const history = await db('password_history')
      .where({ password_id: id })
      .orderBy('created_at', 'desc');
    
    return res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    logger.error('Error fetching password history:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching password history'
    });
  }
};

// Create a folder
exports.createFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, parent_id } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required'
      });
    }
    
    // Check if parent folder exists if provided
    if (parent_id) {
      const parentFolder = await Folder.query()
        .findById(parent_id)
        .where({ user_id: userId })
        .first();
      
      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          message: 'Parent folder not found'
        });
      }
    }
    
    // Create the folder
    const folder = await withTransaction(db, async (trx) => {
      const newFolder = await Folder.query(trx).insert({
        user_id: userId,
        name,
        parent_id: parent_id || null
      });
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'FOLDER_CREATED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          folder_id: newFolder.id,
          folder_name: newFolder.name
        })
      });
      
      return newFolder;
    });
    
    return res.status(201).json({
      success: true,
      folder
    });
  } catch (error) {
    logger.error('Error creating folder:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating folder'
    });
  }
};

// Get all folders
exports.getFolders = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all user's folders
    const folders = await Folder.query()
      .where({ user_id: userId })
      .orderBy('name');
    
    return res.status(200).json({
      success: true,
      folders
    });
  } catch (error) {
    logger.error('Error fetching folders:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching folders'
    });
  }
};

// Update a folder
exports.updateFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, parent_id } = req.body;
    
    // Find the folder
    const folder = await Folder.query()
      .findById(id)
      .where({ user_id: userId })
      .first();
    
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    
    // Check for circular reference if parent_id is provided
    if (parent_id) {
      // Can't set parent to self
      if (parent_id === id) {
        return res.status(400).json({
          success: false,
          message: 'A folder cannot be its own parent'
        });
      }
      
      // Check if parent exists
      const parentFolder = await Folder.query()
        .findById(parent_id)
        .where({ user_id: userId })
        .first();
      
      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          message: 'Parent folder not found'
        });
      }
      
      // Check for circular reference
      let current = parentFolder;
      while (current.parent_id) {
        if (current.parent_id === id) {
          return res.status(400).json({
            success: false,
            message: 'Circular folder reference detected'
          });
        }
        
        current = await Folder.query()
          .findById(current.parent_id)
          .where({ user_id: userId })
          .first();
        
        if (!current) break;
      }
    }
    
    // Update the folder
    const updatedFolder = await withTransaction(db, async (trx) => {
      // Build update object
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (parent_id !== undefined) updateData.parent_id = parent_id;
      
      // Update the folder
      const updated = await Folder.query(trx)
        .findById(id)
        .patch(updateData)
        .returning('*');
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'FOLDER_UPDATED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          folder_id: id,
          folder_name: name || folder.name
        })
      });
      
      return updated;
    });
    
    return res.status(200).json({
      success: true,
      folder: updatedFolder
    });
  } catch (error) {
    logger.error('Error updating folder:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating folder'
    });
  }
};

// Delete a folder
exports.deleteFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { movePasswordsTo } = req.body;
    
    // Find the folder
    const folder = await Folder.query()
      .findById(id)
      .where({ user_id: userId })
      .first();
    
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    
    // Check if destination folder exists if provided
    if (movePasswordsTo) {
      if (movePasswordsTo === id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot move passwords to the folder being deleted'
        });
      }
      
      const destFolder = await Folder.query()
        .findById(movePasswordsTo)
        .where({ user_id: userId })
        .first();
      
      if (!destFolder) {
        return res.status(404).json({
          success: false,
          message: 'Destination folder not found'
        });
      }
    }
    
    await withTransaction(db, async (trx) => {
      // Find all child folders that need their parent_id updated
      const childFolders = await Folder.query(trx)
        .where({ parent_id: id, user_id: userId });
      
      // Update child folders to new parent (or null)
      if (childFolders.length > 0) {
        await Folder.query(trx)
          .where({ parent_id: id, user_id: userId })
          .patch({ parent_id: folder.parent_id });
      }
      
      // Move passwords to destination folder or make them folderless
      if (movePasswordsTo) {
        await Password.query(trx)
          .where({ folder_id: id, user_id: userId })
          .patch({ folder_id: movePasswordsTo });
      } else {
        await Password.query(trx)
          .where({ folder_id: id, user_id: userId })
          .patch({ folder_id: null });
      }
      
      // Delete the folder
      await Folder.query(trx)
        .deleteById(id);
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'FOLDER_DELETED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          folder_id: id,
          folder_name: folder.name,
          moved_to: movePasswordsTo
        })
      });
    });
    
    return res.status(200).json({
      success: true,
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting folder:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting folder'
    });
  }
};

// Import passwords
exports.importPasswords = async (req, res) => {
  try {
    const userId = req.user.id;
    const { passwords, format } = req.body;
    
    if (!passwords || !Array.isArray(passwords) || passwords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No passwords provided for import'
      });
    }
    
    if (!format || !['CSV', 'JSON', 'LASTPASS', 'BITWARDEN', 'DASHLANE', '1PASSWORD'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing import format'
      });
    }
    
    // Process the import
    const results = await withTransaction(db, async (trx) => {
      const importResults = {
        total: passwords.length,
        successful: 0,
        failed: 0,
        errors: []
      };
      
      for (const item of passwords) {
        try {
          // Validate required fields
          if (!item.name || !item.password) {
            importResults.failed++;
            importResults.errors.push({
              item: item.name || 'Unknown',
              error: 'Missing required fields (name and password)'
            });
            continue;
          }
          
          // Create password record
          await Password.query(trx).insert({
            user_id: userId,
            name: item.name,
            username: item.username || null,
            password: item.password,
            url: item.url || null,
            notes: item.notes || null,
            folder_id: null, // Handle folder mapping separately if needed
            tags: item.tags ? JSON.stringify(item.tags) : null,
            strength: item.strength || 0
          });
          
          importResults.successful++;
        } catch (err) {
          importResults.failed++;
          importResults.errors.push({
            item: item.name || 'Unknown',
            error: err.message
          });
        }
      }
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'PASSWORDS_IMPORTED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          format,
          total: importResults.total,
          successful: importResults.successful,
          failed: importResults.failed
        })
      });
      
      return importResults;
    });
    
    return res.status(200).json({
      success: true,
      message: `Imported ${results.successful} of ${results.total} passwords`,
      results
    });
  } catch (error) {
    logger.error('Error importing passwords:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error importing passwords'
    });
  }
};

// Export passwords
exports.exportPasswords = async (req, res) => {
  try {
    const userId = req.user.id;
    const { format = 'JSON', folderIds } = req.body;
    
    if (!['CSV', 'JSON', 'ENCRYPTED_JSON'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format'
      });
    }
    
    // Build query
    let query = Password.query()
      .where({ user_id: userId });
    
    // Filter by folders if specified
    if (folderIds && Array.isArray(folderIds) && folderIds.length > 0) {
      query = query.whereIn('folder_id', folderIds);
    }
    
    // Get passwords
    const passwords = await query;
    
    // Process passwords based on format
    let exportData;
    
    if (format === 'JSON' || format === 'ENCRYPTED_JSON') {
      // For JSON, we can include more detailed information
      exportData = await Promise.all(passwords.map(async (password) => {
        // Get folder name if applicable
        let folderName = null;
        if (password.folder_id) {
          const folder = await Folder.query()
            .findById(password.folder_id)
            .select('name')
            .first();
          folderName = folder ? folder.name : null;
        }
        
        return {
          id: password.id,
          name: password.name,
          username: password.username,
          password: password.password,
          url: password.url,
          notes: password.notes,
          folder: folderName,
          folder_id: password.folder_id,
          tags: password.tags ? JSON.parse(password.tags) : [],
          strength: password.strength,
          created_at: password.created_at,
          updated_at: password.updated_at
        };
      }));
      
      // Encrypt if requested
      if (format === 'ENCRYPTED_JSON') {
        // This would typically use the user's master key
        // For this example, we'll just stringify the JSON
        exportData = JSON.stringify(exportData);
      }
    } else if (format === 'CSV') {
      // For CSV, we'll create a simpler structure
      exportData = passwords.map(password => ({
        name: password.name,
        username: password.username || '',
        password: password.password,
        url: password.url || '',
        notes: password.notes || ''
      }));
      
      // Convert to CSV string
      const headers = Object.keys(exportData[0]);
      const csvRows = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => 
            JSON.stringify(row[header] || '')
          ).join(',')
        )
      ];
      exportData = csvRows.join('\n');
    }
    
    // Log the export action
    await ActivityLog.query().insert({
      user_id: userId,
      action: 'PASSWORDS_EXPORTED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: JSON.stringify({
        format,
        count: passwords.length,
        folderFilters: folderIds || []
      })
    });
    
    return res.status(200).json({
      success: true,
      format,
      count: passwords.length,
      data: exportData
    });
  } catch (error) {
    logger.error('Error exporting passwords:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error exporting passwords'
    });
  }
};

// Get password breach status
exports.checkBreachStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Find the password
    const password = await Password.query()
      .findById(id)
      .where({ user_id: userId })
      .first();
    
    if (!password) {
      // Check if it's a shared password
      const sharedPassword = await SharedPassword.query()
        .where({ 
          password_id: id,
          shared_with: userId
        })
        .innerJoin('passwords', 'shared_passwords.password_id', 'passwords.id')
        .select('passwords.*')
        .first();
      
      if (!sharedPassword) {
        return res.status(404).json({
          success: false,
          message: 'Password not found'
        });
      }
      
      password = sharedPassword;
    }
    
    // Generate password hash for checking against breach database
    // We use the first 5 chars of the SHA-1 hash to check against breach APIs
    const passwordHash = generatePasswordHash(password.password);
    const hashPrefix = passwordHash.substring(0, 5);
    const hashSuffix = passwordHash.substring(5);
    
    // In a real implementation, this would call a breach API service
    // For this example, we'll simulate a response
    const breachCheck = {
      breached: false,
      breachCount: 0,
      breachDetails: [],
      lastChecked: new Date().toISOString()
    };
    
    // Log the check
    await ActivityLog.query().insert({
      user_id: userId,
      action: 'PASSWORD_BREACH_CHECK',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: JSON.stringify({
        password_id: id,
        password_name: password.name,
        breached: breachCheck.breached
      })
    });
    
    // Update the password breach status in the database
    await Password.query()
      .findById(id)
      .patch({
        breach_status: breachCheck.breached ? 'BREACHED' : 'SAFE',
        breach_count: breachCheck.breachCount,
        breach_details: breachCheck.breachDetails.length ? JSON.stringify(breachCheck.breachDetails) : null,
        last_breach_check: breachCheck.lastChecked
      });
    
    return res.status(200).json({
      success: true,
      passwordId: id,
      breachStatus: breachCheck
    });
  } catch (error) {
    logger.error('Error checking password breach status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error checking password breach status'
    });
  }
};

module.exports = exports;