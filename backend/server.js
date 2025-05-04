const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { doubleCsrf } = require('csrf-csrf');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const { 
  db, 
  checkDatabaseConnection, 
  closeDatabase, 
  getDatabaseHealth,
  runMigrations
} = require('../database/db');
const { logger } = require('./utils/logger');
const { purgeOldErrorLogs, purgeOldAuditLogs } = require('./utils/cleanup');
require('dotenv').config();

// Import middleware
const { 
  apiLimiter, 
  authLimiter, 
  twoFactorLimiter, 
  passwordResetLimiter,
  corsMiddleware,
  helmetMiddleware,
  requestId
} = require('./middleware/security');
const monitorDatabaseHealth = require('./middleware/databaseMonitor');

// Import routes
const authRoutes = require('./routes/auth');
const passwordRoutes = require('./routes/passwords');
const passwordStatsRoutes = require('./routes/passwords-stats');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const errorTrackingRoutes = require('./routes/error-tracking');

// API versioning
const API_V1_PREFIX = '/api/v1';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(requestId);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Configure CORS for development - more permissive settings
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  exposedHeaders: ['X-CSRF-Token', 'Content-Type'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Handle preflight requests
app.options('*', cors());

// Add CORS headers to all responses as a backup
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});
// Configure Helmet for development environment
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(morgan('combined'));
app.use(monitorDatabaseHealth);

