const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { validationResult } = require('express-validator');
const User = require('../../database/models/User');
const TrustedDevice = require('../../database/models/TrustedDevice');
const VerificationCode = require('../../database/models/VerificationCode');
const { logger, logSecurityEvent } = require('../utils/logger');
const { sendEmail } = require('../utils/emailService');
const { getDeviceInfo } = require('../utils/deviceUtils');

/**
 * Generate 2FA secret and QR code
 */
const generateTwoFactorSecret = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if 2FA is already enabled
    if (user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    // Generate secret
    const secret = authenticator.generateSecret();
    
    // Create otpauth URL
    const appName = 'SecureVault'; // App name to display in authenticator app
    const otpauth = authenticator.keyuri(user.email, appName, secret);
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(otpauth);
    
    // Store secret temporarily
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Expire in 15 minutes
    
    await VerificationCode.create({
      user_id: userId,
      type: 'TWO_FACTOR_SETUP',
      code: secret,
      expires_at: expiresAt,
      created_at: new Date()
    });
    
    // Log 2FA setup initiation
    await logSecurityEvent(
      userId,
      'TWO_FACTOR_SETUP_INITIATED',
      'Two-factor authentication setup initiated',
      req
    );
    
    return res.json({
      secret,
      qrCode
    });
  } catch (error) {
    logger.error('Error generating 2FA secret:', error);
    return res.status(500).json({ error: 'Failed to generate 2FA secret' });
  }
};

/**
 * Verify and enable 2FA
 */
const enableTwoFactor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { token, password } = req.body;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if 2FA is already enabled
    if (user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Log failed attempt
      await logSecurityEvent(
        userId,
        'TWO_FACTOR_SETUP_FAILED',
        'Failed 2FA setup attempt - incorrect password',
        req
      );
      
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Get stored secret
    const verificationRecord = await VerificationCode.findOne({
      user_id: userId,
      type: 'TWO_FACTOR_SETUP'
    });
    
    if (!verificationRecord) {
      return res.status(400).json({ error: 'No active 2FA setup found. Please restart the process.' });
    }
    
    // Check if code is expired
    if (new Date(verificationRecord.expires_at) < new Date()) {
      // Delete expired code
      await VerificationCode.delete({ id: verificationRecord.id });
      
      return res.status(400).json({ error: 'Setup session has expired. Please restart the process.' });
    }
    
    const secret = verificationRecord.code;
    
    // Verify token
    const isValid = authenticator.verify({ token, secret });
    
    if (!isValid) {
      // Log failed verification
      await logSecurityEvent(
        userId,
        'TWO_FACTOR_SETUP_FAILED',
        'Failed 2FA setup attempt - invalid token',
        req
      );
      
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    
    // Hash backup codes
    const hashedBackupCodes = [];
    for (const code of backupCodes) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(code, salt);
      hashedBackupCodes.push(hash);
    }
    
    // Enable 2FA
    await User.update(
      { 
        two_factor_enabled: true,
        two_factor_secret: secret,
        backup_codes: JSON.stringify(hashedBackupCodes),
        updated_at: new Date()
      },
      { id: userId }
    );
    
    // Delete verification record
    await VerificationCode.delete({ id: verificationRecord.id });
    
    // Trust current device if not already trusted
    const deviceInfo = getDeviceInfo(req);
    
    const existingDevice = await TrustedDevice.findOne({
      user_id: userId,
      device_fingerprint: deviceInfo.fingerprint,
      active: true
    });
    
    if (!existingDevice) {
      await TrustedDevice.create({
        user_id: userId,
        device_name: deviceInfo.name,
        device_fingerprint: deviceInfo.fingerprint,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ip_address: req.ip,
        last_used: new Date(),
        active: true,
        created_at: new Date()
      });
    }
    
    // Log successful 2FA setup
    await logSecurityEvent(
      userId,
      'TWO_FACTOR_ENABLED',
      'Two-factor authentication enabled successfully',
      req
    );
    
    return res.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes
    });
  } catch (error) {
    logger.error('Error enabling 2FA:', error);
    return res.status(500).json({ error: 'Failed to enable 2FA' });
  }
};

