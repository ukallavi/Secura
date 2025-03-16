// backend/controllers/adminController.js
const { 
  getSuspiciousActivities, 
  reviewSuspiciousActivity, 
  enableAccountMonitoring,
  disableAccountMonitoring
} = require('../services/accountTakeoverProtection');
const { db } = require('../../database/db');
const Password = require('../models/Password');
const ActivityLog = require('../models/ActivityLog');
const User = require('../../database/models/User');
const SharedPassword = require('../models/SharedPassword');
const { logger, logSecurityEvent } = require('../utils/logger');

// Get suspicious activities for admin review
exports.getSuspiciousActivities = async (req, res) => {
  try {
    const activities = await getSuspiciousActivities();
    
    return res.status(200).json({
      success: true,
      activities
    });
  } catch (error) {
    logger.error('Error fetching suspicious activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching suspicious activities'
    });
  }
};

// Review a suspicious activity
exports.reviewSuspiciousActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    
    if (!['APPROVE', 'REJECT', 'FLAG'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be APPROVE, REJECT, or FLAG'
      });
    }
    
    const result = await reviewSuspiciousActivity(id, action, notes, req.user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Suspicious activity not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Suspicious activity reviewed successfully',
      result
    });
  } catch (error) {
    logger.error('Error reviewing suspicious activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error reviewing suspicious activity'
    });
  }
};

// Get user activities
exports.getUserActivities = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Validate user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get activities with pagination
    const offset = (page - 1) * limit;
    
    const [activities, totalCount] = await Promise.all([
      ActivityLog.query()
        .where({ user_id: id })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset),
      ActivityLog.query()
        .where({ user_id: id })
        .count('id as count')
        .first()
    ]);
    
    return res.status(200).json({
      success: true,
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching user activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching user activities'
    });
  }
};

// Set user monitoring level
exports.setUserMonitoring = async (req, res) => {
  try {
    const { id } = req.params;
    const { level, reason, durationDays } = req.body;
    
    // Validate user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Validate monitoring level
    if (!['NONE', 'LOW', 'MEDIUM', 'HIGH'].includes(level)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid monitoring level'
      });
    }
    
    if (level === 'NONE') {
      await disableAccountMonitoring(id);
    } else {
      if (!reason || !durationDays) {
        return res.status(400).json({
          success: false,
          message: 'Reason and duration are required for enabling monitoring'
        });
      }
      
      await enableAccountMonitoring(id, level, reason, durationDays, req);
    }
    
    return res.status(200).json({
      success: true,
      message: `User monitoring ${level === 'NONE' ? 'disabled' : 'enabled'} successfully`
    });
  } catch (error) {
    logger.error('Error setting user monitoring:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error setting user monitoring'
    });
  }
};

// Get database statistics for admin dashboard
exports.getDatabaseStats = async (req, res) => {
  try {
    // Run queries in parallel for better performance
    const [
      userCount,
      passwordCount,
      sharedPasswordCount,
      activityLogs,
      storageSize
    ] = await Promise.all([
      // Count users
      db('users').count('id as count').first(),
      
      // Count passwords
      db('passwords').count('id as count').first(),
      
      // Count shared passwords
      db('shared_passwords').count('id as count').first(),
      
      // Get recent activity logs
      db('activity_logs')
        .orderBy('created_at', 'desc')
        .limit(10),
      
      // Get database size (MySQL specific)
      db.raw(`
        SELECT 
          table_schema as database_name,
          SUM(data_length + index_length) as total_size,
          SUM(data_length) as data_size,
          SUM(index_length) as index_size
        FROM information_schema.TABLES
        WHERE table_schema = ?
        GROUP BY table_schema
      `, [db.client.config.connection.database]).then(result => result[0][0])
    ]);
    
    // Get table sizes
    const tableSizes = await db.raw(`
      SELECT 
        table_name,
        table_rows,
        data_length,
        index_length,
        (data_length + index_length) as total_size
      FROM information_schema.TABLES
      WHERE table_schema = ?
      ORDER BY total_size DESC
    `, [db.client.config.connection.database]);
    
    // Format sizes to be human-readable
    const formatSize = (bytes) => {
      if (!bytes) return '0 B';
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };
    
    // Format table data
    const tables = tableSizes[0].map(table => ({
      name: table.table_name,
      rows: table.table_rows || 0,
      dataSize: formatSize(table.data_length),
      indexSize: formatSize(table.index_length),
      totalSize: formatSize(table.total_size)
    }));

    // Build the response
    const stats = {
      counts: {
        users: userCount.count,
        passwords: passwordCount.count,
        sharedPasswords: sharedPasswordCount.count
      },
      storage: {
        totalSize: formatSize(storageSize?.total_size || 0),
        dataSize: formatSize(storageSize?.data_size || 0),
        indexSize: formatSize(storageSize?.index_size || 0)
      },
      tables,
      recentActivity: activityLogs
    };
    
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error fetching database stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching database statistics'
    });
  }
};

// Force password reset for a user
exports.forcePasswordReset = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for password reset is required'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    await withTransaction(db, async (trx) => {
      // Update user to require password reset
      await User.query(trx)
        .findById(userId)
        .patch({ 
          password_reset_required: true,
          password_reset_reason: reason
        });
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'FORCE_PASSWORD_RESET',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          reason,
          admin_id: req.user.id
        })
      });
      
      // Log security event
      logSecurityEvent({
        event_type: 'ADMIN_FORCE_PASSWORD_RESET',
        user_id: userId,
        admin_id: req.user.id,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: { reason }
      });
    });
    
    return res.status(200).json({
      success: true,
      message: 'Password reset requirement has been set for the user'
    });
  } catch (error) {
    logger.error('Error forcing password reset:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error forcing password reset'
    });
  }
};

// Delete a user's password vault
exports.deleteUserVault = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, confirmation } = req.body;
    
    if (!reason || confirmation !== 'DELETE_CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'Reason and proper confirmation are required'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    await withTransaction(db, async (trx) => {
      // Delete all user's passwords
      await Password.query(trx)
        .where({ user_id: userId })
        .delete();
      
      // Delete all shared passwords for this user
      await SharedPassword.query(trx)
        .where({ user_id: userId })
        .orWhere({ shared_with: userId })
        .delete();
      
      // Log the action
      await ActivityLog.query(trx).insert({
        user_id: userId,
        action: 'VAULT_DELETED_BY_ADMIN',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          reason,
          admin_id: req.user.id
        })
      });
      
      // Log security event
      logSecurityEvent({
        event_type: 'ADMIN_DELETE_USER_VAULT',
        user_id: userId,
        admin_id: req.user.id,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: { reason }
      });
    });
    
    return res.status(200).json({
      success: true,
      message: "User's password vault has been deleted"
    });
  } catch (error) {
    logger.error('Error deleting user vault:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting user vault'
    });
  }
};

// Get system logs
exports.getSystemLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, startDate, endDate } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build query
    let query = db('system_logs')
      .orderBy('created_at', 'desc');
    
    // Apply filters
    if (type) {
      query = query.where('log_type', type);
    }
    
    if (startDate) {
      query = query.where('created_at', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('created_at', '<=', new Date(endDate));
    }
    
    // Get total count for pagination
    const countQuery = query.clone().count('* as count').first();
    
    // Apply pagination to main query
    query = query.limit(limit).offset(offset);
    
    // Execute both queries
    const [logs, countResult] = await Promise.all([query, countQuery]);
    
    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: countResult.count,
        totalPages: Math.ceil(countResult.count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching system logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching system logs'
    });
  }
};

module.exports = exports;