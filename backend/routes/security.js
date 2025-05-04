const express = require('express');
const router = express.Router();
const { authenticateToken, logActivity } = require('../middleware/auth');
const { db } = require('../../database/db');
const { logger } = require('../utils/logger');
const { withTransaction } = require('../../database/db');

// All routes in this file require authentication
router.use(authenticateToken);

/**
 * Get security score and settings
 * GET /api/security/score
 */
router.get('/score', async (req, res) => {
  try {
    const userId = req.user.id;
    // Get user and security settings from users table
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Calculate security score based on settings
    const securityScore = calculateSecurityScore(user);
    res.status(200).json({
      success: true,
      securityScore,
      settings: {
        twoFactorEnabled: user.totp_enabled,
        passwordStrengthCheck: user.password_strength_check,
        loginNotifications: user.login_notifications,
        inactivityTimeout: user.inactivity_timeout,
        passwordExpiryCheck: user.password_expiry_check
      }
    });
  } catch (error) {
    logger.error('Error fetching security score:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching security score' 
    });
  }
});

/**
 * Update security settings
 * PUT /api/security/settings
 */
router.put('/settings', async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      twoFactorEnabled,
      passwordStrengthCheck,
      loginNotifications,
      inactivityTimeout,
      passwordExpiryCheck
    } = req.body;
    // Validate input
    if (typeof twoFactorEnabled !== 'boolean' ||
        typeof passwordStrengthCheck !== 'boolean' ||
        typeof loginNotifications !== 'boolean' ||
        typeof inactivityTimeout !== 'boolean' ||
        typeof passwordExpiryCheck !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid settings provided. All settings must be boolean values.' 
      });
    }
    // Update user security settings in users table
    await db('users')
      .where({ id: userId })
      .update({
        totp_enabled: twoFactorEnabled,
        password_strength_check: passwordStrengthCheck,
        login_notifications: loginNotifications,
        inactivity_timeout: inactivityTimeout,
        password_expiry_check: passwordExpiryCheck,
        updated_at: new Date()
      });
    // Log activity
    await logActivity(userId, 'SECURITY_SETTINGS_UPDATE', {}, req);
    // Calculate new security score
    const updatedUser = await db('users').where({ id: userId }).first();
    const securityScore = calculateSecurityScore(updatedUser);
    // Return success response with new score
    res.status(200).json({
      success: true,
      message: 'Security settings updated successfully',
      securityScore,
      settings: {
        twoFactorEnabled,
        passwordStrengthCheck,
        loginNotifications,
        inactivityTimeout,
        passwordExpiryCheck
      }
    });
  } catch (error) {
    logger.error('Error updating security settings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating security settings' 
    });
  }
});

/**
 * Get recent security activity
 * GET /api/security/activity
 */
router.get('/activity', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get recent security-related activity for this user
    const activities = await db('activity_logs')
      .where({ user_id: userId })
      .whereIn('action', [
        'LOGIN', 
        'LOGOUT', 
        'PASSWORD_UPDATE', 
        'FAILED_LOGIN', 
        'SECURITY_SETTINGS_UPDATE',
        'TWO_FACTOR_ENABLED',
        'TWO_FACTOR_DISABLED'
      ])
      .orderBy('created_at', 'desc')
      .limit(20)
      .select('id', 'action', 'details', 'ip_address', 'user_agent', 'created_at');
    
    // Format activities for frontend
    const formattedActivities = activities.map(activity => {
      // Parse user agent to get device info
      const device = parseUserAgent(activity.user_agent);
      
      // Get location info from IP (in a real app, you'd use a geolocation service)
      const location = getLocationFromIP(activity.ip_address);
      
      return {
        id: activity.id,
        action: activity.action,
        timestamp: activity.created_at,
        ipAddress: activity.ip_address,
        location,
        device,
        details: activity.details
      };
    });
    
    res.status(200).json({
      success: true,
      activities: formattedActivities
    });
  } catch (error) {
    logger.error('Error fetching security activity:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching security activity' 
    });
  }
});