/**
 * Disable 2FA
 */
const disableTwoFactor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { password, token } = req.body;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Log failed attempt
      await logSecurityEvent(
        userId,
        'TWO_FACTOR_DISABLE_FAILED',
        'Failed 2FA disable attempt - incorrect password',
        req
      );
      
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Verify token
    const isValid = authenticator.verify({ token, secret: user.two_factor_secret });
    
    if (!isValid) {
      // Try backup codes
      let isBackupCodeValid = false;
      
      if (user.backup_codes) {
        const hashedBackupCodes = JSON.parse(user.backup_codes);
        
        for (const hashedCode of hashedBackupCodes) {
          const codeMatch = await bcrypt.compare(token, hashedCode);
          if (codeMatch) {
            isBackupCodeValid = true;
            break;
          }
        }
      }
      
      if (!isBackupCodeValid) {
        // Log failed verification
        await logSecurityEvent(
          userId,
          'TWO_FACTOR_DISABLE_FAILED',
          'Failed 2FA disable attempt - invalid token',
          req
        );
        
        return res.status(400).json({ error: 'Invalid verification code' });
      }
    }
    
    // Disable 2FA
    await User.update(
      { 
        two_factor_enabled: false,
        two_factor_secret: null,
        backup_codes: null,
        updated_at: new Date()
      },
      { id: userId }
    );
    
    // Log successful 2FA disable
    await logSecurityEvent(
      userId,
      'TWO_FACTOR_DISABLED',
      'Two-factor authentication disabled successfully',
      req
    );
    
    return res.json({ 
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    logger.error('Error disabling 2FA:', error);
    return res.status(500).json({ error: 'Failed to disable 2FA' });
  }
};

/**
 * Verify 2FA token (during login)
 */
const verifyTwoFactorToken = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { token, userId, rememberDevice } = req.body;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled for this user' });
    }
    
    // Verify token
    const isValid = authenticator.verify({ token, secret: user.two_factor_secret });
    
    // Try backup codes if token is invalid
    let isBackupCodeValid = false;
    let usedBackupCodeIndex = -1;
    
    if (!isValid && user.backup_codes) {
      const hashedBackupCodes = JSON.parse(user.backup_codes);
      
      for (let i = 0; i < hashedBackupCodes.length; i++) {
        const codeMatch = await bcrypt.compare(token, hashedBackupCodes[i]);
        if (codeMatch) {
          isBackupCodeValid = true;
          usedBackupCodeIndex = i;
          break;
        }
      }
    }
    
    if (!isValid && !isBackupCodeValid) {
      // Log failed verification
      await logSecurityEvent(
        userId,
        'TWO_FACTOR_VERIFICATION_FAILED',
        'Failed 2FA verification during login',
        req
      );
      
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Handle backup code usage
    if (isBackupCodeValid) {
      // Remove used backup code and generate a new one
      const hashedBackupCodes = JSON.parse(user.backup_codes);
      
      // Generate a new backup code
      const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newCode, salt);
      
      // Replace the used code with the new one
      hashedBackupCodes[usedBackupCodeIndex] = newHash;
      
      // Update user's backup codes
      await User.update(
        { backup_codes: JSON.stringify(hashedBackupCodes) },
        { id: userId }
      );
      
      // Log backup code usage
      await logSecurityEvent(
        userId,
        'BACKUP_CODE_USED',
        'Backup code used for 2FA verification during login',
        req
      );
    }
    
    // If remember device is requested, create a trusted device
    if (rememberDevice) {
      const deviceInfo = getDeviceInfo(req);
      
      const existingDevice = await TrustedDevice.findOne({
        user_id: userId,
        device_fingerprint: deviceInfo.fingerprint,
        active: true
      });
      
      if (!existingDevice) {
        await TrustedDevice.create({
          user_id: userId,
          device_name: deviceInfo.name,
          device_fingerprint: deviceInfo.fingerprint,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          ip_address: req.ip,
          last_used: new Date(),
          active: true,
          created_at: new Date()
        });
        
        // Log trusted device addition
        await logSecurityEvent(
          userId,
          'TRUSTED_DEVICE_ADDED',
          `Device trusted: ${deviceInfo.name}`,
          req
        );
      } else {
        // Update last used
        await TrustedDevice.update(
          { last_used: new Date() },
          { id: existingDevice.id }
        );
      }
    }
    
    // Log successful verification
    await logSecurityEvent(
      userId,
      'TWO_FACTOR_VERIFICATION_SUCCESS',
      'Successful 2FA verification during login',
      req
    );
    
    // Complete the authentication process
    req.session.userId = userId;
    req.session.twoFactorVerified = true;
    
    return res.json({ 
      success: true,
      message: '2FA verification successful'
    });
  } catch (error) {
    logger.error('Error verifying 2FA token:', error);
    return res.status(500).json({ error: 'Failed to verify 2FA token' });
  }
};

