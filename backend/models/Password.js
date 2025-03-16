// backend/models/Password.js
const BaseModel = require('../../database/models/BaseModel');
const { logger } = require('../utils/logger');

class Password extends BaseModel {
  constructor() {
    super('passwords');
  }

  /**
   * Get all passwords for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} - Array of password objects
   */
  async getByUserId(userId) {
    try {
      return await this.db(this.tableName)
        .where({ user_id: userId })
        .orderBy('account_name', 'asc');
    } catch (error) {
      logger.error('Error in Password.getByUserId:', error);
      throw error;
    }
  }

  /**
   * Create a new password entry
   * @param {Object} passwordData - Password data including user_id
   * @returns {Promise<number>} - New password ID
   */
  async createPassword(passwordData) {
    try {
      const newPassword = {
        ...passwordData,
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now()
      };
      
      return await this.create(newPassword);
    } catch (error) {
      logger.error('Error in Password.createPassword:', error);
      throw error;
    }
  }

  /**
   * Update a password entry
   * @param {number} passwordId - Password ID
   * @param {number} userId - User ID (for security check)
   * @param {Object} passwordData - Password data to update
   * @returns {Promise<number>} - Number of affected rows
   */
  async updatePassword(passwordId, userId, passwordData) {
    try {
      return await this.db(this.tableName)
        .where({ id: passwordId, user_id: userId })
        .update({
          ...passwordData,
          updated_at: this.db.fn.now()
        });
    } catch (error) {
      logger.error('Error in Password.updatePassword:', error);
      throw error;
    }
  }

  /**
   * Delete a password entry
   * @param {number} passwordId - Password ID
   * @param {number} userId - User ID (for security check)
   * @returns {Promise<number>} - Number of affected rows
   */
  async deletePassword(passwordId, userId) {
    try {
      return await this.db(this.tableName)
        .where({ id: passwordId, user_id: userId })
        .delete();
    } catch (error) {
      logger.error('Error in Password.deletePassword:', error);
      throw error;
    }
  }
}

// Create singleton instance
const passwordModel = new Password();

module.exports = passwordModel;