/**
 * Get security recommendations
 * GET /api/security/recommendations
 */
router.get('/recommendations', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user security settings from users table
    const user = await db('users').where({ id: userId }).first();
    // Default recommendations
    const recommendations = [];
    if (user) {
      if (!user.totp_enabled) {
        recommendations.push({
          id: 'two-factor',
          title: 'Enable Two-Factor Authentication',
          description: 'Add an extra layer of security to your account by requiring a second verification step when logging in.',
          priority: 'high'
        });
      }
      if (!user.login_notifications) {
        recommendations.push({
          id: 'login-notifications',
          title: 'Enable Login Notifications',
          description: 'Receive alerts when your account is accessed from a new device or location.',
          priority: 'medium'
        });
      }
      // Check password strength
      const userPasswords = await db('passwords')
        .where({ user_id: userId })
        .select('password_encrypted');
      if (userPasswords.length > 0) {
        // Check if any passwords are weak (in a real app, you'd have a more sophisticated check)
        const weakPasswords = userPasswords.filter(p => 
          p.password_encrypted.length < 12
        ).length;
        if (weakPasswords > 0) {
          recommendations.push({
            id: 'weak-passwords',
            title: 'Update Weak Passwords',
            description: `You have ${weakPasswords} passwords that are potentially weak. Consider updating them with stronger passwords.`,
            priority: 'high'
          });
        }
      }
    } else {
      // Default recommendations if no user found
      recommendations.push(
        {
          id: 'two-factor',
          title: 'Enable Two-Factor Authentication',
          description: 'Add an extra layer of security to your account by requiring a second verification step when logging in.',
          priority: 'high'
        },
        {
          id: 'login-notifications',
          title: 'Enable Login Notifications',
          description: 'Receive alerts when your account is accessed from a new device or location.',
          priority: 'medium'
        }
      );
    }
    
    res.status(200).json({
      success: true,
      recommendations
    });
  } catch (error) {
    logger.error('Error fetching security recommendations:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching security recommendations' 
    });
  }
});

// Helper function to calculate security score
function calculateSecurityScore(user) {
  // Each security feature is worth 20 points
  let score = 0;
  if (user.totp_enabled) score += 20;
  if (user.password_strength_check) score += 20;
  if (user.login_notifications) score += 20;
  if (user.inactivity_timeout) score += 20;
  if (user.password_expiry_check) score += 20;
  return score;
}

// Helper function to parse user agent
function parseUserAgent(userAgent) {
  if (!userAgent) return 'Unknown device';
  
  // Very simple user agent parsing (in a real app, you'd use a proper library)
  if (userAgent.includes('Chrome')) {
    return userAgent.includes('Mobile') ? 'Chrome on Mobile' : 'Chrome on Desktop';
  } else if (userAgent.includes('Firefox')) {
    return userAgent.includes('Mobile') ? 'Firefox on Mobile' : 'Firefox on Desktop';
  } else if (userAgent.includes('Safari')) {
    return userAgent.includes('Mobile') || userAgent.includes('iPhone') || userAgent.includes('iPad') 
      ? 'Safari on iOS' 
      : 'Safari on macOS';
  } else {
    return 'Unknown browser';
  }
}

// Helper function to get location from IP
function getLocationFromIP(ip) {
  // In a real app, you'd use a geolocation service
  // For this example, we'll return a placeholder
  if (!ip) return 'Unknown location';
  
  // Local IPs
  if (ip === '127.0.0.1' || ip === '::1') {
    return 'Local network';
  }
  
  // For demo purposes, return a random location
  const locations = [
    'New York, USA',
    'San Francisco, USA',
    'London, UK',
    'Tokyo, Japan',
    'Sydney, Australia',
    'Berlin, Germany',
    'Paris, France'
  ];
  
  // Use the IP to deterministically select a location
  const ipSum = ip.split('.').reduce((sum, num) => sum + parseInt(num || '0', 10), 0);
  return locations[ipSum % locations.length];
}

module.exports = router;
