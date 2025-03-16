// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { logger, logSecurityEvent } = require('../utils/logger');
const ActivityLog = require('../../database/models/ActivityLog');
const User = require('../../database/models/User');

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

// Activity logging
const logActivity = async (userId, action, details, req) => {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const activityLog = new ActivityLog();
    await activityLog.create({
      user_id: userId,
      action: action,
      details: details,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  } catch (error) {
    logger.error('Error logging activity:', error);
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