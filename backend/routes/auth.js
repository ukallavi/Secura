const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { AUTH_ACTIONS } = require('../utils/activity-constants');
const { authenticator } = require('otplib');
const { db } = require('../../database/db');
const { authenticateToken, logActivity } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { rateLimiter, authLimiter, passwordResetLimiter, twoFactorLimiter } = require('../middleware/rateLimiter');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

/**
 * User registration
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, encryptionSalt, authSalt, recoveryOptions } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Validate recovery options
    if (!recoveryOptions || (!recoveryOptions.useBackupCodes && !recoveryOptions.useEmailRecovery)) {
      return res.status(400).json({ message: 'At least one recovery option must be selected' });
    }
    
    // Validate recovery email if email recovery is selected
    if (recoveryOptions.useEmailRecovery && !recoveryOptions.recoveryEmail) {
      return res.status(400).json({ message: 'Recovery email is required when email recovery is selected' });
    }
    
    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password for authentication
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate a random encryption salt if not provided
    // This salt is used for client-side encryption of sensitive data
    const salt = encryptionSalt || crypto.randomBytes(32).toString('hex');
    
    // Create user
    const [userId] = await db('users').insert({
      email,
      password: hashedPassword,
      role: 'user',
      encryption_salt: salt,
      auth_salt: authSalt,
      recovery_email: recoveryOptions.useEmailRecovery ? recoveryOptions.recoveryEmail : null,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });
    
    // Log activity
    await logActivity(userId, 'REGISTER', { email }, req);
    
    // Generate backup codes if selected
    if (recoveryOptions.useBackupCodes) {
      // Generate 10 random backup codes
      const backupCodes = [];
      for (let i = 0; i < 10; i++) {
        // Generate a random 8-character code with format XXXX-XXXX
        const code = `${generateRandomCode(4)}-${generateRandomCode(4)}`;
        backupCodes.push(code);
      }
      
      // Hash each backup code before storing
      for (const code of backupCodes) {
        const hashedCode = await bcrypt.hash(code, 10);
        await db('backup_codes').insert({
          user_id: userId,
          code: hashedCode,
          used: false,
          created_at: db.fn.now()
        });
      }
      
      // Return the backup codes to the client
      res.status(201).json({ 
        message: 'User registered successfully',
        encryptionSalt: salt, // Return the salt to the client for initial setup
        backupCodes: recoveryOptions.useBackupCodes ? backupCodes.map(code => ({ code, used: false })) : []
      });
    } else {
      res.status(201).json({ 
        message: 'User registered successfully',
        encryptionSalt: salt // Return the salt to the client for initial setup
      });
    }
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

/**
 * Get authentication and encryption salts for a user
 * GET /api/auth/salt
 */
router.get('/salt', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Find user
    const user = await db('users').where({ email }).first();
    
    if (!user) {
      // For security reasons, don't reveal that the user doesn't exist
      // Instead, return a generic error or fake salts
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return the auth salt and encryption salt
    res.status(200).json({
      authSalt: user.auth_salt,
      encryptionSalt: user.encryption_salt
    });
  } catch (error) {
    logger.error('Error retrieving salts:', error);
    res.status(500).json({ message: 'Server error while retrieving authentication information' });
  }
});

/**
 * User login
 * POST /api/auth/login
 */
