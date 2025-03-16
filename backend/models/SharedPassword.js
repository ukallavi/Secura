// backend/models/SharedPassword.js
const BaseModel = require('../../database/models/BaseModel');
const { logger } = require('../utils/logger');

class SharedPassword extends BaseModel {
  constructor() {
    super('shared_passwords');
  }

  /**
   * Share a password with another user
   * @param {Object} shareData - Share data
   * @returns {Promise<number>} - New share ID
   */
  async sharePassword(shareData) {
    try {
      const newShare = {
        password_id: shareData.passwordId,
        owner_id: shareData.ownerId,
        recipient_id: shareData.recipientId,
        encrypted_password: shareData.encryptedPassword,
        permission_level: shareData.permissionLevel || 'read',
        expiry_date: shareData.expiryDate || null,
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now()
      };
      
      const [id] = await this.db(this.tableName).insert(newShare);
      return id;
    } catch (error) {
      logger.error('Error in SharedPassword.sharePassword:', error);
      throw error;
    }
  }

  /**
   * Get passwords shared with a user
   * @param {number} userId - User ID (recipient)
   * @returns {Promise<Array>} - Array of shared password objects
   */
  async getSharedWithUser(userId) {
    try {
      return await this.db(this.tableName)
        .join('passwords', 'shared_passwords.password_id', '=', 'passwords.id')
        .join('users as owners', 'shared_passwords.owner_id', '=', 'owners.id')
        .where('shared_passwords.recipient_id', userId)
        .where(function() {
          this.whereNull('shared_passwords.expiry_date')
            .orWhere('shared_passwords.expiry_date', '>', this.db.fn.now());
        })
        .select(
          'shared_passwords.*',
          'passwords.account_name',
          'passwords.username',
          'owners.email as owner_email',
          'owners.username as owner_username'
        );
    } catch (error) {
      logger.error(`Error getting passwords shared with user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get passwords shared by a user
   * @param {number} userId - User ID (owner)
   * @returns {Promise<Array>} - Array of shared password objects
   */
  async getSharedByUser(userId) {
    try {
      return await this.db(this.tableName)
        .join('passwords', 'shared_passwords.password_id', '=', 'passwords.id')
        .join('users as recipients', 'shared_passwords.recipient_id', '=', 'recipients.id')
        .where('shared_passwords.owner_id', userId)
        .select(
          'shared_passwords.*',
          'passwords.account_name',
          'passwords.username',
          'recipients.email as recipient_email',
          'recipients.username as recipient_username'
        );
    } catch (error) {
      logger.error(`Error getting passwords shared by user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get a specific shared password
   * @param {number} shareId - Share ID
   * @param {number} userId - User ID (either owner or recipient)
   * @returns {Promise<Object>} - Shared password object
   */
  async getById(shareId, userId) {
    try {
      return await this.db(this.tableName)
        .where('id', shareId)
        .where(function() {
          this.where('owner_id', userId)
            .orWhere('recipient_id', userId);
        })
        .first();
    } catch (error) {
      logger.error(`Error getting shared password by ID: ${shareId}`, error);
      throw error;
    }
  }

  /**
   * Update a shared password
   * @param {number} shareId - Share ID
   * @param {number} ownerId - Owner ID (for security check)
   * @param {Object} updateData - Data to update
   * @returns {Promise<number>} - Number of affected rows
   */
  async updateShare(shareId, ownerId, updateData) {
    try {
      const allowedFields = [
        'encrypted_password',
        'permission_level',
        'expiry_date'
      ];
      
      // Filter out disallowed fields
      const filteredData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});
      
      // Add updated_at timestamp
      filteredData.updated_at = this.db.fn.now();
      
      return await this.db(this.tableName)
        .where('id', shareId)
        .where('owner_id', ownerId)
        .update(filteredData);
    } catch (error) {
      logger.error(`Error updating shared password: ${shareId}`, error);
      throw error;
    }
  }

  /**
   * Remove a shared password
   * @param {number} shareId - Share ID
   * @param {number} userId - User ID (either owner or recipient can revoke)
   * @returns {Promise<number>} - Number of affected rows
   */
  async revokeShare(shareId, userId) {
    try {
      return await this.db(this.tableName)
        .where('id', shareId)
        .where(function() {
          this.where('owner_id', userId)
            .orWhere('recipient_id', userId);
        })
        .delete();
    } catch (error) {
      logger.error(`Error revoking shared password: ${shareId}`, error);
      throw error;
    }
  }

  /**
   * Remove all shares for a password
   * @param {number} passwordId - Password ID
   * @param {number} ownerId - Owner ID (for security check)
   * @returns {Promise<number>} - Number of affected rows
   */
  async revokeAllForPassword(passwordId, ownerId) {
    try {
      return await this.db(this.tableName)
        .where('password_id', passwordId)
        .where('owner_id', ownerId)
        .delete();
    } catch (error) {
      logger.error(`Error revoking all shares for password: ${passwordId}`, error);
      throw error;
    }
  }

  /**
   * Check if a password is shared with a specific user
   * @param {number} passwordId - Password ID
   * @param {number} recipientId - Recipient user ID
   * @returns {Promise<boolean>} - True if password is shared with user
   */
  async isSharedWithUser(passwordId, recipientId) {
    try {
      const share = await this.db(this.tableName)
        .where('password_id', passwordId)
        .where('recipient_id', recipientId)
        .where(function() {
          this.whereNull('expiry_date')
            .orWhere('expiry_date', '>', this.db.fn.now());
        })
        .first();
      
      return !!share;
    } catch (error) {
      logger.error(`Error checking if password ${passwordId} is shared with user ${recipientId}`, error);
      throw error;
    }
  }

  /**
   * Clean up expired shares
   * @returns {Promise<number>} - Number of deleted shares
   */
  async cleanupExpiredShares() {
    try {
      return await this.db(this.tableName)
        .whereNotNull('expiry_date')
        .where('expiry_date', '<', this.db.fn.now())
        .delete();
    } catch (error) {
      logger.error('Error cleaning up expired shares', error);
      // Don't throw for cleanup tasks
      return 0;
    }
  }
}

// Create singleton instance
const sharedPasswordModel = new SharedPassword();

module.exports = sharedPasswordModel;