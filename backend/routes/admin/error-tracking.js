// backend/routes/admin/error-tracking.js
const express = require('express');
const router = express.Router();
const db = require('../../../database/db');
const { logger } = require('../../utils/logger');
const { authenticateToken, authorizeRole } = require('../../middleware/auth');

// Middleware to ensure user is authenticated and an admin
router.use(authenticateToken);
router.use(authorizeRole(['admin']));

/**
 * @route GET /api/admin/error-tracking/stats
 * @desc Get error statistics for admin dashboard
 * @access Private (Admin)
 */
router.get('/stats', async (req, res) => {
  try {
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
    
    // Get recent errors
    const recentErrors = await db('error_logs')
      .where(timeFilter)
      .select(
        'id',
        'timestamp',
        'session_id',
        'url',
        'user_id',
        'error_type',
        'error_message',
        'error_status',
        'is_resolved',
        'resolved_at'
      )
      .orderBy('timestamp', 'desc')
      .limit(50);

    return res.json({
      stats,
      topErrorTypes,
      topErrorMessages,
      recentErrors,
      timeRange,
    });
  } catch (err) {
    logger.error('Error getting error statistics:', err);
    return res.status(500).json({ message: 'Error retrieving error statistics' });
  }
});

/**
 * @route GET /api/admin/error-tracking/:id
 * @desc Get details of a specific error
 * @access Private (Admin)
 */
router.get('/:id', async (req, res) => {
  try {
    const errorId = req.params.id;
    
    // Get error details
    const error = await db('error_logs')
      .where('id', errorId)
      .first();
    
    if (!error) {
      return res.status(404).json({ message: 'Error record not found' });
    }
    
    // If there's context data, parse it
    if (error.context) {
      try {
        error.context = JSON.parse(error.context);
      } catch (e) {
        // In case JSON parsing fails
        error.context = { rawContext: error.context };
      }
    }
    
    // Get related errors (same type and message)
    const relatedErrors = await db('error_logs')
      .where('error_type', error.error_type)
      .where('error_message', error.error_message)
      .whereNot('id', errorId)
      .select('id', 'timestamp', 'user_id', 'is_resolved')
      .orderBy('timestamp', 'desc')
      .limit(5);
    
    return res.json({
      error,
      relatedErrors
    });
  } catch (err) {
    logger.error(`Error fetching error details for ID ${req.params.id}:`, err);
    return res.status(500).json({ message: 'Error retrieving error details' });
  }
});

/**
 * @route POST /api/admin/error-tracking/:id/resolve
 * @desc Mark an error as resolved
 * @access Private (Admin)
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const errorId = req.params.id;
    const { notes } = req.body;
    
    // Check if error exists
    const error = await db('error_logs')
      .where('id', errorId)
      .first();
    
    if (!error) {
      return res.status(404).json({ message: 'Error record not found' });
    }
    
    // Update error as resolved
    await db('error_logs')
      .where('id', errorId)
      .update({
        is_resolved: true,
        resolved_at: db.fn.now(),
        resolved_by: req.user.id,
        resolution_notes: notes || null
      });
    
    // Log the action
    logger.info(`Error ID ${errorId} marked as resolved by admin ${req.user.id}`);
    
    return res.json({
      success: true,
      message: 'Error marked as resolved'
    });
  } catch (err) {
    logger.error(`Error resolving error ID ${req.params.id}:`, err);
    return res.status(500).json({ message: 'Failed to resolve error' });
  }
});

/**
 * @route POST /api/admin/error-tracking/:id/reopen
 * @desc Reopen a resolved error
 * @access Private (Admin)
 */
router.post('/:id/reopen', async (req, res) => {
  try {
    const errorId = req.params.id;
    
    // Check if error exists
    const error = await db('error_logs')
      .where('id', errorId)
      .first();
    
    if (!error) {
      return res.status(404).json({ message: 'Error record not found' });
    }
    
    // Update error as not resolved
    await db('error_logs')
      .where('id', errorId)
      .update({
        is_resolved: false,
        resolved_at: null,
        resolved_by: null
      });
    
    // Log the action
    logger.info(`Error ID ${errorId} reopened by admin ${req.user.id}`);
    
    return res.json({
      success: true,
      message: 'Error reopened'
    });
  } catch (err) {
    logger.error(`Error reopening error ID ${req.params.id}:`, err);
    return res.status(500).json({ message: 'Failed to reopen error' });
  }
});

/**
 * @route DELETE /api/admin/error-tracking/:id
 * @desc Delete an error record
 * @access Private (Admin)
 */
router.delete('/:id', async (req, res) => {
  try {
    const errorId = req.params.id;
    
    // Check if error exists
    const error = await db('error_logs')
      .where('id', errorId)
      .first();
    
    if (!error) {
      return res.status(404).json({ message: 'Error record not found' });
    }
    
    // Delete the error
    await db('error_logs')
      .where('id', errorId)
      .delete();
    
    // Log the action
    logger.info(`Error ID ${errorId} deleted by admin ${req.user.id}`);
    
    return res.json({
      success: true,
      message: 'Error record deleted'
    });
  } catch (err) {
    logger.error(`Error deleting error ID ${req.params.id}:`, err);
    return res.status(500).json({ message: 'Failed to delete error record' });
  }
});

module.exports = router;
