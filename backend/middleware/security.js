const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { logger, logSecurityEvent } = require('../utils/logger');
const RateLimit = require('../models/RateLimit');
const SecurityAlert = require('../models/SecurityAlert');

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    // Store rate limit info in database for distributed environments
    store: {
      increment: async (key) => {
        const rateLimitModel = new RateLimit();
        const result = await rateLimitModel.increment(key, {
          windowMs,
          points: 1
        });
        return result.totalHits;
      },
      decrement: () => {}, // Optional
      resetKey: async (key) => {
        const rateLimitModel = new RateLimit();
        await rateLimitModel.reset(key);
      },
      // Required method for the store interface
      async get(key) {
        const rateLimitModel = new RateLimit();
        const now = Date.now();
        const result = await rateLimitModel.check(key, { windowMs });
        
        return {
          totalHits: result.totalHits,
          resetTime: new Date(now + windowMs)
        };
      }
    },
    keyGenerator: (req) => {
      // Use IP and route for rate limiting
      return `${req.ip}-${req.originalUrl}`;
    }
  });
};

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = createRateLimiter(
  15 * 60 * 1000, 
  100, 
  'Too many requests, please try again later.'
);

// Auth endpoints rate limiter - 10 attempts per 15 minutes
const authLimiter = createRateLimiter(
  15 * 60 * 1000, 
  10, 
  'Too many login attempts, please try again later.'
);

// 2FA rate limiter - 5 attempts per 15 minutes
const twoFactorLimiter = createRateLimiter(
  15 * 60 * 1000, 
  5, 
  'Too many 2FA attempts, please try again later.'
);

// Password reset rate limiter - 3 attempts per hour
const passwordResetLimiter = createRateLimiter(
  60 * 60 * 1000, 
  3, 
  'Too many password reset attempts, please try again later.'
);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
  maxAge: 600 // 10 minutes
};

// Helmet configuration for security headers
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  referrerPolicy: { policy: 'same-origin' },
  xssFilter: true,
  hsts: {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' }
};

// Request ID middleware for tracking requests
const requestId = (req, res, next) => {
  const id = uuidv4();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
};

// Log security events
const logSecurityEventMiddleware = async (userId, action, details, req) => {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Log to database
    const securityAlert = new SecurityAlert();
    await securityAlert.create({
      user_id: userId,
      action,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
      request_id: req.id || uuidv4()
    });
    
    // Log to application logs
    logger.warn(`Security event: ${action}`, { 
      userId, 
      action, 
      details, 
      ipAddress, 
      userAgent 
    });
  } catch (error) {
    logger.error('Error logging security event:', error);
  }
};

module.exports = {
  apiLimiter,
  authLimiter,
  twoFactorLimiter,
  passwordResetLimiter,
  corsMiddleware: cors(corsOptions),
  helmetMiddleware: helmet(helmetConfig),
  requestId,
  logSecurityEvent: logSecurityEventMiddleware
};