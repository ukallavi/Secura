// backend/routes/error-tracking.js
const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { logger } = require('../utils/logger');
const { sanitizeErrorData, anonymizeUserId } = require('../utils/error-sanitizer');
const { isCriticalError, notifyCriticalError } = require('../utils/error-notifications');
const { validateCsrfToken } = require('../middleware/csrf');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { sendErrorNotification } = require('../utils/error-notifications');
const { reportToExternalMonitoring, isExternalMonitoringEnabled } = require('../utils/external-monitoring');

/**
 * Error tracking endpoint
 * This route handles client-side error reporting
 */

// Health check for error tracking service
router.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    message: 'Error tracking service is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * Determine if two errors are similar enough to be aggregated
 * @param {Object} existingError - Existing error in the database
 * @param {Object} newError - New incoming error
 * @returns {boolean} True if errors should be aggregated
 */
const areErrorsSimilar = (existingError, newError) => {
  // Must have same error type
  if (existingError.error_type !== newError.error_type) return false;
  
  // Must have same error message (or very similar)
  if (existingError.error_message !== newError.error_message) {
    // Check for similarity if not exact match
    const similarity = calculateStringSimilarity(existingError.error_message, newError.error_message);
    if (similarity < 0.8) return false; // Less than 80% similar
  }
  
  // If both have status codes, they should match
  if (existingError.error_status && newError.error_status && 
      existingError.error_status !== newError.error_status) {
    return false;
  }
  
  // If both have URLs, they should be from the same page (path)
  if (existingError.url && newError.url) {
    try {
      const existingUrl = new URL(existingError.url);
      const newUrl = new URL(newError.url);
      if (existingUrl.pathname !== newUrl.pathname) return false;
    } catch (e) {
      // Invalid URLs, ignore this check
    }
  }
  
  return true;
};

/**
 * Calculate string similarity using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score between 0 and 1
 */
const calculateStringSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Simple implementation for short strings
  let distance = 0;
  const maxLen = Math.max(len1, len2);
  
  for (let i = 0; i < maxLen; i++) {
    if (str1[i] !== str2[i]) distance++;
  }
  
  return 1 - (distance / maxLen);
};

/**
 * @route POST /api/error-tracking
 * @desc Report a client-side error
 * @access Public
 */
