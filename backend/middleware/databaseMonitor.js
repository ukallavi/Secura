// backend/middleware/databaseMonitor.js
const { getDatabaseHealth } = require('../../database/db');
const { logger } = require('../utils/logger');

const MAX_RESPONSE_TIME = 500; // Maximum acceptable response time in ms

// Middleware to monitor database health
const monitorDatabaseHealth = async (req, res, next) => {
  // Only check on a small percentage of requests to avoid overhead
  if (Math.random() < 0.05) { // 5% of requests
    try {
      const health = await getDatabaseHealth();
      
      if (health.status !== 'connected') {
        logger.error('Database health check failed during request', health);
      } else if (parseInt(health.responseTime) > MAX_RESPONSE_TIME) {
        logger.warn('Database response time is high', {
          responseTime: health.responseTime,
          threshold: MAX_RESPONSE_TIME
        });
      }
      
      // Store health info in request object for potential use in controllers
      req.dbHealth = health;
    } catch (error) {
      logger.error('Error in database monitoring middleware:', error);
    }
  }
  
  next();
};

module.exports = monitorDatabaseHealth;