// Check database connection on startup
checkDatabaseConnection()
  .then(connected => {
    if (!connected) {
      logger.error('Failed to connect to database. Exiting application.');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('Error checking database connection:', error);
    process.exit(1);
  });

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Get user from database using Knex instead of direct pool
    const user = await db('users')
      .where('id', decoded.userId)
      .first();
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    if (user.status === 'locked') {
      return res.status(403).json({ error: 'Account locked', code: 'ACCOUNT_LOCKED' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Authorization middleware for role-based access
const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Two-factor authentication check middleware
const requireTwoFactor = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user has 2FA enabled
    const user = await db('users')
      .select('two_factor_enabled', 'two_factor_verified')
      .where('id', req.user.id)
      .first();
    
    if (user.two_factor_enabled && !req.headers['x-two-factor-verified']) {
      return res.status(403).json({ 
        error: 'Two-factor authentication required', 
        code: 'TWO_FACTOR_REQUIRED' 
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error in two-factor middleware:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Token generation function
const generateTokens = async (userId, ipAddress, userAgent) => {
  // Generate a unique token ID
  const tokenId = require('crypto').randomBytes(16).toString('hex');
  
  // Create access token
  const accessToken = jwt.sign(
    { 
      userId, 
      type: 'access',
      tokenId
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  // Create refresh token
  const refreshToken = jwt.sign(
    { 
      userId, 
      type: 'refresh',
      tokenId
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  // Store refresh token in database using Knex
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await db('refresh_tokens').insert({
    token_id: tokenId,
    user_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
    expires_at: expiresAt,
    created_at: db.fn.now()
  });
  
  return { accessToken, refreshToken, tokenId };
};

// Token refresh middleware
const refreshTokens = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const currentTokenId = req.cookies.tokenId;
    
    if (!refreshToken || !currentTokenId) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Check if token exists in database and hasn't been revoked using Knex
    const token = await db('refresh_tokens')
      .where({
        token_id: currentTokenId,
        user_id: decoded.userId,
        revoked: 0
      })
      .whereRaw('expires_at > NOW()')
      .first();
    
    if (!token) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    
    // Revoke current token
    await db('refresh_tokens')
      .where('token_id', currentTokenId)
      .update({ 
        revoked: 1,
        updated_at: db.fn.now()
      });
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken, tokenId } = 
      await generateTokens(decoded.userId, req.ip, req.headers['user-agent']);
    
    // Set cookies
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.cookie('tokenId', tokenId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    return res.json({ accessToken });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    logger.error('Error refreshing token:', error);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// CSRF protection - apply after cookie parser
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    secure: process.env.NODE_ENV === 'production'
  },
  size: 64,
  getSecret: () => process.env.SESSION_SECRET
});

// Middleware to handle CSRF protection
const csrfProtection = doubleCsrfProtection;

// CSRF token endpoints (both paths for compatibility)
app.get('/api/csrf-token', (req, res) => {
  return res.json({ token: generateToken(req, res) });
});

// Additional CSRF token endpoint at root level for compatibility
app.get('/csrf-token', (req, res) => {
  return res.json({ token: generateToken(req, res) });
});

// Health check endpoint
app.get('/api/healthcheck', (req, res) => {
  return res.json({ status: 'ok', message: 'Backend is healthy', timestamp: new Date().toISOString() });
});

// Simple test endpoint for connectivity testing
app.get('/api/test', (req, res) => {
  return res.json({ message: 'Backend connection successful', timestamp: new Date().toISOString() });
});

// Root endpoint for basic testing
app.get('/', (req, res) => {
  return res.json({ message: 'Secura API is running', version: '1.0.0' });
});

// Handle preflight for all routes
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use('/api/auth', authRoutes);

app.post('/api/auth/login', authLimiter);
app.post('/api/auth/register', authLimiter);
app.use('/api/auth/two-factor', twoFactorLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api/passwords', apiLimiter, passwordRoutes);
app.use('/api/passwords', apiLimiter, passwordStatsRoutes);
app.use('/api/users', apiLimiter, userRoutes);

// Security routes
const securityRoutes = require('./routes/security');
app.use('/api/security', apiLimiter, securityRoutes);
// Add a direct test endpoint for admin stats
app.get('/api/admin-test/stats', (req, res) => {
  console.log('Admin test stats endpoint called');
  res.json({
    totalUsers: 1,
    activeUsers: 1,
    totalPasswords: 10,
    weakPasswords: 2,
    reusedPasswords: 1,
    sharedPasswords: 0,
    securityAlerts: 0
  });
});

// Regular admin routes
app.use('/api/admin', apiLimiter, adminRoutes);

// Admin error tracking routes
const adminErrorTrackingRoutes = require('./routes/admin/error-tracking');
app.use('/api/admin/error-tracking', apiLimiter, adminErrorTrackingRoutes);

// Error tracking routes (no authentication required for client error reporting)
// Note: errorTrackingRoutes is already declared at the top of the file

// Special rate limiter for error reporting to prevent abuse
const errorReportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 errors per IP per 5 minutes
  message: { error: 'Too many error reports from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use a combination of IP and session ID if available
    const sessionId = req.body?.session_id;
    return sessionId ? `${req.ip}-${sessionId}` : req.ip;
  }
});

app.use(`${API_V1_PREFIX}/error-tracking`, errorReportLimiter, errorTrackingRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealth = await getDatabaseHealth();
  res.json({
    status: 'ok',
    timestamp: new Date(),
    database: dbHealth
  });
});

// CSRF token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Token refresh endpoint
app.post('/api/auth/refresh', refreshTokens);

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  try {
    const tokenId = req.cookies.tokenId;
    
    if (tokenId) {
      // Revoke the token using Knex
      await db('refresh_tokens')
        .where('token_id', tokenId)
        .update({ 
          revoked: 1,
          updated_at: db.fn.now()
        });
    }
    
    // Clear cookies
    res.clearCookie('refreshToken');
    res.clearCookie('tokenId');
    
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Error during logout:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Schedule cleanup jobs

// Run error logs cleanup daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('Running scheduled error logs cleanup');
    const retentionDays = parseInt(process.env.ERROR_RETENTION_DAYS || '90');
    const result = await purgeOldErrorLogs(retentionDays, true);
    logger.info(`Scheduled error logs cleanup completed: ${result.purged} logs purged`);
  } catch (error) {
    logger.error('Error during scheduled error logs cleanup:', error);
  }
});

// Run audit logs cleanup weekly on Sunday at 4 AM
cron.schedule('0 4 * * 0', async () => {
  try {
    logger.info('Running scheduled audit logs cleanup');
    const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '365');
    const result = await purgeOldAuditLogs(retentionDays, true);
    logger.info(`Scheduled audit logs cleanup completed: ${result.purged} logs purged`);
  } catch (error) {
    logger.error('Error during scheduled audit logs cleanup:', error);
  }
});

// Start server
const startServer = async () => {
  try {
    // Check database connection
    await checkDatabaseConnection();
    logger.info('Database connection successful');
    
    // Run migrations
    logger.info('Running database migrations...');
    const migrations = await runMigrations();
    logger.info(`Migrations completed: Batch ${migrations[0]}, ${migrations[1].length} files`);
    
    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      server.close(async () => {
        logger.info('HTTP server closed');
        await closeDatabase();
        process.exit(0);
      });
    });
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const server = startServer();

// Already handled in startServer function

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = {
  app,
  server,
  authenticate,
  authorize,
  requireTwoFactor,
  generateTokens
};