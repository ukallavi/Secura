const { 
  logAccountActivity, 
  applyLoginProtection, 
  getVerificationRequirements 
} = require('../services/accountTakeoverProtection');
const { generateSecret, generateOtpAuthUrl, generateQRCode, verifyToken } = require('../utils/totp');
const { db } = require('../../database/db');
const { logger, logSecurityEvent } = require('../utils/logger');
const User = require('../../database/models/User');
const TrustedDevice = require('../../database/models/TrustedDevice');
const VerificationCode = require('../../database/models/VerificationCode');
const ActivityLog = require('../../database/models/ActivityLog');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Register a new user
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const newUser = await User.create({
      email,
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      role: 'user',
      created_at: new Date(),
      updated_at: new Date()
    });
    
    // Log registration
    await logSecurityEvent(
      newUser.id,
      'USER_REGISTERED',
      'User account created',
      req
    );
    
    return res.status(201).json({ 
      message: 'User registered successfully',
      userId: newUser.id
    });
  } catch (error) {
    logger.error('Error registering user:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password, deviceInfo } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      // Log failed login
      await logSecurityEvent(
        user.id,
        'LOGIN_FAILED',
        'Failed login attempt - incorrect password',
        req
      );
      
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if account is locked
    if (user.account_locked) {
      await logSecurityEvent(
        user.id,
        'LOGIN_BLOCKED',
        'Login attempt on locked account',
        req
      );
      
      return res.status(403).json({ 
        error: 'Account is locked. Please contact support or use account recovery.',
        accountLocked: true
      });
    }
    
    // Get verification requirements (2FA, new device verification, etc.)
    const verificationRequirements = await getVerificationRequirements(user.id, req, deviceInfo);
    
    // Log successful login
    await logAccountActivity(
      user.id,
      'LOGIN',
      'User logged in',
      req,
      deviceInfo
    );
    
    // If 2FA is required, don't generate full access token yet
    if (verificationRequirements.requiresTwoFactor) {
      // Generate a temporary token for 2FA verification
      const tempToken = jwt.sign(
        { 
          id: user.id,
          email: user.email,
          requiresTwoFactor: true,
          isTemporary: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      return res.json({
        requiresTwoFactor: true,
        tempToken,
        userId: user.id
      });
    }
    
    // If new device verification is required
    if (verificationRequirements.requiresDeviceVerification) {
      // Generate and send verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry
      
      // Hash the code for storage
      const hashedCode = await bcrypt.hash(verificationCode, 10);
      
      // Store verification code
      await VerificationCode.create({
        user_id: user.id,
        type: 'DEVICE_VERIFICATION',
        code: hashedCode,
        expires_at: expiresAt,
        created_at: new Date()
      });
      
      // Generate a temporary token for device verification
      const tempToken = jwt.sign(
        { 
          id: user.id,
          email: user.email,
          requiresDeviceVerification: true,
          isTemporary: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      // Send verification email
      await sendEmail({
        to: user.email,
        subject: 'Device Verification - Secura',
        text: `Your verification code is: ${verificationCode}. This code will expire in 15 minutes.`,
        html: `
          <h2>Device Verification</h2>
          <p>A login attempt was made from a new device or location.</p>
          <p>Your verification code is: <strong>${verificationCode}</strong></p>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not attempt to log in, please secure your account immediately.</p>
        `
      });
      
      return res.json({
        requiresDeviceVerification: true,
        tempToken,
        userId: user.id
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
    
    // If device info provided, register trusted device
    if (deviceInfo && deviceInfo.deviceId) {
      const existingDevice = await TrustedDevice.findOne({
        user_id: user.id,
        device_id: deviceInfo.deviceId
      });
      
      if (existingDevice) {
        // Update existing device
        await TrustedDevice.update(
          {
            last_used: new Date(),
            device_name: deviceInfo.deviceName,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            active: true
          },
          { id: existingDevice.id }
        );
      } else {
        // Register new trusted device
        await TrustedDevice.create({
          user_id: user.id,
          device_id: deviceInfo.deviceId,
          device_name: deviceInfo.deviceName,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          ip_address: req.ip,
          created_at: new Date(),
          last_used: new Date(),
          active: true
        });

        // Log new device
        await logSecurityEvent(
          user.id,
          'NEW_DEVICE',
          'User logged in from a new device',
          req
        );
      }
    }
    
    // Return token and user info
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        twoFactorEnabled: user.two_factor_enabled
      }
    });
  } catch (error) {
    logger.error('Error logging in:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
};

// Verify 2FA token
const verifyTwoFactor = async (req, res) => {
  try {
    const { token, tempToken, deviceInfo } = req.body;
    
    // Verify temp token
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    
    if (!decoded.isTemporary || !decoded.requiresTwoFactor) {
      return res.status(400).json({ error: 'Invalid temporary token' });
    }
    
    const userId = decoded.id;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user || !user.two_factor_secret) {
      return res.status(404).json({ error: 'User not found or 2FA not set up' });
    }
    
    // Verify TOTP
    const isValid = verifyToken(user.two_factor_secret, token);
    
    if (!isValid) {
      // Log failed 2FA attempt
      await logSecurityEvent(
        userId,
        'TWO_FACTOR_FAILED',
        'Failed 2FA verification attempt',
        req
      );
      
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }
    
    // Log successful 2FA
    await logSecurityEvent(
      userId,
      'TWO_FACTOR_SUCCESS',
      'Successful 2FA verification',
      req
    );
    
    // Generate JWT token
    const authToken = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
    
    // If device info provided, register trusted device
    if (deviceInfo && deviceInfo.deviceId) {
      const existingDevice = await TrustedDevice.findOne({
        user_id: user.id,
        device_id: deviceInfo.deviceId
      });
      
      if (existingDevice) {
        // Update existing device
        await TrustedDevice.update(
          {
            last_used: new Date(),
            device_name: deviceInfo.deviceName,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            active: true
          },
          { id: existingDevice.id }
        );
      } else {
        // Register new trusted device
        await TrustedDevice.create({
          user_id: user.id,
          device_id: deviceInfo.deviceId,
          device_name: deviceInfo.deviceName,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          ip_address: req.ip,
          created_at: new Date(),
          last_used: new Date(),
          active: true
        });
        
        // Log new device
        await logSecurityEvent(
          user.id,
          'NEW_DEVICE',
          'User logged in from a new device',
          req
        );
      }
    }
    
    // Return token and user info
    return res.json({
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        twoFactorEnabled: user.two_factor_enabled
      }
    });
  } catch (error) {
    logger.error('Error verifying 2FA:', error);
    return res.status(500).json({ error: 'Failed to verify 2FA token' });
  }
};

// Verify device
const verifyDevice = async (req, res) => {
  try {
    const { code, tempToken, deviceInfo } = req.body;
    
    // Verify temp token
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    
    if (!decoded.isTemporary || !decoded.requiresDeviceVerification) {
      return res.status(400).json({ error: 'Invalid temporary token' });
    }
    
    const userId = decoded.id;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find verification code
    const verificationCodes = await VerificationCode.findMany({
      user_id: userId,
      type: 'DEVICE_VERIFICATION'
    });
    
    // Check for valid code
    let validCode = false;
    let validCodeId = null;
    
    for (const vc of verificationCodes) {
      // Check if code is expired
      if (new Date() > new Date(vc.expires_at)) {
        continue;
      }
      
      // Verify the code (stored code is hashed)
      const isMatch = await bcrypt.compare(code, vc.code);
      
      if (isMatch) {
        validCode = true;
        validCodeId = vc.id;
        break;
      }
    }
    
    if (!validCode) {
      // Log failed verification
      await logSecurityEvent(
        userId,
        'DEVICE_VERIFICATION_FAILED',
        'Failed device verification attempt',
        req
      );
      
      return res.status(401).json({ error: 'Invalid verification code' });
    }
    
    // Delete used verification code
    await VerificationCode.delete({ id: validCodeId });
    
    // Log successful verification
    await logSecurityEvent(
      userId,
      'DEVICE_VERIFICATION_SUCCESS',
      'Successful device verification',
      req
    );
    
    // Generate JWT token
    const authToken = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
    
    // Register trusted device
    if (deviceInfo && deviceInfo.deviceId) {
      await TrustedDevice.create({
        user_id: user.id,
        device_id: deviceInfo.deviceId,
        device_name: deviceInfo.deviceName,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ip_address: req.ip,
        created_at: new Date(),
        last_used: new Date(),
        active: true
      });
    }
    
    // Return token and user info
    return res.json({
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        twoFactorEnabled: user.two_factor_enabled
      }
    });
  } catch (error) {
    logger.error('Error verifying device:', error);
    return res.status(500).json({ error: 'Failed to verify device' });
  }
};

// Setup 2FA
const setupTwoFactor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    // Verify password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
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
    
    // Generate TOTP secret
    const secret = generateSecret();
    
    // Generate OTP auth URL
    const otpAuthUrl = generateOtpAuthUrl(user.email, secret, 'Secura');
    
    // Generate QR code
    const qrCode = await generateQRCode(otpAuthUrl);
    
    // Store secret temporarily
    const tempSecret = crypto.randomBytes(16).toString('hex');
    
    // Set expiry time (10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    // Store temporary secret
    await VerificationCode.create({
      user_id: userId,
      type: 'TOTP_SETUP',
      code: tempSecret,
      expires_at: expiresAt,
      metadata: JSON.stringify({ secret }),
      created_at: new Date()
    });
    
    return res.json({
      tempSecret,
      qrCode,
      secret,
      otpAuthUrl
    });
  } catch (error) {
    logger.error('Error setting up 2FA:', error);
    return res.status(500).json({ error: 'Failed to set up 2FA' });
  }
};

// Verify and activate 2FA
const verifyAndActivateTwoFactor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, tempSecret } = req.body;
    
    // Find temp secret in database
    const verificationRecord = await VerificationCode.findOne({
      user_id: userId,
      type: 'TOTP_SETUP',
      code: tempSecret
    });
    
    if (!verificationRecord) {
      return res.status(400).json({ error: 'Invalid setup session' });
    }
    
    // Check if expired
    if (new Date() > new Date(verificationRecord.expires_at)) {
      // Delete expired record
      await VerificationCode.delete({ id: verificationRecord.id });
      return res.status(400).json({ error: 'Setup session has expired' });
    }
    
    // Get actual secret from metadata
    const metadata = JSON.parse(verificationRecord.metadata);
    const secret = metadata.secret;
    
    // Verify token
    const isValid = verifyToken(secret, token);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Update user with 2FA secret
    await User.update(
      { 
        two_factor_enabled: true,
        two_factor_secret: secret
      },
      { id: userId }
    );
    
    // Delete verification record
    await VerificationCode.delete({ id: verificationRecord.id });
    
    // Log 2FA activation
    await logSecurityEvent(
      userId,
      'TWO_FACTOR_ENABLED',
      'User enabled two-factor authentication',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Two-factor authentication has been activated'
    });
  } catch (error) {
    logger.error('Error activating 2FA:', error);
    return res.status(500).json({ error: 'Failed to activate 2FA' });
  }
};

