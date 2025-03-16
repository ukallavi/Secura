const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { logger, logSecurityEvent } = require('../utils/logger');
const { sendEmail } = require('../utils/email');
const RecoveryKey = require('../../database/models/RecoveryKey');
const User = require('../../database/models/User');
const VerificationCode = require('../../database/models/VerificationCode');
const TrustedDevice = require('../../database/models/TrustedDevice');
const { db, withTransaction } = require('../../database/db');

// Set up recovery key
const setupRecoveryKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required to set up recovery key' });
    }
    
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
        'RECOVERY_KEY_SETUP_FAILED',
        'Failed recovery key setup attempt - incorrect password',
        req
      );
      
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Generate recovery key
    const recoveryKey = crypto.randomBytes(32).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Hash recovery key for storage
    const hashedRecoveryKey = crypto.createHash('sha256').update(recoveryKey).digest('hex');
    
    // Check if recovery key already exists
    const existingKey = await RecoveryKey.findOne({ user_id: userId });
    
    await withTransaction(async (trx) => {
      if (existingKey) {
        // Update existing recovery key
        await RecoveryKey.update(
          { 
            key_hash: hashedRecoveryKey,
            active: true,
            updated_at: new Date()
          },
          { user_id: userId },
          trx
        );
      } else {
        // Create new recovery key
        await RecoveryKey.create(
          {
            user_id: userId,
            key_hash: hashedRecoveryKey,
            active: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          trx
        );
      }
      
      // Log recovery key setup
      await logSecurityEvent(
        userId,
        'RECOVERY_KEY_SETUP',
        'Recovery key created or updated',
        req
      );
    });
    
    return res.json({
      recoveryKey,
      message: 'Recovery key created successfully. Please store it in a safe place.'
    });
    
  } catch (error) {
    logger.error('Error setting up recovery key:', error);
    return res.status(500).json({ error: 'Failed to set up recovery key' });
  }
};

// Verify recovery key status
const getRecoveryKeyStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if recovery key exists
    const key = await RecoveryKey.findOne({ user_id: userId });
    
    return res.json({
      hasRecoveryKey: !!key,
      createdAt: key ? key.created_at : null
    });
  } catch (error) {
    logger.error('Error checking recovery key status:', error);
    return res.status(500).json({ error: 'Failed to check recovery key status' });
  }
};

// Delete recovery key
const deleteRecoveryKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete recovery key' });
    }
    
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
        'RECOVERY_KEY_DELETE_FAILED',
        'Failed recovery key deletion attempt - incorrect password',
        req
      );
      
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Delete recovery key
    await RecoveryKey.delete({ user_id: userId });
    
    // Log recovery key deletion
    await logSecurityEvent(
      userId,
      'RECOVERY_KEY_DELETED',
      'User deleted their recovery key',
      req
    );
    
    return res.json({ message: 'Recovery key deleted successfully' });
  } catch (error) {
    logger.error('Error deleting recovery key:', error);
    return res.status(500).json({ error: 'Failed to delete recovery key' });
  }
};

// Initiate account recovery
const initiateAccountRecovery = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    // For security, don't reveal if email exists or not
    if (!user) {
      return res.json({ message: 'If a user with that email exists, a recovery link has been sent.' });
    }
    
    // Generate a recovery token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry
    
    // Store token in database
    await VerificationCode.create({
      user_id: user.id,
      type: 'ACCOUNT_RECOVERY',
      code: token,
      expires_at: expiresAt,
      created_at: new Date()
    });
    
    // Create recovery link
    const recoveryLink = `${process.env.FRONTEND_URL}/account-recovery/${token}`;
    
    // Send recovery email
    await sendEmail({
      to: email,
      subject: 'Account Recovery - Secura',
      text: `You requested to recover your Secura account. Click the link below to reset your password:\n\n${recoveryLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
      html: `
        <h2>Account Recovery</h2>
        <p>You requested to recover your Secura account. Click the link below to reset your password:</p>
        <p><a href="${recoveryLink}" style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Recover Account</a></p>
        <p>Or copy and paste this link: ${recoveryLink}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });
    
    // Log recovery initiation
    await logSecurityEvent(
      user.id,
      'ACCOUNT_RECOVERY_INITIATED',
      'User initiated account recovery',
      req
    );
    
    return res.json({ message: 'If a user with that email exists, a recovery link has been sent.' });
  } catch (error) {
    logger.error('Error initiating account recovery:', error);
    return res.status(500).json({ error: 'Failed to initiate account recovery' });
  }
};

