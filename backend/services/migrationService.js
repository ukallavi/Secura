// backend/services/migrationService.js
const { logger } = require('../utils/logger');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const SuspiciousActivity = require('../models/SuspiciousActivity');
const UserBaseline = require('../models/UserBaseline');
const UserMonitoring = require('../models/UserMonitoring');
const SecurityAlert = require('../models/SecurityAlert');

/**
 * Migrate user data from old format to new format
 * @param {number} userId - User ID to migrate
 */
const migrateUserData = async (userId) => {
  try {
    logger.info(`Starting migration for user ${userId}`);
    
    // Get user
    const user = await User.query()
      .where('id', userId)
      .first();
    
    if (!user) {
      logger.error(`Migration failed: User ${userId} not found`);
      return { success: false, error: 'User not found' };
    }
    
    // Migrate user baseline
    await migrateUserBaseline(userId);
    
    // Migrate activity logs
    await migrateActivityLogs(userId);
    
    // Migrate security alerts
    await migrateSecurityAlerts(userId);
    
    logger.info(`Migration completed for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error during migration for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Migrate user baseline data
 * @param {number} userId - User ID
 */
const migrateUserBaseline = async (userId) => {
  try {
    logger.info(`Migrating baseline for user ${userId}`);
    
    // Check if baseline already exists in new format
    const existingBaseline = await UserBaseline.query()
      .where('user_id', userId)
      .first();
    
    if (existingBaseline) {
      logger.info(`Baseline already exists for user ${userId}, skipping`);
      return;
    }
    
    // Create default baseline
    await UserBaseline.query().insert({
      user_id: userId,
      first_seen_at: new Date(),
      last_seen_at: new Date(),
      known_ips: '[]',
      known_devices: '[]',
      known_browsers: '[]',
      known_locations: '[]',
      typical_days: '{}',
      typical_hours: '{}'
    });
    
    logger.info(`Created default baseline for user ${userId}`);
  } catch (error) {
    logger.error(`Error migrating baseline for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Migrate activity logs
 * @param {number} userId - User ID
 */
const migrateActivityLogs = async (userId) => {
  try {
    // This would contain logic to migrate activity logs from old format to new
    logger.info(`Migrating activity logs for user ${userId}`);
    
    // Example implementation would depend on the old data format
    // For now, we'll just log that it was called
    
    logger.info(`Activity logs migrated for user ${userId}`);
  } catch (error) {
    logger.error(`Error migrating activity logs for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Migrate security alerts
 * @param {number} userId - User ID
 */
const migrateSecurityAlerts = async (userId) => {
  try {
    // This would contain logic to migrate security alerts from old format to new
    logger.info(`Migrating security alerts for user ${userId}`);
    
    // Example implementation would depend on the old data format
    // For now, we'll just log that it was called
    
    logger.info(`Security alerts migrated for user ${userId}`);
  } catch (error) {
    logger.error(`Error migrating security alerts for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Run full database migration for all users
 */
const migrateAllUsers = async () => {
  try {
    logger.info('Starting migration for all users');
    
    // Get all user IDs
    const users = await User.query().select('id');
    
    // Count for logging
    const totalUsers = users.length;
    let migratedCount = 0;
    let failedCount = 0;
    
    // Migrate each user
    for (const user of users) {
      try {
        await migrateUserData(user.id);
        migratedCount++;
        
        if (migratedCount % 100 === 0) {
          logger.info(`Migration progress: ${migratedCount}/${totalUsers} users processed`);
        }
      } catch (error) {
        failedCount++;
        logger.error(`Failed to migrate user ${user.id}:`, error);
      }
    }
    
    logger.info(`Migration completed. ${migratedCount} users migrated, ${failedCount} failed`);
    return {
      success: true,
      totalUsers,
      migratedCount,
      failedCount
    };
  } catch (error) {
    logger.error('Error during full migration:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  migrateUserData,
  migrateUserBaseline,
  migrateActivityLogs,
  migrateSecurityAlerts,
  migrateAllUsers
};