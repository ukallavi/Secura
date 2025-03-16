// backend/models/RecoveryKey.js
const BaseModel = require('../../database/models/BaseModel');
const { logger } = require('../utils/logger');

class RecoveryKey extends BaseModel {
  constructor() {
    super('account_recovery_keys');
    this.tokenTableName = 'account_recovery_tokens';
  }

  /**
   * Create a new recovery key for a user
   * @param {number} userId - User ID
   * @param {Object} keyData - Recovery key data
   * @returns {Promise<number>} - New recovery key ID
   */
  async create(userId, keyData) {
    try {
      return await this.db.transaction(async trx => {
        // First, delete any existing recovery keys for this user
        await trx(this.tableName)
          .where('user_id', userId)
          .delete();
        
        // Then insert the new recovery key
        const [id] = await trx(this.tableName)
          .insert({
            user_id: userId,
            key_hash: keyData.keyHash,
            created_at: trx.fn.now()
          });
        
        return id;
      });
    } catch (error) {
      logger.error(`Error creating recovery key for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Verify if a recovery key exists for a user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - True if recovery key exists
   */
  async exists(userId) {
    try {
      const result = await this.db(this.tableName)
        .where('user_id', userId)
        .first();
      
      return !!result;
    } catch (error) {
      logger.error(`Error checking if recovery key exists for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get recovery key for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Recovery key object
   */
  async getByUserId(userId) {
    try {
      return await this.db(this.tableName)
        .where('user_id', userId)
        .first();
    } catch (error) {
      logger.error(`Error getting recovery key for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Delete recovery key for a user
   * @param {number} userId - User ID
   * @returns {Promise<number>} - Number of affected rows
   */
  async delete(userId) {
    try {
      return await this.db(this.tableName)
        .where('user_id', userId)
        .delete();
    } catch (error) {
      logger.error(`Error deleting recovery key for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Create a recovery token for account recovery
   * @param {number} userId - User ID
   * @param {string} token - Unique recovery token
   * @param {number} expiresIn - Token expiry in seconds
   * @returns {Promise<number>} - New token ID
   */
  async createToken(userId, token, expiresIn = 3600) {
    try {
      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
      
      const [id] = await this.db(this.tokenTableName)
        .insert({
          user_id: userId,
          token,
          expires_at: expiresAt,
          created_at: this.db.fn.now()
        });
      
      return id;
    } catch (error) {
      logger.error(`Error creating recovery token for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Verify a recovery token
   * @param {string} token - Recovery token
   * @returns {Promise<Object|null>} - Token data if valid, null otherwise
   */
  async verifyToken(token) {
    try {
      const tokenData = await this.db(this.tokenTableName)
        .where('token', token)
        .where('expires_at', '>', this.db.fn.now())
        .where('used', false)
        .first();
      
      return tokenData || null;
    } catch (error) {
      logger.error(`Error verifying recovery token: ${token}`, error);
      throw error;
    }
  }

  /**
   * Mark a token as used
   * @param {string} token - Recovery token
   * @returns {Promise<number>} - Number of affected rows
   */
  async markTokenUsed(token) {
    try {
      return await this.db(this.tokenTableName)
        .where('token', token)
        .update({
          used: true,
          updated_at: this.db.fn.now()
        });
    } catch (error) {
      logger.error(`Error marking recovery token as used: ${token}`, error);
      throw error;
    }
  }

  /**
   * Clean up expired recovery tokens
   * @returns {Promise<number>} - Number of deleted tokens
   */
  async cleanupExpiredTokens() {
    try {
      return await this.db(this.tokenTableName)
        .where('expires_at', '<', this.db.fn.now())
        .delete();
    } catch (error) {
      logger.error('Error cleaning up expired recovery tokens', error);
      // Don't throw for cleanup tasks
      return 0;
    }
  }
}

// Create singleton instance
const recoveryKeyModel = new RecoveryKey();

module.exports = recoveryKeyModel;