// Verify recovery token
const verifyRecoveryToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Recovery token is required' });
    }
    
    // Find token in database
    const verificationRecord = await VerificationCode.findOne({
      code: token,
      type: 'ACCOUNT_RECOVERY'
    });
    
    if (!verificationRecord) {
      return res.status(404).json({ error: 'Invalid or expired recovery token' });
    }
    
    // Check if token is expired
    if (new Date() > new Date(verificationRecord.expires_at)) {
      await VerificationCode.delete({ id: verificationRecord.id });
      return res.status(400).json({ error: 'Recovery token has expired' });
    }
    
    // Find user
    const user = await User.findById(verificationRecord.user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has a recovery key
    const recoveryKey = await RecoveryKey.findOne({ user_id: user.id });
    
    return res.json({
      valid: true,
      requiresRecoveryKey: !!recoveryKey?.active,
      email: user.email
    });
  } catch (error) {
    logger.error('Error verifying recovery token:', error);
    return res.status(500).json({ error: 'Failed to verify recovery token' });
  }
};

// Complete account recovery
const completeAccountRecovery = async (req, res) => {
  try {
    const { token, newPassword, recoveryKey } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    // Find token in database
    const verificationRecord = await VerificationCode.findOne({
      code: token,
      type: 'ACCOUNT_RECOVERY'
    });
    
    if (!verificationRecord) {
      return res.status(404).json({ error: 'Invalid or expired recovery token' });
    }
    
    // Check if token is expired
    if (new Date() > new Date(verificationRecord.expires_at)) {
      await VerificationCode.delete({ id: verificationRecord.id });
      return res.status(400).json({ error: 'Recovery token has expired' });
    }
    
    // Find user
    const user = await User.findById(verificationRecord.user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has a recovery key
    const userRecoveryKey = await RecoveryKey.findOne({ user_id: user.id });
    
    // If user has recovery key, verify it
    if (userRecoveryKey?.active) {
      if (!recoveryKey) {
        return res.status(400).json({ error: 'Recovery key is required for this account' });
      }
      
      // Hash provided recovery key to compare
      const hashedProvidedKey = crypto.createHash('sha256').update(recoveryKey).digest('hex');
      
      if (hashedProvidedKey !== userRecoveryKey.key_hash) {
        // Log failed attempt
        await logSecurityEvent(
          user.id,
          'ACCOUNT_RECOVERY_FAILED',
          'Account recovery failed - incorrect recovery key',
          req
        );
        
        return res.status(400).json({ error: 'Invalid recovery key' });
      }
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await withTransaction(async (trx) => {
      // Update user password
      await User.update(
        { password: hashedPassword },
        { id: user.id },
        trx
      );
      
      // Delete verification code
      await VerificationCode.delete({ id: verificationRecord.id }, trx);
      
      // Invalidate all trusted devices
      await TrustedDevice.update(
        { active: false },
        { user_id: user.id },
        trx
      );
    });
    
    // Log password reset
    await logSecurityEvent(
      user.id,
      'PASSWORD_RESET',
      'User password reset via account recovery',
      req
    );
    
    return res.json({ message: 'Password reset successful. Please log in with your new password.' });
  } catch (error) {
    logger.error('Error completing account recovery:', error);
    return res.status(500).json({ error: 'Failed to complete account recovery' });
  }
};

// Recover with recovery key
const recoverWithKey = async (req, res) => {
  try {
    const { email, recoveryKey, newPassword } = req.body;
    
    if (!email || !recoveryKey || !newPassword) {
      return res.status(400).json({ error: 'Email, recovery key, and new password are required' });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find recovery key
    const userRecoveryKey = await RecoveryKey.findOne({ user_id: user.id });
    
    if (!userRecoveryKey || !userRecoveryKey.active) {
      return res.status(400).json({ error: 'No active recovery key found for this account' });
    }
    
    // Hash provided recovery key to compare
    const hashedProvidedKey = crypto.createHash('sha256').update(recoveryKey).digest('hex');
    
    if (hashedProvidedKey !== userRecoveryKey.key_hash) {
      // Log failed attempt
      await logSecurityEvent(
        user.id,
        'DIRECT_RECOVERY_FAILED',
        'Direct recovery with key failed - incorrect recovery key',
        req
      );
      
      return res.status(400).json({ error: 'Invalid recovery key' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await withTransaction(async (trx) => {
      // Update user password
      await User.update(
        { password: hashedPassword },
        { id: user.id },
        trx
      );
      
      // Invalidate all trusted devices
      await TrustedDevice.update(
        { active: false },
        { user_id: user.id },
        trx
      );
    });
    
    // Log password reset with recovery key
    await logSecurityEvent(
      user.id,
      'PASSWORD_RESET_WITH_RECOVERY_KEY',
      'User reset password using recovery key',
      req
    );
    
    return res.json({ message: 'Password reset successful. Please log in with your new password.' });
  } catch (error) {
    logger.error('Error recovering with key:', error);
    return res.status(500).json({ error: 'Failed to recover account with recovery key' });
  }
};

module.exports = {
  setupRecoveryKey,
  getRecoveryKeyStatus,
  deleteRecoveryKey,
  initiateAccountRecovery,
  verifyRecoveryToken,
  completeAccountRecovery,
  recoverWithKey
};