/**
 * Rate Limit Model
 * Handles storing and retrieving rate limit information in the database
 */
const { db } = require('../db');
const { logger } = require('../../backend/utils/logger');

class RateLimit {
  constructor() {
    this.tableName = 'rate_limits';
  }

  /**
   * Increment the hit count for a key
   * @param {string} key - The rate limit key
   * @param {object} options - Options including windowMs and points
   * @returns {Promise<object>} - The result with totalHits
   */
  async increment(key, options = { windowMs: 60000, points: 1 }) {
    // Ensure points is a positive integer
    const points = Math.max(1, parseInt(options.points) || 1);
    try {
      // Calculate expiration time
      const now = Date.now();
      const expiresAt = new Date(now + options.windowMs);

      // Check if key exists
      const existingRecord = await db(this.tableName)
        .where({ key })
        .first();

      if (existingRecord) {
        // Update existing record
        const updatedPoints = Math.max(1, (existingRecord.points || 0) + points);
        await db(this.tableName)
          .where({ key })
          .update({
            points: updatedPoints,
            expires_at: expiresAt
          });
        
        return { totalHits: updatedPoints };
      } else {
        // Create new record
        await db(this.tableName).insert({
          key,
          points: points,
          expires_at: expiresAt,
          created_at: new Date()
        });
        
        return { totalHits: points };
      }
    } catch (error) {
      logger.error(`Error incrementing rate limit: ${error.message}`, { 
        service: 'secura',
        error
      });
      // Return a default value to avoid breaking the rate limiter
      // Must be at least 1 to avoid validation errors
      return { totalHits: 1 };
    }
  }

  /**
   * Reset the hit count for a key
   * @param {string} key - The rate limit key
   * @returns {Promise<void>}
   */
  async reset(key) {
    try {
      await db(this.tableName)
        .where({ key })
        .delete();
    } catch (error) {
      logger.error(`Error resetting rate limit: ${error.message}`, { 
        service: 'secura',
        error
      });
    }
  }

  /**
   * Clean up expired rate limits
   * @returns {Promise<number>} - Number of deleted records
   */
  async cleanup() {
    try {
      const now = new Date();
      const deleted = await db(this.tableName)
        .where('expires_at', '<', now)
        .delete();
      
      return deleted;
    } catch (error) {
      logger.error(`Error cleaning up rate limits: ${error.message}`, { 
        service: 'secura',
        error
      });
      return 0;
    }
  }

  /**
   * Check the current hit count for a key
   * @param {string} key - The rate limit key
   * @param {object} options - Options including windowMs
   * @returns {Promise<object>} - The result with totalHits
   */
  async check(key, options = { windowMs: 60000 }) {
    try {
      // Clean up expired entries first
      await this.cleanup();
      
      // Get current points for this key
      const record = await db(this.tableName)
        .where({ key })
        .where('expires_at', '>', new Date())
        .first();
      
      if (record) {
        return { totalHits: Math.max(1, record.points || 1) };
      }
      
      // No record found, return default
      return { totalHits: 1 };
    } catch (error) {
      logger.error(`Error checking rate limit: ${error.message}`, { 
        service: 'secura',
        error
      });
      // Return a default value to avoid breaking the rate limiter
      return { totalHits: 1 };
    }
  }
}

module.exports = RateLimit;
