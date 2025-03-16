// backend/models/RateLimit.js
const BaseModel = require('../../database/models/BaseModel');
const { logger } = require('../utils/logger');

class RateLimit extends BaseModel {
  constructor() {
    super('rate_limits');
  }

  /**
   * Create or update a rate limit record
   * @param {string} key - Rate limit key
   * @param {Object} options - Rate limit options
   * @returns {Promise<Object>} - Rate limit status
   */
  async increment(key, options = {}) {
    try {
      const { 
        maxAttempts = 5, 
        windowSize = 60 * 60 * 1000, // 1 hour in milliseconds
        increment = 1 
      } = options;
      
      return await this.db.transaction(async trx => {
        // Calculate expiry time
        const now = new Date();
        const expiresAt = new Date(now.getTime() + windowSize);
        
        // Try to find existing record
        const existing = await trx(this.tableName)
          .where('key', key)
          .where('expires_at', '>', now)
          .first();
        
        if (existing) {
          // Update existing record
          const newCount = existing.count + increment;
          
          await trx(this.tableName)
            .where('id', existing.id)
            .update({
              count: newCount,
              updated_at: now
            });
          
          return {
            key,
            count: newCount,
            limit: maxAttempts,
            remaining: Math.max(0, maxAttempts - newCount),
            resetAt: existing.expires_at,
            isLimited: newCount >= maxAttempts
          };
        } else {
          // Create new record
          const [id] = await trx(this.tableName)
            .insert({
              key,
              count: increment,
              expires_at: expiresAt,
              created_at: now,
              updated_at: now
            });
          
          return {
            key,
            count: increment,
            limit: maxAttempts,
            remaining: maxAttempts - increment,
            resetAt: expiresAt,
            isLimited: increment >= maxAttempts
          };
        }
      });
    } catch (error) {
      logger.error(`Error incrementing rate limit for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Check if a key is rate limited
   * @param {string} key - Rate limit key
   * @param {Object} options - Rate limit options
   * @returns {Promise<Object>} - Rate limit status
   */
  async check(key, options = {}) {
    try {
      const { maxAttempts = 5 } = options;
      
      const record = await this.db(this.tableName)
        .where('key', key)
        .where('expires_at', '>', new Date())
        .first();
      
      if (!record) {
        return {
          key,
          count: 0,
          limit: maxAttempts,
          remaining: maxAttempts,
          resetAt: null,
          isLimited: false
        };
      }
      
      return {
        key,
        count: record.count,
        limit: maxAttempts,
        remaining: Math.max(0, maxAttempts - record.count),
        resetAt: record.expires_at,
        isLimited: record.count >= maxAttempts
      };
    } catch (error) {
      logger.error(`Error checking rate limit for key: ${key}`, error);
      // Default to allowing the request in case of errors
      return {
        key,
        count: 0,
        limit: options.maxAttempts || 5,
        remaining: options.maxAttempts || 5,
        resetAt: null,
        isLimited: false
      };
    }
  }

  /**
   * Reset rate limit for a key
   * @param {string} key - Rate limit key
   * @returns {Promise<number>} - Number of affected rows
   */
  async reset(key) {
    try {
      return await this.db(this.tableName)
        .where('key', key)
        .delete();
    } catch (error) {
      logger.error(`Error resetting rate limit for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Clean up expired rate limits
   * @returns {Promise<number>} - Number of deleted records
   */
  async cleanup() {
    try {
      return await this.db(this.tableName)
        .where('expires_at', '<', new Date())
        .delete();
    } catch (error) {
      logger.error('Error cleaning up expired rate limits:', error);
      // Don't throw for cleanup tasks
      return 0;
    }
  }

  /**
   * Get all rate limits for a specific identifier
   * @param {string} identifier - Identifier prefix (e.g., IP address or user ID)
   * @returns {Promise<Array>} - Array of rate limit records
   */
  async getAllByIdentifier(identifier) {
    try {
      return await this.db(this.tableName)
        .where('key', 'like', `${identifier}:%`)
        .where('expires_at', '>', new Date());
    } catch (error) {
      logger.error(`Error getting rate limits for identifier: ${identifier}`, error);
      throw error;
    }
  }
}

// Create singleton instance
const rateLimitModel = new RateLimit();

module.exports = rateLimitModel;