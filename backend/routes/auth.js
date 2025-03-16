const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { authenticator } = require('otplib');
const { db } = require('../../database/db');
const { validateToken, logActivity } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * User registration
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const [userId] = await db('users').insert({
      email,
      password: hashedPassword,
      role: 'user',
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });
    
    // Log activity
    await logActivity(userId, 'REGISTER', { email }, req);
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

/**
 * User login
 * POST /api/auth/login
 */
router.post('/login', rateLimiter, async (req, res) => {
  try {
    const { email, password, token } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Find user
    const user = await db('users').where({ email }).first();
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      await logActivity(user.id, 'LOGIN_FAILED', { reason: 'Invalid password' }, req);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if 2FA is enabled
    if (user.two_factor_enabled && user.two_factor_secret) {
      // If 2FA is enabled, check if token was provided
      if (!token) {
        return res.status(200).json({ 
          requiresTwoFactor: true,
          message: 'Two-factor authentication required'
        });
      }
      
      // Verify 2FA token
      const isTokenValid = authenticator.verify({
        token,
        secret: user.two_factor_secret
      });
      
      if (!isTokenValid) {
        await logActivity(user.id, 'LOGIN_FAILED', { reason: 'Invalid 2FA token' }, req);
        return res.status(401).json({ message: 'Invalid two-factor token' });
      }
    }
    
    // Create JWT token
    const jwtToken = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // Log successful login
    await logActivity(user.id, 'LOGIN', { email: user.email }, req);
    
    res.status(200).json({
      message: 'Login successful',
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: !!user.two_factor_enabled
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

/**
 * Setup two-factor authentication
 * POST /api/auth/2fa/setup
 */
router.post('/2fa/setup', validateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Generate new secret
    const secret = speakeasy.generateSecret({
      name: `Secura:${req.user.email}`
    });
    
    // Store secret temporarily
    await db('users')
      .where({ id: userId })
      .update({ 
        two_factor_temp_secret: secret.base32,
        updated_at: db.fn.now()
      });
    
    // Generate QR code
    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) {
        logger.error('QR code generation error:', err);
        return res.status(500).json({ message: 'Error generating QR code' });
      }
      
      res.status(200).json({
        message: 'Two-factor setup initiated',
        tempSecret: secret.base32,
        qrCode: dataUrl
      });
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({ message: 'Server error during 2FA setup' });
  }
});

/**
 * Verify and enable two-factor authentication
 * POST /api/auth/2fa/verify
 */
router.post('/2fa/verify', validateToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    
    // Get user with temp secret
    const user = await db('users')
      .where({ id: userId })
      .first('two_factor_temp_secret');
    
    if (!user || !user.two_factor_temp_secret) {
      return res.status(400).json({ message: 'Two-factor setup not initiated' });
    }
    
    // Verify token against temp secret
    const isTokenValid = authenticator.verify({
      token,
      secret: user.two_factor_temp_secret
    });
    
    if (!isTokenValid) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Enable 2FA
    await db('users')
      .where({ id: userId })
      .update({
        two_factor_enabled: true,
        two_factor_secret: user.two_factor_temp_secret,
        two_factor_temp_secret: null,
        updated_at: db.fn.now()
      });
    
    await logActivity(userId, 'ENABLE_2FA', {}, req);
    
    res.status(200).json({ message: 'Two-factor authentication enabled' });
  } catch (error) {
    logger.error('2FA verification error:', error);
    res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});

/**
 * Disable two-factor authentication
 * POST /api/auth/2fa/disable
 */
router.post('/2fa/disable', validateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Disable 2FA
    await db('users')
      .where({ id: userId })
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        updated_at: db.fn.now()
      });
    
    await logActivity(userId, 'DISABLE_2FA', {}, req);
    
    res.status(200).json({ message: 'Two-factor authentication disabled' });
  } catch (error) {
    logger.error('2FA disable error:', error);
    res.status(500).json({ message: 'Server error during 2FA disable' });
  }
});

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Find user
    const user = await db('users').where({ email }).first();
    
    if (!user) {
      // Don't reveal if user exists or not
      return res.status(200).json({ message: 'If your email exists in our system, you will receive a password reset link' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Save reset token
    await db('password_resets').insert({
      user_id: user.id,
      token: hashedToken,
      expires_at: db.raw('DATE_ADD(NOW(), INTERVAL 1 HOUR)'),
      created_at: db.fn.now()
    });
    
    // Send email with reset link (implementation depends on your email service)
    // sendPasswordResetEmail(user.email, resetToken);
    
    res.status(200).json({ message: 'If your email exists in our system, you will receive a password reset link' });
  } catch (error) {
    logger.error('Password reset request error:', error);
    res.status(500).json({ message: 'Server error during password reset request' });
  }
});

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }
    
    // Hash the token from the request
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find valid reset token
    const resetRequest = await db('password_resets')
      .where({ token: hashedToken })
      .where('expires_at', '>', db.fn.now())
      .first();
    
    if (!resetRequest) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update user password
    await db('users')
      .where({ id: resetRequest.user_id })
      .update({ 
        password: hashedPassword,
        updated_at: db.fn.now()
      });
    
    // Delete used token
    await db('password_resets')
      .where({ id: resetRequest.id })
      .del();
    
    // Log activity
    await logActivity(resetRequest.user_id, 'PASSWORD_RESET', {}, { ip: req.ip, headers: req.headers });
    
    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

/**
 * Verify JWT token and get current user
 * GET /api/auth/me
 */
router.get('/me', validateToken, async (req, res) => {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .first('id', 'email', 'role', 'two_factor_enabled', 'created_at', 'updated_at');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: !!user.two_factor_enabled,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error while fetching user data' });
  }
});

/**
 * Change password (authenticated)
 * POST /api/auth/change-password
 */
router.post('/change-password', validateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    
    // Get user with password
    const user = await db('users')
      .where({ id: req.user.id })
      .first('id', 'password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db('users')
      .where({ id: user.id })
      .update({ 
        password: hashedPassword,
        updated_at: db.fn.now()
      });
    
    // Log activity
    await logActivity(user.id, 'PASSWORD_CHANGE', {}, req);
    
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ message: 'Server error during password change' });
  }
});

module.exports = router;