/**
 * Generate new backup codes
 */
const generateBackupCodes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { password, token } = req.body;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Log failed attempt
      await logSecurityEvent(
        userId,
        'BACKUP_CODES_GENERATION_FAILED',
        'Failed backup codes generation attempt - incorrect password',
        req
      );
      
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Verify token
    const isValid = authenticator.verify({ token, secret: user.two_factor_secret });
    
    if (!isValid) {
      // Log failed verification
      await logSecurityEvent(
        userId,
        'BACKUP_CODES_GENERATION_FAILED',
        'Failed backup codes generation attempt - invalid token',
        req
      );
      
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Generate new backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    
    // Hash backup codes
    const hashedBackupCodes = [];
    for (const code of backupCodes) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(code, salt);
      hashedBackupCodes.push(hash);
    }
    
    // Update user with new backup codes
    await User.update(
      { 
        backup_codes: JSON.stringify(hashedBackupCodes),
        updated_at: new Date()
      },
      { id: userId }
    );
    
    // Log successful backup codes generation
    await logSecurityEvent(
      userId,
      'BACKUP_CODES_GENERATED',
      'New backup codes generated successfully',
      req
    );
    
    return res.json({
      success: true,
      message: 'New backup codes generated successfully',
      backupCodes
    });
  } catch (error) {
    logger.error('Error generating backup codes:', error);
    return res.status(500).json({ error: 'Failed to generate backup codes' });
  }
};

/**
 * Check if a device is trusted for 2FA
 */
const checkTrustedDevice = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get device info
    const deviceInfo = getDeviceInfo(req);
    
    // Check if device is trusted
    const trustedDevice = await TrustedDevice.findOne({
      user_id: userId,
      device_fingerprint: deviceInfo.fingerprint,
      active: true
    });
    
    if (trustedDevice) {
      // Update last used
      await TrustedDevice.update(
        { last_used: new Date() },
        { id: trustedDevice.id }
      );
      
      return res.json({ 
        trusted: true,
        deviceName: trustedDevice.device_name
      });
    }
    
    return res.json({ trusted: false });
  } catch (error) {
    logger.error('Error checking trusted device:', error);
    return res.status(500).json({ error: 'Failed to check trusted device' });
  }
};

/**
 * Send 2FA code via email (alternative method)
 */