// Disable 2FA
const disableTwoFactor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    // Verify password
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
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
    
    // Update user to disable 2FA
    await User.update(
      { 
        two_factor_enabled: false,
        two_factor_secret: null
      },
      { id: userId }
    );
    
    // Log 2FA deactivation
    await logSecurityEvent(
      userId,
      'TWO_FACTOR_DISABLED',
      'User disabled two-factor authentication',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Two-factor authentication has been disabled'
    });
  } catch (error) {
    logger.error('Error disabling 2FA:', error);
    return res.status(500).json({ error: 'Failed to disable 2FA' });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      twoFactorEnabled: user.two_factor_enabled,
      createdAt: user.created_at
    });
  } catch (error) {
    logger.error('Error getting profile:', error);
    return res.status(500).json({ error: 'Failed to get user profile' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user profile
    await User.update(
      { 
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date()
      },
      { id: userId }
    );
    
    return res.json({ 
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: userId,
        email: user.email,
        firstName,
        lastName
      }
    });
  } catch (error) {
    logger.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Failed to update user profile' });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      // Log failed attempt
      await logSecurityEvent(
        userId,
        'PASSWORD_CHANGE_FAILED',
        'Failed password change attempt - incorrect password',
        req
      );
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    await User.update(
      { 
        password: hashedPassword,
        updated_at: new Date()
      },
      { id: userId }
    );
    
    // Log password change
    await logSecurityEvent(
      userId,
      'PASSWORD_CHANGED',
      'User changed their password',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
};

// Get trusted devices
const getTrustedDevices = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all trusted devices for user
    const devices = await TrustedDevice.findMany({ 
      user_id: userId,
      active: true
    });
    
    return res.json(devices.map(device => ({
      id: device.id,
      deviceName: device.device_name,
      browser: device.browser,
      os: device.os,
      lastUsed: device.last_used,
      ipAddress: device.ip_address,
      createdAt: device.created_at
    })));
  } catch (error) {
    logger.error('Error getting trusted devices:', error);
    return res.status(500).json({ error: 'Failed to get trusted devices' });
  }
};