router.post('/login', authLimiter, async (req, res) => {
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
    
    console.log('User found:', user);
    console.log('Password:', password);
    console.log('User password:', user.password);
    
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
        await logActivity(user.id, AUTH_ACTIONS.FAILED_LOGIN, { reason: 'Invalid 2FA token' }, req);
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
    await logActivity(user.id, AUTH_ACTIONS.LOGIN, { email: user.email }, req);
    
    // Set JWT token as HTTP-only cookie
    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    res.status(200).json({
      message: 'Login successful',
      token: jwtToken, // Still include in response for backward compatibility
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: !!user.two_factor_enabled
      },
      encryptionSalt: user.encryption_salt // Send encryption salt for client-side encryption
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
router.post('/2fa/setup', authenticateToken, async (req, res) => {
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
 * Generate backup codes for two-factor authentication
 * POST /api/auth/2fa/backup-codes/generate
 */
router.post('/2fa/backup-codes/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if 2FA is enabled
    const user = await db('users').where({ id: userId }).first();
    
    if (!user.totp_enabled) {
      return res.status(400).json({ message: 'Two-factor authentication must be enabled to generate backup codes' });
    }
    
    // Generate 10 random backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      // Generate a random 8-character code with format XXXX-XXXX
      const code = `${generateRandomCode(4)}-${generateRandomCode(4)}`;
      backupCodes.push(code);
    }
    
    // Create a copy of the backup codes to return to the user
    const backupCodesForUser = [...backupCodes];
    
    // Hash each backup code before storing
    const hashedCodes = [];
    for (const code of backupCodes) {
      const hashedCode = await bcrypt.hash(code, 10);
      hashedCodes.push({
        code: hashedCode,
        used: false
      });
    }
    
    // Store hashed backup codes in the database
    // First, delete any existing backup codes for this user
    await db('backup_codes').where({ user_id: userId }).del();
    
    // Then insert the new backup codes
    for (const hashedCode of hashedCodes) {
      await db('backup_codes').insert({
        user_id: userId,
        code: hashedCode.code,
        used: false,
        created_at: db.fn.now()
      });
    }
    
    // Log activity
    await logActivity(userId, 'GENERATE_BACKUP_CODES', {}, req);
    
    // Return the plaintext backup codes to the user
    res.status(200).json({
      message: 'Backup codes generated successfully',
      codes: backupCodesForUser.map(code => ({
        code,
        used: false
      }))
    });
  } catch (error) {
    logger.error('Error generating backup codes:', error);
    res.status(500).json({ message: 'Server error while generating backup codes' });
  }
});

/**
 * Verify a backup code for 2FA
 * POST /api/auth/2fa/backup-codes/verify
 */
router.post('/2fa/backup-codes/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and backup code are required' });
    }
    
    // Find user
    const user = await db('users').where({ email }).first();
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled for this account' });
    }
    
    // Get all backup codes for the user
    const backupCodes = await db('backup_codes')
      .where({ user_id: user.id, used: false })
      .select('id', 'code');
    
    // Check if the provided code matches any of the hashed backup codes
    let matchedCodeId = null;
    for (const backupCode of backupCodes) {
      const isMatch = await bcrypt.compare(code, backupCode.code);
      if (isMatch) {
        matchedCodeId = backupCode.id;
        break;
      }
    }
    
    if (!matchedCodeId) {
      await logActivity(user.id, 'BACKUP_CODE_FAILED', { email }, req);
      return res.status(401).json({ message: 'Invalid backup code' });
    }
    
    // Mark the backup code as used
    await db('backup_codes')
      .where({ id: matchedCodeId })
      .update({ used: true, used_at: db.fn.now() });
    
    // Log activity
    await logActivity(user.id, 'BACKUP_CODE_USED', { email }, req);
    
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
    
    // Set JWT token as HTTP-only cookie
    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    res.status(200).json({
      message: 'Backup code verification successful',
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: true
      },
      encryptionSalt: user.encryption_salt
    });
  } catch (error) {
    logger.error('Backup code verification error:', error);
    res.status(500).json({ message: 'Server error during backup code verification' });
  }
});

/**
 * Send email recovery verification code
 * POST /api/auth/2fa/email-recovery/send-code
 */
router.post('/2fa/email-recovery/send-code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Generate a random 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash the verification code before storing
    const hashedCode = await bcrypt.hash(verificationCode, 10);
    
    // Store the code in the database with expiration time (30 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    
    // Check if a recovery email record already exists for this user
    const existingRecord = await db('recovery_emails').where({ user_id: userId }).first();
    
    if (existingRecord) {
      // Update existing record
      await db('recovery_emails')
        .where({ user_id: userId })
        .update({
          email,
          verification_code: hashedCode,
          verified: false,
          expires_at: expiresAt,
          updated_at: db.fn.now()
        });
    } else {
      // Create new record
      await db('recovery_emails').insert({
        user_id: userId,
        email,
        verification_code: hashedCode,
        verified: false,
        expires_at: expiresAt,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
    }
    
    // In a real application, send the verification code to the user's email
    // For this example, we'll just log it
    logger.info(`Recovery email verification code for ${email}: ${verificationCode}`);
    
    // TODO: Implement actual email sending here
    // sendEmail(email, 'Your Secura Recovery Code', `Your verification code is: ${verificationCode}`);
    
    // Log activity
    await logActivity(userId, 'RECOVERY_EMAIL_CODE_SENT', { email }, req);
    
    res.status(200).json({ 
      message: 'Verification code sent successfully',
      expiresAt
    });
  } catch (error) {
    logger.error('Error sending recovery email code:', error);
    res.status(500).json({ message: 'Server error while sending verification code' });
  }
});