const sendTwoFactorEmail = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry time (10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    // Hash the code
    const salt = await bcrypt.genSalt(10);
    const hashedCode = await bcrypt.hash(code, salt);
    
    // Store verification code
    await VerificationCode.create({
      user_id: userId,
      type: 'EMAIL_2FA',
      code: hashedCode,
      expires_at: expiresAt,
      created_at: new Date()
    });
    
    // Send email
    await sendEmail({
      to: user.email,
      subject: 'Your Two-Factor Authentication Code',
      template: 'two-factor-email',
      context: {
        code,
        userName: `${user.first_name} ${user.last_name}`,
        expiryMinutes: 10
      }
    });
    
    // Log email sent
    await logSecurityEvent(
      userId,
      'TWO_FACTOR_EMAIL_SENT',
      'Two-factor authentication code sent via email',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    logger.error('Error sending 2FA email:', error);
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
};

/**
 * Verify email 2FA code
 */
const verifyEmailTwoFactorCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { code, userId, rememberDevice } = req.body;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get verification code
    const verificationRecords = await VerificationCode.findMany({
      user_id: userId,
      type: 'EMAIL_2FA'
    });
    
    if (verificationRecords.length === 0) {
      return res.status(400).json({ error: 'No verification code found. Please request a new code.' });
    }
    
    // Sort by created date (newest first)
    verificationRecords.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    const verificationRecord = verificationRecords[0];
    
    // Check if code is expired
    if (new Date(verificationRecord.expires_at) < new Date()) {
      // Delete expired code
      await VerificationCode.delete({ id: verificationRecord.id });
      
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }
    
    // Verify code
    const isMatch = await bcrypt.compare(code, verificationRecord.code);
    
    if (!isMatch) {
      // Log failed verification
      await logSecurityEvent(
        userId,
        'EMAIL_2FA_VERIFICATION_FAILED',
        'Failed email 2FA verification during login',
        req
      );
      
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Delete all verification codes for this user
    for (const record of verificationRecords) {
      await VerificationCode.delete({ id: record.id });
    }
    
    // If remember device is requested, create a trusted device
    if (rememberDevice) {
      const deviceInfo = getDeviceInfo(req);
      
      const existingDevice = await TrustedDevice.findOne({
        user_id: userId,
        device_fingerprint: deviceInfo.fingerprint,
        active: true
      });
      
      if (!existingDevice) {
        await TrustedDevice.create({
          user_id: userId,
          device_name: deviceInfo.name,
          device_fingerprint: deviceInfo.fingerprint,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          ip_address: req.ip,
          last_used: new Date(),
          active: true,
          created_at: new Date()
        });
        
        // Log trusted device addition
        await logSecurityEvent(
          userId,
          'TRUSTED_DEVICE_ADDED',
          `Device trusted: ${deviceInfo.name}`,
          req
        );
      } else {
        // Update last used
        await TrustedDevice.update(
          { last_used: new Date() },
          { id: existingDevice.id }
        );
      }
    }
    
    // Log successful verification
    await logSecurityEvent(
      userId,
      'EMAIL_2FA_VERIFICATION_SUCCESS',
      'Successful email 2FA verification during login',
      req
    );
    
    // Complete the authentication process
    req.session.userId = userId;
    req.session.twoFactorVerified = true;
    
    return res.json({ 
      success: true,
      message: 'Verification successful'
    });
  } catch (error) {
    logger.error('Error verifying email 2FA code:', error);
    return res.status(500).json({ error: 'Failed to verify code' });
  }
};

/**
 * Get trusted devices
 */
const getTrustedDevices = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get trusted devices
    const devices = await TrustedDevice.findMany(
      { 
        user_id: userId,
        active: true
      },
      {
        orderBy: 'last_used',
        order: 'desc'
      }
    );
    
    // Format devices
    const formattedDevices = devices.map(device => ({
      id: device.id,
      deviceName: device.device_name,
      browser: device.browser,
      os: device.os,
      ipAddress: device.ip_address,
      lastUsed: device.last_used,
      createdAt: device.created_at
    }));
    
    return res.json(formattedDevices);
  } catch (error) {
    logger.error('Error getting trusted devices:', error);
    return res.status(500).json({ error: 'Failed to get trusted devices' });
  }
};

module.exports = {
  generateTwoFactorSecret,
  enableTwoFactor,
  disableTwoFactor,
  verifyTwoFactorToken,
  generateBackupCodes,
  checkTrustedDevice,
  sendTwoFactorEmail,
  verifyEmailTwoFactorCode,
  getTrustedDevices
};