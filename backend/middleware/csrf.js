/**
 * CSRF Protection Middleware
 * Provides CSRF token generation and validation
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

// Store for CSRF tokens - in production, use Redis or another distributed store
const tokenStore = new Map();

// Token expiration time (1 hour)
const TOKEN_EXPIRY = 60 * 60 * 1000;

/**
 * Generate a CSRF token for a session
 * @param {string} sessionId - User's session ID
 * @returns {string} CSRF token
 */
function generateCsrfToken(sessionId) {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store the token with expiration time
  tokenStore.set(sessionId, {
    token,
    expires: Date.now() + TOKEN_EXPIRY
  });
  
  return token;
}

/**
 * Clean up expired tokens
 * Should be called periodically
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  
  for (const [sessionId, data] of tokenStore.entries()) {
    if (data.expires < now) {
      tokenStore.delete(sessionId);
    }
  }
}

/**
 * Middleware to generate and set CSRF token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function setCsrfToken(req, res, next) {
  // Clean up expired tokens periodically
  if (Math.random() < 0.1) { // 10% chance on each request
    cleanupExpiredTokens();
  }
  
  // Get or create session ID
  const sessionId = req.sessionID || req.cookies['connect.sid'] || req.ip;
  
  // Generate token
  const token = generateCsrfToken(sessionId);
  
  // Set token in response header
  res.setHeader('X-CSRF-Token', token);
  
  // Also make it available in the request for templates
  req.csrfToken = token;
  
  next();
}

/**
 * Middleware to validate CSRF token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateCsrfToken(req, res, next) {
  // Skip validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Get session ID
  const sessionId = req.sessionID || req.cookies['connect.sid'] || req.ip;
  
  // Get token from request
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  // Get stored token data
  const storedData = tokenStore.get(sessionId);
  
  // Validate token
  if (!token || !storedData || token !== storedData.token) {
    logger.warn(`CSRF validation failed for ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      sessionId,
      hasToken: !!token,
      hasStoredToken: !!storedData
    });
    
    return res.status(403).json({
      error: 'Invalid or missing CSRF token',
      message: 'Please refresh the page and try again'
    });
  }
  
  // Check if token is expired
  if (storedData.expires < Date.now()) {
    tokenStore.delete(sessionId);
    
    logger.warn(`Expired CSRF token used for ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      sessionId
    });
    
    return res.status(403).json({
      error: 'Expired CSRF token',
      message: 'Please refresh the page and try again'
    });
  }
  
  // Valid token, proceed
  next();
}

module.exports = {
  generateCsrfToken,
  setCsrfToken,
  validateCsrfToken,
  cleanupExpiredTokens
};