/**
 * Verify email recovery code
 * POST /api/auth/2fa/email-recovery/verify-code
 */
router.post('/2fa/email-recovery/verify-code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }
    
    // Get the recovery email record
    const recoveryEmail = await db('recovery_emails')
      .where({ user_id: userId, email })
      .first();
    
    if (!recoveryEmail) {
      return res.status(404).json({ message: 'Recovery email record not found' });
    }
    
    // Check if the code has expired
    if (new Date() > new Date(recoveryEmail.expires_at)) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }
    
    // Verify the code
    const isCodeValid = await bcrypt.compare(code, recoveryEmail.verification_code);
    
    if (!isCodeValid) {
      await logActivity(userId, 'RECOVERY_EMAIL_VERIFICATION_FAILED', { email }, req);
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    // Mark the email as verified
    await db('recovery_emails')
      .where({ user_id: userId })
      .update({
        verified: true,
        updated_at: db.fn.now()
      });
    
    // Update the user's recovery_email field
    await db('users')
      .where({ id: userId })
      .update({
        recovery_email: email,
        updated_at: db.fn.now()
      });
    
    // Log activity
    await logActivity(userId, 'RECOVERY_EMAIL_VERIFIED', { email }, req);
    
    res.status(200).json({ 
      message: 'Recovery email verified successfully',
      email
    });
  } catch (error) {
    logger.error('Error verifying recovery email:', error);
    res.status(500).json({ message: 'Server error while verifying recovery email' });
  }
});

/**
 * Get recovery email status
 * GET /api/auth/2fa/email-recovery
 */
router.get('/2fa/email-recovery', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get the user's recovery email
    const user = await db('users')
      .where({ id: userId })
      .select('recovery_email')
      .first();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      recoveryEmail: user.recovery_email || null,
      isVerified: !!user.recovery_email
    });
  } catch (error) {
    logger.error('Error getting recovery email:', error);
    res.status(500).json({ message: 'Server error while getting recovery email' });
  }
});

/**
 * Initiate 2FA recovery via email
 * POST /api/auth/2fa/email-recovery/recover
 */
router.post('/2fa/email-recovery/recover', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Find user by email
    const user = await db('users').where({ email }).first();
    
    if (!user) {
      // For security reasons, don't reveal that the user doesn't exist
      return res.status(200).json({ message: 'If a recovery email is associated with this account, a recovery code has been sent' });
    }
    
    // Check if 2FA is enabled and recovery email is set
    if (!user.two_factor_enabled || !user.recovery_email) {
      // For security reasons, don't reveal specific details
      return res.status(200).json({ message: 'If a recovery email is associated with this account, a recovery code has been sent' });
    }
    
    // Generate a random 8-character recovery token
    const recoveryToken = generateRandomCode(8);
    
    // Hash the recovery token before storing
    const hashedToken = await bcrypt.hash(recoveryToken, 10);
    
    // Store the token in the database with expiration time (15 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    // Store or update the recovery token
    await db('recovery_tokens').insert({
      user_id: user.id,
      token: hashedToken,
      expires_at: expiresAt,
      created_at: db.fn.now()
    }).onConflict('user_id').merge();
    
    // In a real application, send the recovery token to the user's recovery email
    // For this example, we'll just log it
    logger.info(`2FA recovery token for ${email} (sent to ${user.recovery_email}): ${recoveryToken}`);
    
    // TODO: Implement actual email sending here
    // sendEmail(user.recovery_email, 'Your Secura 2FA Recovery Code', `Your recovery code is: ${recoveryToken}`);
    
    // Log activity
    await logActivity(user.id, 'TWO_FACTOR_RECOVERY_INITIATED', { email: user.recovery_email }, req);
    
    res.status(200).json({ 
      message: 'If a recovery email is associated with this account, a recovery code has been sent',
      recoveryEmail: user.recovery_email.replace(/^(.{3})(.*)@(.{3})(.*)$/, '$1***@$3***')
    });
  } catch (error) {
    logger.error('Error initiating 2FA recovery:', error);
    res.status(500).json({ message: 'Server error while initiating recovery' });
  }
});

/**
 * Verify 2FA recovery token
 * POST /api/auth/2fa/email-recovery/verify-token
 */
