// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { logger, logSecurityEvent } = require('../utils/logger');
const { db } = require('../../database/db');

// Authentication middleware using HTTP-only cookies
const authenticateToken = (req, res, next) => {
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

// Activity logging with timeout to prevent blocking
const logActivity = async (userId, action, details, req) => {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Create a promise that will timeout after 2 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Activity logging timed out')), 2000);
    });
    
    // Create the database insert promise
    const dbInsertPromise = db('activity_logs').insert({
      user_id: userId,
      action: action,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date()
    });
    
    // Race the promises - whichever completes first wins
    await Promise.race([dbInsertPromise, timeoutPromise])
      .catch(err => {
        if (err.message === 'Activity logging timed out') {
          logger.warn(`Activity logging timed out for action: ${action}, userId: ${userId}`);
        } else {
          throw err; // Re-throw other errors to be caught by the outer catch
        }
      });
    
    // Log security event (don't wait for this)
    logSecurityEvent(action, { userId, details });
  } catch (error) {
    logger.error('Error logging activity:', error);
    // Don't throw - activity logging should not break the application flow
  }
};

// Role-based authorization middleware
const authorizeRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions.' });
    }
    
    next();
  };
};

// Optional authentication middleware - doesn't require auth but will use it if provided
const optionalAuth = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    // No token, but that's okay
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // Token invalid, but we'll continue anyway
    next();
  }
};

module.exports = {
  authenticateToken,
  logActivity,
  authorizeRole,
  optionalAuth
};