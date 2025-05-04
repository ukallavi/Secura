/**
 * Cleanup utilities for database maintenance
 * Handles purging old records and data archiving
 */

const db = require('../../database/db');
const { logger } = require('./logger');
const AuditLog = require('../models/AuditLog');
const fs = require('fs').promises;
const path = require('path');

/**
 * Purge old error logs based on retention policy
 * @param {number} retentionDays - Number of days to retain error logs
 * @param {boolean} archive - Whether to archive logs before deletion
 * @returns {Promise<Object>} Results of the purge operation
 */
async function purgeOldErrorLogs(retentionDays = 90, archive = true) {
  try {
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Get logs to be purged
    const logsToDelete = await db('error_logs')
      .where('created_at', '<', cutoffDate)
      .select('id');
    
    const count = logsToDelete.length;
    
    if (count === 0) {
      logger.info(`No error logs older than ${retentionDays} days to purge`);
      return { purged: 0, archived: false };
    }
    
    // Archive logs if requested
    if (archive) {
      await archiveErrorLogs(cutoffDate);
    }
    
    // Delete old logs
    const deleted = await db('error_logs')
      .where('created_at', '<', cutoffDate)
      .delete();
    
    // Log the action
    logger.info(`Purged ${deleted} error logs older than ${retentionDays} days`);
    
    // Create audit log
    await AuditLog.logAction({
      action: 'purge_error_logs',
      entity: 'error_logs',
      details: {
        retentionDays,
        purgedCount: deleted,
        cutoffDate: cutoffDate.toISOString()
      }
    });
    
    return { purged: deleted, archived: archive };
  } catch (error) {
    logger.error('Failed to purge old error logs:', error);
    throw error;
  }
}

/**
 * Archive error logs to a file
 * @param {Date} cutoffDate - Date before which logs should be archived
 * @returns {Promise<string>} Path to the archive file
 */
async function archiveErrorLogs(cutoffDate) {
  try {
    // Create archive directory if it doesn't exist
    const archiveDir = path.join(process.cwd(), 'archives');
    await fs.mkdir(archiveDir, { recursive: true });
    
    // Generate archive filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `error-logs-before-${cutoffDate.toISOString().split('T')[0]}-${timestamp}.json`;
    const archivePath = path.join(archiveDir, filename);
    
    // Get logs to archive
    const logs = await db('error_logs')
      .where('created_at', '<', cutoffDate)
      .select('*');
    
    if (logs.length === 0) {
      logger.info(`No error logs to archive before ${cutoffDate.toISOString()}`);
      return null;
    }
    
    // Write logs to file
    await fs.writeFile(
      archivePath,
      JSON.stringify({
        metadata: {
          archivedAt: new Date().toISOString(),
          cutoffDate: cutoffDate.toISOString(),
          count: logs.length
        },
        logs
      }, null, 2)
    );
    
    logger.info(`Archived ${logs.length} error logs to ${archivePath}`);
    
    return archivePath;
  } catch (error) {
    logger.error('Failed to archive error logs:', error);
    throw error;
  }
}

/**
 * Purge old audit logs based on retention policy
 * @param {number} retentionDays - Number of days to retain audit logs
 * @param {boolean} archive - Whether to archive logs before deletion
 * @returns {Promise<Object>} Results of the purge operation
 */
async function purgeOldAuditLogs(retentionDays = 365, archive = true) {
  try {
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Get logs to be purged
    const logsToDelete = await db('audit_logs')
      .where('timestamp', '<', cutoffDate)
      .select('id');
    
    const count = logsToDelete.length;
    
    if (count === 0) {
      logger.info(`No audit logs older than ${retentionDays} days to purge`);
      return { purged: 0, archived: false };
    }
    
    // Archive logs if requested
    if (archive) {
      await archiveAuditLogs(cutoffDate);
    }
    
    // Delete old logs
    const deleted = await db('audit_logs')
      .where('timestamp', '<', cutoffDate)
      .delete();
    
    // Log the action
    logger.info(`Purged ${deleted} audit logs older than ${retentionDays} days`);
    
    // Create audit log for this action
    await AuditLog.logAction({
      action: 'purge_audit_logs',
      entity: 'audit_logs',
      details: {
        retentionDays,
        purgedCount: deleted,
        cutoffDate: cutoffDate.toISOString()
      }
    });
    
    return { purged: deleted, archived: archive };
  } catch (error) {
    logger.error('Failed to purge old audit logs:', error);
    throw error;
  }
}

/**
 * Archive audit logs to a file
 * @param {Date} cutoffDate - Date before which logs should be archived
 * @returns {Promise<string>} Path to the archive file
 */
async function archiveAuditLogs(cutoffDate) {
  try {
    // Create archive directory if it doesn't exist
    const archiveDir = path.join(process.cwd(), 'archives');
    await fs.mkdir(archiveDir, { recursive: true });
    
    // Generate archive filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `audit-logs-before-${cutoffDate.toISOString().split('T')[0]}-${timestamp}.json`;
    const archivePath = path.join(archiveDir, filename);
    
    // Get logs to archive
    const logs = await db('audit_logs')
      .where('timestamp', '<', cutoffDate)
      .select('*');
    
    if (logs.length === 0) {
      logger.info(`No audit logs to archive before ${cutoffDate.toISOString()}`);
      return null;
    }
    
    // Write logs to file
    await fs.writeFile(
      archivePath,
      JSON.stringify({
        metadata: {
          archivedAt: new Date().toISOString(),
          cutoffDate: cutoffDate.toISOString(),
          count: logs.length
        },
        logs
      }, null, 2)
    );
    
    logger.info(`Archived ${logs.length} audit logs to ${archivePath}`);
    
    return archivePath;
  } catch (error) {
    logger.error('Failed to archive audit logs:', error);
    throw error;
  }
}

module.exports = {
  purgeOldErrorLogs,
  purgeOldAuditLogs,
  archiveErrorLogs,
  archiveAuditLogs
};