// Remove trusted device
const removeTrustedDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.id;
    
    // Find device
    const device = await TrustedDevice.findOne({
      id: deviceId,
      user_id: userId
    });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Deactivate device (soft delete)
    await TrustedDevice.update(
      { active: false },
      { id: deviceId }
    );
    
    // Log device removal
    await logSecurityEvent(
      userId,
      'TRUSTED_DEVICE_REMOVED',
      'User removed a trusted device',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Device removed successfully'
    });
  } catch (error) {
    logger.error('Error removing trusted device:', error);
    return res.status(500).json({ error: 'Failed to remove trusted device' });
  }
};

// Get security activity log
const getSecurityActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Get security events
    const events = await ActivityLog.findMany(
      { user_id: userId },
      { limit, offset, orderBy: 'created_at', order: 'desc' }
    );
    
    // Get total count
    const [{ count }] = await db('activity_logs')
      .where({ user_id: userId })
      .count('id as count');
    
    return res.json({
      events: events.map(event => ({
        id: event.id,
        action: event.action,
        details: event.details ? JSON.parse(event.details) : {},
        ipAddress: event.ip_address,
        userAgent: event.user_agent,
        timestamp: event.created_at
      })),
      pagination: {
        page,
        limit,
        totalEvents: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting security activity:', error);
    return res.status(500).json({ error: 'Failed to get security activity' });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    // If device ID is provided, deactivate that specific device
    const { deviceId } = req.body;
    
    if (deviceId) {
      await TrustedDevice.update(
        { active: false },
        { 
          user_id: req.user.id,
          device_id: deviceId
        }
      );
    }
    
    // Log logout
    await logAccountActivity(
      req.user.id,
      'LOGOUT',
      'User logged out',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Error logging out:', error);
    return res.status(500).json({ error: 'Failed to logout' });
  }
};

module.exports = {
  register,
  login,
  verifyTwoFactor,
  verifyDevice,
  setupTwoFactor,
  verifyAndActivateTwoFactor,
  disableTwoFactor,
  getProfile,
  updateProfile,
  changePassword,
  getTrustedDevices,
  removeTrustedDevice,
  getSecurityActivity,
  logout
};