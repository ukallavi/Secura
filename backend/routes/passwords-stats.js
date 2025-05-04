const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../../database/db');
const { logger } = require('../utils/logger');

// All routes in this file require authentication
router.use(authenticateToken);

/**
 * Get password statistics for the authenticated user
 * GET /api/passwords/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get total count
    const totalCountResult = await db('passwords')
      .where({ user_id: userId })
      .count('id as count')
      .first();
    
    // Get recently added count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentlyAddedResult = await db('passwords')
      .where({ user_id: userId })
      .where('created_at', '>=', thirtyDaysAgo)
      .count('id as count')
      .first();
    
    // Get weak passwords count (this is a simplified example - in a real app, 
    // you might have a strength field or calculate it based on complexity)
    const weakPasswordsResult = await db('passwords')
      .where({ user_id: userId })
      .whereRaw('LENGTH(password) < 12') // Simple example - passwords shorter than 12 chars
      .count('id as count')
      .first();
    
    res.status(200).json({
      totalCount: totalCountResult.count || 0,
      recentlyAddedCount: recentlyAddedResult.count || 0,
      weakPasswordsCount: weakPasswordsResult.count || 0
    });
  } catch (error) {
    logger.error('Error fetching password statistics:', error);
    res.status(500).json({ 
      message: 'Server error while fetching password statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get recent passwords for the authenticated user
 * GET /api/passwords/recent
 */
router.get('/recent', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5; // Default to 5 recent passwords
    
    const passwords = await db('passwords')
      .where({ user_id: userId })
      .select('id', 'title as accountName', 'updated_at')
      .orderBy('updated_at', 'desc')
      .limit(limit);
    
    // Format the updated_at dates to be more user-friendly
    const formattedPasswords = passwords.map(password => {
      const updatedDate = new Date(password.updated_at);
      const now = new Date();
      const diffTime = Math.abs(now - updatedDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let lastUpdated;
      if (diffDays === 0) {
        lastUpdated = 'Today';
      } else if (diffDays === 1) {
        lastUpdated = 'Yesterday';
      } else if (diffDays < 7) {
        lastUpdated = `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        lastUpdated = `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
      } else {
        const months = Math.floor(diffDays / 30);
        lastUpdated = `${months} ${months === 1 ? 'month' : 'months'} ago`;
      }
      
      return {
        ...password,
        lastUpdated
      };
    });
    
    res.status(200).json({ passwords: formattedPasswords });
  } catch (error) {
    logger.error('Error fetching recent passwords:', error);
    res.status(500).json({ 
      message: 'Server error while fetching recent passwords',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
