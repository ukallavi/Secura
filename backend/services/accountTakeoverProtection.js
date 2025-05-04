// backend/services/accountTakeoverProtection.js
const { db } = require('../../database/db');
const { logSecurityEvent } = require('../utils/security');
const { sendEmail } = require('../utils/email');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const { logger } = require('../utils/logger');
const User = require('../../database/models/User');
const ActivityLog = require('../../database/models/ActivityLog');
const SuspiciousActivity = require('../../database/models/SuspiciousActivity');
const UserBaseline = require('../../database/models/UserBaseline');
const UserMonitoring = require('../../database/models/UserMonitoring');

/**
 * Middleware to apply account takeover protection during login
 */
const loginProtection = async (req, res, next) => {
  try {
    // Skip if user is not authenticated yet
    if (!req.user || !req.user.id) {
      return next();
    }
    
    // Apply protection
    const protectionResult = await applyLoginProtection(req.user.id, req);
    
    // Store result in request for later use
    req.accountProtection = protectionResult;
    
    // If verification required, store in session
    if (protectionResult.requiresVerification) {
      req.session.requiresVerification = true;
      req.session.verificationRequirements = protectionResult.verificationRequirements;
    }
    
    next();
  } catch (error) {
    logger.error('Error in login protection middleware:', error);
    next();
  }
};

/**
 * Middleware to protect sensitive operations
 * @param {string} activityType - Type of activity being performed
 */
const sensitiveOperationProtection = (activityType) => {
  return async (req, res, next) => {
    try {
      // Skip if user is not authenticated
      if (!req.user || !req.user.id) {
        return next();
      }
      
      // Assess risk for this operation
      const riskAssessment = await assessActivityRisk(req.user.id, req, activityType);
      
      // Store assessment in request
      req.riskAssessment = riskAssessment;
      
      // For high-risk operations, require additional verification
      if (riskAssessment.riskLevel === 'HIGH') {
        return res.status(403).json({
          success: false,
          requiresVerification: true,
          message: 'Additional verification required for this operation',
          verificationMethods: ['email', '2fa']
        });
      }
      
      next();
    } catch (error) {
      logger.error(`Error in sensitive operation protection (${activityType}):`, error);
      next();
    }
  };
};

/**
 * Middleware to verify user has completed required verification
 */