router.post('/2fa/email-recovery/verify-token', async (req, res) => {
  try {
    const { email, token } = req.body;
    
    if (!email || !token) {
      return res.status(400).json({ message: 'Email and recovery token are required' });
    }
    
    // Find user by email
    const user = await db('users').where({ email }).first();
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Get the recovery token
    const recoveryRecord = await db('recovery_tokens')
      .where({ user_id: user.id })
      .first();
    
    if (!recoveryRecord) {
      return res.status(400).json({ message: 'No recovery was initiated or token has expired' });
    }
    
    // Check if the token has expired
    if (new Date() > new Date(recoveryRecord.expires_at)) {
      return res.status(400).json({ message: 'Recovery token has expired' });
    }
    
    // Verify the token
    const isTokenValid = await bcrypt.compare(token, recoveryRecord.token);
    
    if (!isTokenValid) {
      await logActivity(user.id, 'TWO_FACTOR_RECOVERY_FAILED', { email }, req);
      return res.status(401).json({ message: 'Invalid recovery token' });
    }
    
    // Delete the used token
    await db('recovery_tokens').where({ user_id: user.id }).del();
    
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
    
    // Set JWT token as HTTP-only cookie
    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    // Log activity
    await logActivity(user.id, 'TWO_FACTOR_RECOVERY_SUCCESSFUL', { email }, req);
    
    res.status(200).json({
      message: 'Recovery successful',
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: true
      },
      encryptionSalt: user.encryption_salt
    });
  } catch (error) {
    logger.error('Error verifying recovery token:', error);
    res.status(500).json({ message: 'Server error during recovery verification' });
  }
});

/**
 * Helper function to generate random codes
 */
function generateRandomCode(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Verify and enable two-factor authentication
 * POST /api/auth/2fa/verify
 */
router.post('/2fa/verify', authenticateToken, async (req, res) => {
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
        totp_enabled: true,
        totp_secret: user.two_factor_temp_secret,
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
router.post('/2fa/disable', authenticateToken, async (req, res) => {
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
router.get('/me', authenticateToken, async (req, res) => {
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
router.post('/change-password', authenticateToken, async (req, res) => {
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

/**
 * Generate backup codes for a user
 * POST /api/auth/two-factor/backup-codes/generate
 */
router.post('/two-factor/backup-codes/generate', async (req, res) => {
  try {
    // Verify JWT token
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    
    // Generate 10 random backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      // Generate a random 8-character code with format XXXX-XXXX
      const code = `${generateRandomCode(4)}-${generateRandomCode(4)}`;
      backupCodes.push(code);
    }
    
    // Store backup codes in the database
    // First, delete any existing backup codes for this user
    await db('backup_codes').where({ user_id: userId }).del();
    
    // Then insert the new backup codes (only store the hashed versions)
    for (let i = 0; i < backupCodes.length; i++) {
      const code = backupCodes[i];
      // Hash the code for secure storage
      const hashedCode = await bcrypt.hash(code, 10);
      
      await db('backup_codes').insert({
        user_id: userId,
        code: hashedCode, // Only store the hash in the database
        used: false,
        created_at: db.fn.now()
      });
    }
    
    // Log activity
    await logActivity(userId, 'BACKUP_CODES_GENERATED', {}, req);
    
    res.status(200).json({ 
      message: 'Backup codes generated successfully',
      backupCodes: backupCodes.map(code => ({ code, used: false }))
    });
  } catch (error) {
    logger.error('Error generating backup codes:', error);
    res.status(500).json({ message: 'Server error generating backup codes' });
  }
});

/**
 * Get backup codes for a user
 * GET /api/auth/two-factor/backup-codes
 */
router.get('/two-factor/backup-codes', async (req, res) => {
  try {
    // Verify JWT token
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    
    // Get backup codes for this user
    const backupCodes = await db('backup_codes')
      .where({ user_id: userId })
      .select('id', 'used', 'created_at');
    
    // We don't return the actual codes for security reasons
    // Just return how many are used/unused
    const usedCount = backupCodes.filter(code => code.used).length;
    const unusedCount = backupCodes.length - usedCount;
    
    res.status(200).json({ 
      message: 'Backup codes retrieved successfully',
      backupCodes: {
        total: backupCodes.length,
        used: usedCount,
        unused: unusedCount
      }
    });
  } catch (error) {
    logger.error('Error retrieving backup codes:', error);
    res.status(500).json({ message: 'Server error retrieving backup codes' });
  }
});

/**
 * Verify a backup code
 * POST /api/auth/two-factor/backup-codes/verify
 */
router.post('/two-factor/backup-codes/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and backup code are required' });
    }
    
    // Find user by email
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get backup codes for this user
    const backupCodes = await db('backup_codes')
      .where({ user_id: user.id, used: false })
      .select('id', 'code');
    
    // Check if the provided code matches any of the backup codes
    let codeMatched = false;
    let matchedCodeId = null;
    
    for (const backupCode of backupCodes) {
      if (await bcrypt.compare(code, backupCode.code)) {
        codeMatched = true;
        matchedCodeId = backupCode.id;
        break;
      }
    }
    
    if (!codeMatched) {
      return res.status(401).json({ message: 'Invalid backup code' });
    }
    
    // Mark the backup code as used
    await db('backup_codes')
      .where({ id: matchedCodeId })
      .update({ used: true, updated_at: db.fn.now() });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Set cookie with JWT token
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Log activity
    await logActivity(user.id, 'BACKUP_CODE_RECOVERY', {}, req);
    
    res.status(200).json({ 
      message: 'Backup code verified successfully',
      encryptionSalt: user.encryption_salt
    });
  } catch (error) {
    logger.error('Error verifying backup code:', error);
    res.status(500).json({ message: 'Server error verifying backup code' });
  }
});

/**
 * Initiate email recovery
 * POST /api/auth/two-factor/email-recovery/recover
 */
router.post('/two-factor/email-recovery/recover', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Find user by email
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has a recovery email
    if (!user.recovery_email) {
      return res.status(400).json({ message: 'No recovery email set for this account' });
    }
    
    // Generate a random 6-digit recovery code
    const recoveryCode = generateRandomCode(6);
    
    // Hash the recovery code
    const hashedCode = await bcrypt.hash(recoveryCode, 10);
    
    // Store the recovery code with an expiration time (1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    // Delete any existing recovery codes for this user
    await db('recovery_tokens').where({ user_id: user.id }).del();
    
    // Insert the new recovery code
    await db('recovery_tokens').insert({
      user_id: user.id,
      token: hashedCode,
      expires_at: expiresAt,
      created_at: db.fn.now()
    });
    
    // Send the recovery code to the user's recovery email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.recovery_email,
      subject: 'Secura Account Recovery Code',
      text: `Your Secura account recovery code is: ${recoveryCode}\n\nThis code will expire in 1 hour.`,
      html: `<p>Your Secura account recovery code is: <strong>${recoveryCode}</strong></p><p>This code will expire in 1 hour.</p>`
    });
    
    // Log activity
    await logActivity(user.id, 'EMAIL_RECOVERY_INITIATED', {}, req);
    
    // Mask the recovery email for privacy
    const maskedEmail = user.recovery_email.replace(/(.{2})(.*)(?=@)/, '$1****');
    
    res.status(200).json({ 
      message: 'Recovery code sent successfully',
      recoveryEmail: maskedEmail
    });
  } catch (error) {
    logger.error('Error initiating email recovery:', error);
    res.status(500).json({ message: 'Server error initiating email recovery' });
  }
});

