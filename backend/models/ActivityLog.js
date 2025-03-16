// backend/models/ActivityLog.js
const BaseModel = require('../../database/models/BaseModel');
const { logger } = require('../utils/logger');

class ActivityLog extends BaseModel {
  constructor() {
    super('activity_logs');
  }

  /**
   * Create a new activity log entry
   * @param {Object} logData - Activity log data
   * @returns {Promise<number>} - New log ID
   */
  async createLog(logData) {
    try {
      const newLog = {
        ...logData,
        created_at: this.db.fn.now()
      };
      
      return await this.create(newLog);
    } catch (error) {
      logger.error('Error in ActivityLog.createLog:', error);
      throw error;
    }
  }

  /**
   * Get activity logs for a user
   * @param {number} userId - User ID
   * @param {number} limit - Maximum number of logs to return
   * @returns {Promise<Array>} - Array of activity log objects
   */
  async getByUserId(userId, limit = 100) {
    try {
      return await this.db(this.tableName)
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      logger.error('Error in ActivityLog.getByUserId:', error);
      throw error;
    }
  }

  /**
   * Get recent activity logs across the system
   * @param {number} limit - Maximum number of logs to return
   * @returns {Promise<Array>} - Array of activity log objects
   */
  async getRecent(limit = 100) {
    try {
      return await this.db(this.tableName)
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      logger.error('Error in ActivityLog.getRecent:', error);
      throw error;
    }
  }
}

// Create singleton instance
const activityLogModel = new ActivityLog();

module.exports = activityLogModel;