const verificationCheck = async (req, res, next) => {
  try {
    // Skip if user is not authenticated
    if (!req.user || !req.user.id) {
      return next();
    }
    
    // Check if verification is required
    if (req.session.requiresVerification) {
      // Check if verification has been completed
      if (!req.session.verificationCompleted) {
        return res.status(403).json({
          success: false,
          requiresVerification: true,
          message: 'Additional verification required to continue',
          verificationRequirements: req.session.verificationRequirements
        });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Error in verification check middleware:', error);
    next();
  }
};

/**
 * Enable account monitoring after recovery or suspicious activity
 * @param {number} userId - User ID
 * @param {string} level - Monitoring level (BASIC or ENHANCED)
 * @param {string} reason - Reason for monitoring
 * @param {number} durationDays - Duration in days
 * @param {Object} req - Express request object
 */
const enableAccountMonitoring = async (userId, level, reason, durationDays, req) => {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    
    // Get IP and user agent
    const ip = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : 'unknown';
    const userAgent = req ? req.headers['user-agent'] : 'unknown';
    
    // Create or update monitoring record
    await UserMonitoring.query()
      .insert({
        user_id: userId,
        level,
        reason,
        enabled_at: new Date(),
        expires_at: expiresAt,
        enabled_by: req && req.user ? req.user.id : null,
        enabled_from_ip: ip
      })
      .onConflict('user_id')
      .merge();
    
    // Log the event
    await logSecurityEvent('ACCOUNT_MONITORING_ENABLED', {
      userId,
      level,
      reason,
      duration: durationDays,
      expiresAt,
      enabledBy: req && req.user ? req.user.id : 'system',
      ip,
      userAgent
    });
    
    // Send notification to user
    await sendMonitoringNotification(userId, level, reason, expiresAt);
    
    return { success: true };
  } catch (error) {
    logger.error('Error enabling account monitoring:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Disable account monitoring
 * @param {number} userId - User ID
 * @param {Object} req - Express request object
 */
const disableAccountMonitoring = async (userId, req) => {
  try {
    // Get IP and user agent
    const ip = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : 'unknown';
    const userAgent = req ? req.headers['user-agent'] : 'unknown';
    
    // Get current monitoring status
    const monitoring = await UserMonitoring.query()
      .where('user_id', userId)
      .first();
    
    if (!monitoring) {
      return { success: false, error: 'No monitoring found for user' };
    }
    
    // Update record to disable monitoring
    await UserMonitoring.query()
      .where('user_id', userId)
      .update({
        disabled_at: new Date(),
        disabled_by: req && req.user ? req.user.id : null,
        disabled_from_ip: ip
      });
    
    // Log the event
    await logSecurityEvent('ACCOUNT_MONITORING_DISABLED', {
      userId,
      disabledBy: req && req.user ? req.user.id : 'system',
      reason: monitoring.reason,
      level: monitoring.level,
      ip,
      userAgent
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Error disabling account monitoring:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update user behavioral baseline
 * @param {number} userId - User ID
 * @param {Object} req - Express request object
 */
const updateUserBaseline = async (userId, req) => {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : 'unknown';
    const userAgent = req ? req.headers['user-agent'] : 'unknown';
    
    // Parse user agent
    let deviceInfo = { browser: 'unknown', os: 'unknown', device: 'unknown' };
    if (userAgent && userAgent !== 'unknown') {
      const parser = new UAParser(userAgent);
      const result = parser.getResult();
      deviceInfo = {
        browser: `${result.browser.name || 'unknown'} ${result.browser.version || ''}`.trim(),
        os: `${result.os.name || 'unknown'} ${result.os.version || ''}`.trim(),
        device: result.device.type || 'desktop'
      };
    }
    
    // Get geo info
    let geoInfo = { country: 'unknown', region: 'unknown', city: 'unknown' };
    if (ip && ip !== 'unknown' && ip !== '127.0.0.1' && ip !== '::1') {
      const geo = geoip.lookup(ip);
      if (geo) {
        geoInfo = {
          country: geo.country || 'unknown',
          region: geo.region || 'unknown',
          city: geo.city || 'unknown'
        };
      }
    }
    
    // Get current date
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0-6 (Sunday-Saturday)
    const hour = now.getHours(); // 0-23
    
    // Check if baseline exists
    const existingBaseline = await UserBaseline.findOne({ user_id: userId });
    
    if (existingBaseline) {
      // Update existing baseline
      const updatedData = {
        last_seen_at: now,
        last_ip: ip,
        last_user_agent: userAgent,
        known_ips: JSON.stringify([...new Set([...JSON.parse(existingBaseline.known_ips || '[]'), ip])]),
        known_devices: JSON.stringify([...new Set([...JSON.parse(existingBaseline.known_devices || '[]'), deviceInfo.device])]),
        known_browsers: JSON.stringify([...new Set([...JSON.parse(existingBaseline.known_browsers || '[]'), deviceInfo.browser])]),
        known_locations: JSON.stringify([...new Set([...JSON.parse(existingBaseline.known_locations || '[]'), `${geoInfo.country}/${geoInfo.region}`])]),
        typical_days: JSON.stringify(updateTypicalDays(JSON.parse(existingBaseline.typical_days || '{}'), dayOfWeek)),
        typical_hours: JSON.stringify(updateTypicalHours(JSON.parse(existingBaseline.typical_hours || '{}'), hour))
      };
      
      await UserBaseline.update(updatedData, { user_id: userId });
    } else {
      // Create new baseline
      await UserBaseline.create({
        user_id: userId,
        first_seen_at: now,
        last_seen_at: now,
        last_ip: ip,
        last_user_agent: userAgent,
        known_ips: JSON.stringify([ip]),
        known_devices: JSON.stringify([deviceInfo.device]),
        known_browsers: JSON.stringify([deviceInfo.browser]),
        known_locations: JSON.stringify([`${geoInfo.country}/${geoInfo.region}`]),
        typical_days: JSON.stringify({ [dayOfWeek]: 1 }),
        typical_hours: JSON.stringify({ [hour]: 1 })
      });
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error updating user baseline:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Helper to update typical days of activity
 * @param {Object} typicalDays - Current typical days
 * @param {number} dayOfWeek - Current day (0-6)
 */
const updateTypicalDays = (typicalDays, dayOfWeek) => {
  const day = dayOfWeek.toString();
  typicalDays[day] = (typicalDays[day] || 0) + 1;
  return typicalDays;
};

/**
 * Helper to update typical hours of activity
 * @param {Object} typicalHours - Current typical hours
 * @param {number} hour - Current hour (0-23)
 */
const updateTypicalHours = (typicalHours, hour) => {
  const hourStr = hour.toString();
  typicalHours[hourStr] = (typicalHours[hourStr] || 0) + 1;
  return typicalHours;
};

/**
 * Apply login protection and assess risk
 * @param {number} userId - User ID
 * @param {Object} req - Express request object
 */
const applyLoginProtection = async (userId, req) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Get user's baseline
    const baseline = await UserBaseline.findOne({ user_id: userId });
    
    // If no baseline, create one and allow login
    if (!baseline) {
      await updateUserBaseline(userId, req);
      return { 
        requiresVerification: false, 
        riskLevel: 'LOW',
        riskFactors: []
      };
    }
    
    // Assess risk based on various factors
    const riskFactors = [];
    let riskLevel = 'LOW';
    
    // Parse user agent
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    const deviceInfo = {
      browser: `${result.browser.name || 'unknown'} ${result.browser.version || ''}`.trim(),
      os: `${result.os.name || 'unknown'} ${result.os.version || ''}`.trim(),
      device: result.device.type || 'desktop'
    };
    
    // Get geo info
    let geoInfo = { country: 'unknown', region: 'unknown', city: 'unknown' };
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const geo = geoip.lookup(ip);
      if (geo) {
        geoInfo = {
          country: geo.country || 'unknown',
          region: geo.region || 'unknown',
          city: geo.city || 'unknown'
        };
      }
    }
    
    // Check if IP is known
    const knownIPs = JSON.parse(baseline.known_ips || '[]');
    if (!knownIPs.includes(ip)) {
      riskFactors.push('NEW_IP');
      riskLevel = 'MEDIUM';
    }
    
    // Check if device is known
    const knownDevices = JSON.parse(baseline.known_devices || '[]');
    if (!knownDevices.includes(deviceInfo.device)) {
      riskFactors.push('NEW_DEVICE');
      riskLevel = 'MEDIUM';
    }
    
    // Check if browser is known
    const knownBrowsers = JSON.parse(baseline.known_browsers || '[]');
    if (!knownBrowsers.includes(deviceInfo.browser)) {
      riskFactors.push('NEW_BROWSER');
    }
    
    // Check if location is known
    const location = `${geoInfo.country}/${geoInfo.region}`;
    const knownLocations = JSON.parse(baseline.known_locations || '[]');
    if (!knownLocations.includes(location)) {
      riskFactors.push('NEW_LOCATION');
      riskLevel = 'MEDIUM';
    }
    
    // Check time anomalies
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0-6 (Sunday-Saturday)
    const hour = now.getHours(); // 0-23
    
    const typicalDays = JSON.parse(baseline.typical_days || '{}');
    const typicalHours = JSON.parse(baseline.typical_hours || '{}');
    
    // If user rarely logs in on this day
    if (!typicalDays[dayOfWeek] || typicalDays[dayOfWeek] < 3) {
      riskFactors.push('UNUSUAL_DAY');
    }
    
    // If user rarely logs in at this hour
    if (!typicalHours[hour] || typicalHours[hour] < 3) {
      riskFactors.push('UNUSUAL_TIME');
    }
    
    // Check for recent suspicious activities
    const recentSuspicious = await SuspiciousActivity.query()
      .where('user_id', userId)
      .where('created_at', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7 days
      .count();
    
    if (parseInt(recentSuspicious[0].count) > 0) {
      riskFactors.push('RECENT_SUSPICIOUS_ACTIVITY');
      riskLevel = 'HIGH';
    }
    
    // Check if account is under monitoring
    const monitoring = await UserMonitoring.query()
      .where('user_id', userId)
      .where('disabled_at', null)
      .where('expires_at', '>', new Date())
      .first();
    
    if (monitoring) {
      riskFactors.push('ACCOUNT_UNDER_MONITORING');
      if (monitoring.level === 'ENHANCED') {
        riskLevel = 'HIGH';
      } else {
        riskLevel = Math.max(riskLevel, 'MEDIUM');
      }
    }
    
    // Check for failed login attempts
    const recentFailedLogins = await ActivityLog.query()
      .where('user_id', userId)
      .where('activity', 'FAILED_LOGIN')
      .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // 24 hours
      .count();
    
    if (parseInt(recentFailedLogins[0].count) >= 3) {
      riskFactors.push('MULTIPLE_FAILED_LOGINS');
      riskLevel = 'HIGH';
    }
    
    // Determine if verification is required
    const requiresVerification = riskLevel === 'HIGH' || 
      (riskLevel === 'MEDIUM' && riskFactors.length >= 2);
    
    // Log the login attempt with risk assessment
    await ActivityLog.create({
      user_id: userId,
      activity: 'LOGIN',
      ip_address: ip,
      user_agent: userAgent,
      metadata: JSON.stringify({
        riskLevel,
        riskFactors,
        requiresVerification,
        geoInfo,
        deviceInfo
      })
    });
    
    // If medium or high risk, log as suspicious activity
    if (riskLevel !== 'LOW') {
      await SuspiciousActivity.create({
        user_id: userId,
        activity_type: 'LOGIN',
        risk_level: riskLevel,
        ip_address: ip,
        user_agent: userAgent,
        location: JSON.stringify(geoInfo),
        details: JSON.stringify({
          riskFactors,
          deviceInfo
        })
      });
    }
    
    // Update user baseline
    await updateUserBaseline(userId, req);
    
    // Determine verification requirements
    const verificationRequirements = requiresVerification ? {
      methods: ['email'],
      reason: riskFactors.join(', ')
    } : null;
    
    return {
      requiresVerification,
      riskLevel,
      riskFactors,
      verificationRequirements
    };
  } catch (error) {
    logger.error('Error in login protection:', error);
    return { 
      requiresVerification: false, 
      riskLevel: 'LOW',
      riskFactors: ['ERROR_IN_ASSESSMENT']
    };
  }
};

/**
 * Assess risk for a sensitive activity
 * @param {number} userId - User ID
 * @param {Object} req - Express request object
 * @param {string} activityType - Type of activity
 */
const assessActivityRisk = async (userId, req, activityType) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Get user's baseline
    const baseline = await UserBaseline.query()
      .where('user_id', userId)
      .first();
    
    // If no baseline, consider it high risk
    if (!baseline) {
      return { 
        riskLevel: 'HIGH',
        riskFactors: ['NO_USER_BASELINE']
      };
    }
    
    // Assess risk based on various factors
    const riskFactors = [];
    let riskLevel = 'LOW';
    
    // Check if IP is known
    const knownIPs = JSON.parse(baseline.known_ips || '[]');
    if (!knownIPs.includes(ip)) {
      riskFactors.push('NEW_IP');
      riskLevel = 'MEDIUM';
    }
    
    // Check if account is under monitoring
    const monitoring = await UserMonitoring.query()
      .where('user_id', userId)
      .where('disabled_at', null)
      .where('expires_at', '>', new Date())
      .first();
    
    if (monitoring) {
      riskFactors.push('ACCOUNT_UNDER_MONITORING');
      if (monitoring.level === 'ENHANCED') {
        riskLevel = 'HIGH';
      } else {
        riskLevel = Math.max(riskLevel, 'MEDIUM');
      }
    }
    
    // Check for recent suspicious activities
    const recentSuspicious = await SuspiciousActivity.query()
      .where('user_id', userId)
      .where('created_at', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7 days
      .count();
    
    if (parseInt(recentSuspicious[0].count) > 0) {
      riskFactors.push('RECENT_SUSPICIOUS_ACTIVITY');
      riskLevel = 'HIGH';
    }
    
    // For specific high-risk activities, increase risk level
    if (['PASSWORD_CHANGE', 'EMAIL_CHANGE', 'SECURITY_SETTINGS_CHANGE', 'PAYMENT_METHOD_CHANGE'].includes(activityType)) {
      riskLevel = Math.max(riskLevel, 'MEDIUM');
      
      if (riskFactors.length > 0) {
        riskLevel = 'HIGH';
      }
    }
    
    // Log the activity with risk assessment
    await ActivityLog.create({
      user_id: userId,
      activity: activityType,
      ip_address: ip,
      user_agent: userAgent,
      metadata: JSON.stringify({
        riskLevel,
        riskFactors
      })
    });
    
    // If medium or high risk, log as suspicious activity
    if (riskLevel !== 'LOW') {
      await SuspiciousActivity.create({
        user_id: userId,
        activity_type: activityType,
        risk_level: riskLevel,
        ip_address: ip,
        user_agent: userAgent,
        details: JSON.stringify({ riskFactors })
      });
    }
    
    return {
      riskLevel,
      riskFactors
    };
  } catch (error) {
    logger.error('Error assessing activity risk:', error);
    return { 
      riskLevel: 'MEDIUM', 
      riskFactors: ['ERROR_IN_ASSESSMENT']
    };
  }
};

/**
 * Send notification to user about account monitoring
 * @param {number} userId - User ID
 * @param {string} level - Monitoring level
 * @param {string} reason - Reason for monitoring
 * @param {Date} expiresAt - Expiration date
 */
const sendMonitoringNotification = async (userId, level, reason, expiresAt) => {
  try {
    // Get user
    const user = await User.query()
      .where('id', userId)
      .first();
    
    if (!user || !user.email) {
      logger.error(`Cannot send monitoring notification: User ${userId} not found or has no email`);
      return;
    }
    
    // Format expiration date
    const expirationDate = expiresAt.toLocaleDateString();
    
    // Send email
    await sendEmail({
      to: user.email,
      subject: 'Important Security Notice: Account Monitoring Enabled',
      template: 'account-monitoring',
      context: {
        name: user.first_name || user.username || 'User',
        level,
        reason,
        expirationDate,
        contactEmail: 'security@example.com'
      }
    });
    
    logger.info(`Monitoring notification sent to user ${userId}`);
  } catch (error) {
    logger.error('Error sending monitoring notification:', error);
  }
};

/**
 * Get recent suspicious activities for admin review
 * Supports pagination and sorting
 */
const getSuspiciousActivities = async (options = {}) => {
  const {
    page = 1,
    limit = 20,
    status, // Optional: filter by status (e.g., 'PENDING', 'APPROVED', 'REJECTED', 'FLAGGED')
    userId, // Optional: filter by user
    riskLevel // Optional: filter by risk level
  } = options;
  const offset = (page - 1) * limit;
  // Build query
  let query = SuspiciousActivity.query()
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);
  if (status) query = query.where('status', status);
  if (userId) query = query.where('user_id', userId);
  if (riskLevel) query = query.where('risk_level', riskLevel);
  // Fetch activities and total count
  const [activities, totalCount] = await Promise.all([
    query,
    SuspiciousActivity.query().count('id as count').first()
  ]);
  return {
    activities,
    pagination: {
      page,
      limit,
      totalItems: totalCount.count,
      totalPages: Math.ceil(totalCount.count / limit)
    }
  };
};

/**
 * Review a suspicious activity (approve, reject, flag)
 * @param {number} id - Suspicious activity ID
 * @param {string} action - 'APPROVE', 'REJECT', 'FLAG'
 * @param {string} notes - Admin notes
 * @param {number} adminId - Admin user ID
 */
const reviewSuspiciousActivity = async (id, action, notes, adminId) => {
  // Find the suspicious activity
  const activity = await SuspiciousActivity.query().findById(id);
  if (!activity) return null;
  // Update status and add review notes
  const statusMap = {
    'APPROVE': 'APPROVED',
    'REJECT': 'REJECTED',
    'FLAG': 'FLAGGED'
  };
  const newStatus = statusMap[action] || 'PENDING';
  await SuspiciousActivity.query()
    .findById(id)
    .patch({
      status: newStatus,
      reviewed_at: new Date(),
      reviewed_by: adminId,
      review_notes: notes
    });
  // Optionally, log an admin action in ActivityLog
  await ActivityLog.query().insert({
    user_id: activity.user_id,
    action: 'ADMIN_REVIEW_SUSPICIOUS_ACTIVITY',
    ip_address: null,
    user_agent: null,
    details: JSON.stringify({
      activityId: id,
      action,
      notes,
      adminId
    })
  });
  // Return updated activity
  return await SuspiciousActivity.query().findById(id);
};

module.exports = {
  loginProtection,
  sensitiveOperationProtection,
  verificationCheck,
  enableAccountMonitoring,
  disableAccountMonitoring,
  updateUserBaseline,
  applyLoginProtection,
  assessActivityRisk,
  getSuspiciousActivities,
  reviewSuspiciousActivity
};