/**
 * Verify email recovery token
 * POST /api/auth/two-factor/email-recovery/verify-token
 */
router.post('/two-factor/email-recovery/verify-token', async (req, res) => {
  try {
    const { email, token } = req.body;
    
    if (!email || !token) {
      return res.status(400).json({ message: 'Email and recovery code are required' });
    }
    
    // Find user by email
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get the recovery token for this user
    const recoveryToken = await db('recovery_tokens')
      .where({ user_id: user.id })
      .first();
    
    if (!recoveryToken) {
      return res.status(400).json({ message: 'No recovery code found or code expired' });
    }
    
    // Check if the token has expired
    if (new Date(recoveryToken.expires_at) < new Date()) {
      // Delete the expired token
      await db('recovery_tokens').where({ id: recoveryToken.id }).del();
      return res.status(400).json({ message: 'Recovery code has expired' });
    }
    
    // Verify the token
    if (!(await bcrypt.compare(token, recoveryToken.token))) {
      return res.status(401).json({ message: 'Invalid recovery code' });
    }
    
    // Delete the used token
    await db('recovery_tokens').where({ id: recoveryToken.id }).del();
    
    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Set cookie with JWT token
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Log activity
    await logActivity(user.id, 'EMAIL_RECOVERY_COMPLETED', {}, req);
    
    res.status(200).json({ 
      message: 'Recovery code verified successfully',
      encryptionSalt: user.encryption_salt
    });
  } catch (error) {
    logger.error('Error verifying recovery code:', error);
    res.status(500).json({ message: 'Server error verifying recovery code' });
  }
});

module.exports = router;