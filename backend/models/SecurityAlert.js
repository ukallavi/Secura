// backend/models/SecurityAlert.js
const { db } = require('../../database/db');
const BaseModel = require('../../database/models/BaseModel');
const { logger } = require('../utils/logger');

class SecurityAlert extends BaseModel {
  constructor() {
    super('security_alerts');
  }

  /**
   * Create a new security alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<number>} - New alert ID
   */
  async createAlert(alertData) {
    try {
      const newAlert = {
        ...alertData,
        status: alertData.status || 'active',
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now()
      };
      
      return await this.create(newAlert);
    } catch (error) {
      logger.error('Error in SecurityAlert.createAlert:', error);
      throw error;
    }
  }

  /**
   * Get security alerts for a user
   * @param {number} userId - User ID
   * @param {Object} filters - Optional filters like status
   * @returns {Promise<Array>} - Array of security alert objects
   */
  async getByUserId(userId, filters = {}) {
    try {
      let query = this.db(this.tableName).where({ user_id: userId });
      
      if (filters.status) {
        query = query.where({ status: filters.status });
      }
      
      return await query.orderBy('created_at', 'desc');
    } catch (error) {
      logger.error('Error in SecurityAlert.getByUserId:', error);
      throw error;
    }
  }

  /**
   * Update a security alert
   * @param {number} alertId - Alert ID
   * @param {Object} alertData - Alert data to update
   * @returns {Promise<number>} - Number of affected rows
   */
  async updateAlert(alertId, alertData) {
    try {
      return await this.db(this.tableName)
        .where({ id: alertId })
        .update({
          ...alertData,
          updated_at: this.db.fn.now()
        });
    } catch (error) {
      logger.error('Error in SecurityAlert.updateAlert:', error);
      throw error;
    }
  }

  /**
   * Resolve a security alert
   * @param {number} alertId - Alert ID
   * @param {string} resolution - Resolution notes
   * @returns {Promise<number>} - Number of affected rows
   */
  async resolveAlert(alertId, resolution) {
    try {
      return await this.db(this.tableName)
        .where({ id: alertId })
        .update({
          status: 'resolved',
          resolution,
          resolved_at: this.db.fn.now(),
          updated_at: this.db.fn.now()
        });
    } catch (error) {
      logger.error('Error in SecurityAlert.resolveAlert:', error);
      throw error;
    }
  }
}

// Create singleton instance
const securityAlertModel = new SecurityAlert();

module.exports = securityAlertModel;