router.post('/',
  validateCsrfToken,
  [
    // Validate required fields
    body('sessionId').notEmpty().withMessage('Session ID is required'),
    body('error').isObject().withMessage('Error details required'),
    body('error.type').isString().withMessage('Error type required'),
    body('error.message').isString().withMessage('Error message required'),
    // Sanitize optional fields
    body('url').optional().isURL().withMessage('Invalid URL format'),
    body('userAgent').optional().trim(),
    body('error.stack').optional().trim(),
    body('context').optional(),
    body('user.id').optional().trim().escape(),
    body('user.role').optional().trim(),
    body('environment').optional().isString().withMessage('Invalid environment'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Extract data from request
      const {
        timestamp = new Date().toISOString(),
        sessionId,
        url,
        userAgent,
        error,
        context,
        user,
      } = req.body;

      // Sanitize the error data to remove sensitive information
      const sanitizedError = sanitizeErrorData({
        error_type: error.type,
        error_message: error.message,
        error_stack: error.stack,
        context,
        url
      });

      // Anonymize the user ID if present
      const anonymized_user_id = user?.id ? anonymizeUserId(user.id) : null;

      // Check for similar errors in the last 24 hours from this session
      const similarErrors = await db('error_logs')
        .where('session_id', sessionId)
        .where('error_type', sanitizedError.error_type)
        .where('created_at', '>', db.raw('NOW() - INTERVAL 24 HOUR'))
        .orderBy('created_at', 'desc')
        .limit(5);

      // If similar error exists, increment count instead of creating new record
      if (similarErrors.length > 0) {
        const existingError = similarErrors[0];

        if (areErrorsSimilar(existingError, sanitizedError)) {
          // Update existing error count and timestamp
          await db('error_logs')
            .where('id', existingError.id)
            .update({
              error_count: db.raw('error_count + 1'),
              timestamp: db.fn.now(), // Update timestamp to most recent occurrence
              // Update context with latest information if provided
              context: context ? JSON.stringify(sanitizedError.context) : existingError.context
            });

          logger.info(`Aggregated similar error: ${sanitizedError.error_type} - Count: ${existingError.error_count + 1}`);

          return res.status(200).json({
            success: true,
            id: existingError.id,
            aggregated: true
          });
        }
      }

      // Get environment from request or default to current NODE_ENV
      const environment = req.body.environment || process.env.NODE_ENV || 'development';
      
      // Extract trace ID from request headers or generate a new one for correlation
      const traceId = req.headers['x-trace-id'] || req.body.traceId || uuidv4();
      
      // Insert new error into database
      const [id] = await db('error_logs').insert({
        session_id: sessionId,
        url: sanitizedError.url,
        user_agent: userAgent,
        error_type: sanitizedError.error_type,
        error_message: sanitizedError.error_message,
        error_status: error.status || null,
        error_stack: sanitizedError.error_stack,
        context: typeof sanitizedError.context === 'object' ? 
          JSON.stringify(sanitizedError.context) : sanitizedError.context,
        user_id: anonymized_user_id,
        user_role: user?.role || null,
        ip_address: req.ip,
        environment: environment, // Store environment with error
        trace_id: traceId, // Add trace ID for cross-service correlation
        service: req.body.service || 'frontend', // Identify which service generated the error
        created_at: db.fn.now()
      });

      // Create complete error object for notification system
      const errorRecord = {
        id,
        error_type: sanitizedError.error_type,
        error_message: sanitizedError.error_message,
        error_status: error.status || null,
        timestamp: new Date(),
        url: sanitizedError.url
      };
      
      // Check if this is a critical error that needs immediate attention
      if (isCriticalError(errorRecord)) {
        try {
          // Send notifications to administrators
          const result = await notifyCriticalError(errorRecord);
          if (result.notified) {
            logger.info(`Notifications sent for critical error ${id}`);
          }
          
          // Report critical errors to external monitoring services if enabled
          if (isExternalMonitoringEnabled()) {
            await reportToExternalMonitoring({
              error_type: sanitizedError.error_type,
              error_message: sanitizedError.error_message,
              error_stack: sanitizedError.error_stack,
              context: sanitizedError.context,
              user_id: anonymized_user_id,
              trace_id: traceId,
              environment: environment,
              service: req.body.service || 'frontend'
            });
          }
          
          logger.error(`CRITICAL ERROR: ${sanitizedError.error_type} - ${sanitizedError.error_message}`);
        } catch (notificationError) {
          logger.error('Failed to send critical error notification:', notificationError);
        }
      } else {
        logger.warn(`Client error reported: ${sanitizedError.error_type} - ${sanitizedError.error_message}`);
      }

      return res.status(201).json({
        success: true,
        id
      });
    } catch (err) {
      logger.error('Error tracking failed:', err);
      return res.status(500).json({ message: 'Error tracking failed' });
    }
  }
);

/**
 * @route GET /api/error-tracking/stats
 * @desc Get error statistics (admin only)
 * @access Private (Admin)
 */
router.get('/stats', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get time range from query params or default to last 24 hours
    const timeRange = req.query.timeRange || '24h';
    let timeFilter;
    
    switch (timeRange) {
      case '1h':
        timeFilter = db.raw('timestamp > NOW() - INTERVAL 1 HOUR');
        break;
      case '24h':
        timeFilter = db.raw('timestamp > NOW() - INTERVAL 24 HOUR');
        break;
      case '7d':
        timeFilter = db.raw('timestamp > NOW() - INTERVAL 7 DAY');
        break;
      case '30d':
        timeFilter = db.raw('timestamp > NOW() - INTERVAL 30 DAY');
        break;
      default:
        timeFilter = db.raw('timestamp > NOW() - INTERVAL 24 HOUR');
    }

    // Get error statistics
    const stats = await db('error_logs')
      .where(timeFilter)
      .select(
        db.raw('COUNT(*) as total_errors'),
        db.raw('COUNT(DISTINCT session_id) as affected_sessions'),
        db.raw('COUNT(DISTINCT user_id) as affected_users'),
        db.raw('MAX(timestamp) as most_recent_error')
      )
      .first();

    // Get top error types
    const topErrorTypes = await db('error_logs')
      .where(timeFilter)
      .select('error_type')
      .count('* as count')
      .groupBy('error_type')
      .orderBy('count', 'desc')
      .limit(5);

    // Get top error messages
    const topErrorMessages = await db('error_logs')
      .where(timeFilter)
      .select('error_message')
      .count('* as count')
      .groupBy('error_message')
      .orderBy('count', 'desc')
      .limit(5);

    return res.json({
      stats,
      topErrorTypes,
      topErrorMessages,
      timeRange,
    });
  } catch (err) {
    logger.error('Error getting error statistics:', err);
    return res.status(500).json({ message: 'Error retrieving error statistics' });
  }
});

module.exports = router;
