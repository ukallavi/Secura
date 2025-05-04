// backend/middleware/rateLimiter.js
const { db } = require('../../database/db');
const { logger } = require('../utils/logger');

/**
 * Create a rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Maximum requests allowed in window
 * @param {Function} options.keyGenerator - Function to generate rate limit key
 * @returns {Function} Express middleware
 */
function createRateLimiter(options) {
  const {
    windowMs = 60 * 1000, // 1 minute default
    maxRequests = 10,
    keyGenerator = (req) => req.ip
  } = options;
  
  return async (req, res, next) => {
    try {
      const key = keyGenerator(req);
      
      // Clean up expired entries
      await db('rate_limits')
        .where('expires_at', '<', new Date())
        .delete();
      
      // Count existing points for this key
      const [result] = await db('rate_limits')
        .where('key', key)
        .where('expires_at', '>', new Date())
        .count('id as count')
        .sum('points as points');
      
      const currentPoints = result.points || 0;
      
      if (currentPoints >= maxRequests) {
        logger.warn(`Rate limit exceeded for ${key}`);
        return res.status(429).json({
          error: 'Too many requests, please try again later'
        });
      }
      
      // Add new rate limit entry
      const expiresAt = new Date(Date.now() + windowMs);
      await db('rate_limits').insert({
        key,
        points: 1,
        expires_at: expiresAt
      });
      
      // Add headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - currentPoints - 1);
      
      next();
    } catch (error) {
      logger.error('Rate limiter error:', { 
        error: error.message, 
        stack: error.stack 
      });
      
      // If the database fails, we should still allow the request to proceed
      // Otherwise, a database failure would block all API access
      next();
    }
  };
}

// Create specific rate limiters with different configurations
const rateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10
});

const authLimiter = createRateLimiter({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 300000, // 5 minutes
  maxRequests: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS) || 5,
  keyGenerator: (req) => req.ip + ':auth'
});

const passwordResetLimiter = createRateLimiter({
  windowMs: 3600000, // 1 hour
  maxRequests: 3,
  keyGenerator: (req) => req.ip + ':passwordReset'
});

const twoFactorLimiter = createRateLimiter({
  windowMs: 300000, // 5 minutes
  maxRequests: 10,
  keyGenerator: (req) => req.ip + ':twoFactor'
});

module.exports = {
  createRateLimiter,
  rateLimiter,
  authLimiter,
  passwordResetLimiter,
  twoFactorLimiter
};