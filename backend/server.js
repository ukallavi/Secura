const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const csrf = require('csurf');
const { 
  db, 
  checkDatabaseConnection, 
  closeDatabase, 
  getDatabaseHealth 
} = require('../database/db');
const { logger } = require('./utils/logger');
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
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(requestId());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(helmet());
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
const csrfProtection = csrf({ cookie: true });

// Apply rate limiting to routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth/two-factor', twoFactorLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api/passwords', apiLimiter, passwordRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

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

// Protected routes example
app.get('/api/user/profile', authenticate, requireTwoFactor, async (req, res) => {
  try {
    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'created_at')
      .where('id', req.user.id)
      .first();
    
    res.json(user);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin-only route example
app.get('/api/admin/users', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'status', 'created_at')
      .orderBy('created_at', 'desc');
    
    res.json(users);
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn('CSRF validation failed', { 
      requestId: req.id, 
      path: req.path,
      ip: req.ip
    });
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  
  logger.error('Unhandled error:', err, { 
    requestId: req.id, 
    path: req.path 
  });
  
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
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