/**
 * AuditLog Model
 * Handles logging of security-relevant actions across the application
 */

const db = require('../../database/db');
const { logger } = require('../utils/logger');

class AuditLog {
  /**
   * Log a security-relevant action
   * @param {Object} data - Audit log data
   * @param {string} data.userId - ID of the user performing the action (null for system actions)
   * @param {string} data.action - Action performed (e.g., 'login', 'password_change', 'error_resolve')
   * @param {string} data.entity - Entity affected (e.g., 'user', 'password', 'error_log')
   * @param {string} data.entityId - ID of the affected entity
   * @param {Object} data.details - Additional details about the action
   * @param {string} data.ipAddress - IP address of the user
   * @param {string} data.userAgent - User agent of the client
   * @param {string} data.sessionId - Session ID of the user
   * @returns {Promise<number>} ID of the created audit log
   */
  async logAction({
    userId = null,
    action,
    entity,
    entityId = null,
    details = {},
    ipAddress = null,
    userAgent = null,
    sessionId = null
  }) {
    try {
      // Validate required fields
      if (!action) throw new Error('Action is required for audit logging');
      if (!entity) throw new Error('Entity is required for audit logging');
      
      // Insert audit log
      const [id] = await db('audit_logs').insert({
        user_id: userId,
        action,
        entity,
        entity_id: entityId,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        ip_address: ipAddress,
        user_agent: userAgent,
        session_id: sessionId,
        timestamp: db.fn.now()
      });
      
      return id;
    } catch (error) {
      // Log error but don't throw - audit logging should not break the application
      logger.error('Failed to create audit log:', error);
      logger.error('Audit log data:', {
        userId,
        action,
        entity,
        entityId,
        ipAddress,
        sessionId
      });
      
      return null;
    }
  }
  
  /**
   * Get audit logs for a specific entity
   * @param {string} entity - Entity type
   * @param {string} entityId - Entity ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of logs to return
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<Array>} Audit logs
   */
  async getEntityLogs(entity, entityId, { limit = 50, offset = 0 } = {}) {
    try {
      return await db('audit_logs')
        .where({ entity, entity_id: entityId })
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset);
    } catch (error) {
      logger.error(`Failed to get audit logs for ${entity}:${entityId}:`, error);
      return [];
    }
  }
  
  /**
   * Get audit logs for a specific user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of logs to return
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<Array>} Audit logs
   */
  async getUserLogs(userId, { limit = 50, offset = 0 } = {}) {
    try {
      return await db('audit_logs')
        .where({ user_id: userId })
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset);
    } catch (error) {
      logger.error(`Failed to get audit logs for user ${userId}:`, error);
      return [];
    }
  }
  
  /**
   * Get recent audit logs
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of logs to return
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.action - Filter by action
   * @param {string} options.entity - Filter by entity
   * @returns {Promise<Array>} Audit logs
   */
  async getRecentLogs({ limit = 50, offset = 0, action = null, entity = null } = {}) {
    try {
      const query = db('audit_logs').orderBy('timestamp', 'desc');
      
      if (action) {
        query.where({ action });
      }
      
      if (entity) {
        query.where({ entity });
      }
      
      return await query.limit(limit).offset(offset);
    } catch (error) {
      logger.error('Failed to get recent audit logs:', error);
      return [];
    }
  }
  
  /**
   * Search audit logs
   * @param {Object} filters - Search filters
   * @param {string} filters.userId - Filter by user ID
   * @param {string} filters.action - Filter by action
   * @param {string} filters.entity - Filter by entity
   * @param {string} filters.entityId - Filter by entity ID
   * @param {string} filters.ipAddress - Filter by IP address
   * @param {string} filters.sessionId - Filter by session ID
   * @param {Date} filters.startDate - Filter by start date
   * @param {Date} filters.endDate - Filter by end date
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of logs to return
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<Array>} Audit logs
   */
  async searchLogs(filters = {}, { limit = 50, offset = 0 } = {}) {
    try {
      const query = db('audit_logs');
      
      // Apply filters
      if (filters.userId) {
        query.where({ user_id: filters.userId });
      }
      
      if (filters.action) {
        query.where({ action: filters.action });
      }
      
      if (filters.entity) {
        query.where({ entity: filters.entity });
      }
      
      if (filters.entityId) {
        query.where({ entity_id: filters.entityId });
      }
      
      if (filters.ipAddress) {
        query.where({ ip_address: filters.ipAddress });
      }
      
      if (filters.sessionId) {
        query.where({ session_id: filters.sessionId });
      }
      
      if (filters.startDate) {
        query.where('timestamp', '>=', filters.startDate);
      }
      
      if (filters.endDate) {
        query.where('timestamp', '<=', filters.endDate);
      }
      
      // Get total count for pagination
      const countQuery = query.clone();
      const [{ count }] = await countQuery.count('* as count');
      
      // Get results
      const results = await query
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset);
      
      return {
        logs: results,
        total: parseInt(count),
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(parseInt(count) / limit)
      };
    } catch (error) {
      logger.error('Failed to search audit logs:', error);
      return {
        logs: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
  }
}

module.exports = new AuditLog();
