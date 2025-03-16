const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { logger, logSecurityEvent } = require('../utils/logger');
const User = require('../../database/models/User');
const ActivityLog = require('../../database/models/ActivityLog');
const SecurityQuestion = require('../../database/models/SecurityQuestion');
const UserSecurityQuestion = require('../../database/models/UserSecurityQuestion');
const TrustedDevice = require('../../database/models/TrustedDevice');
const VerificationCode = require('../../database/models/VerificationCode');
const { sendEmail } = require('../utils/emailService');
const { generateToken, verifyToken } = require('../utils/tokenService');

/**
 * Get security settings for a user
 */
const getSecuritySettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get security questions
    const userSecurityQuestions = await UserSecurityQuestion.findMany({ user_id: userId });
    
    // Get trusted devices
    const trustedDevices = await TrustedDevice.findMany({
      user_id: userId,
      active: true
    });
    
    // Format response
    const securitySettings = {
      email: user.email,
      twoFactorEnabled: user.two_factor_enabled,
      securityQuestionsConfigured: userSecurityQuestions.length > 0,
      recoveryEmailConfigured: !!user.recovery_email,
      trustedDevices: trustedDevices.map(device => ({
        id: device.id,
        deviceName: device.device_name,
        browser: device.browser,
        os: device.os,
        lastUsed: device.last_used,
        ipAddress: device.ip_address,
        createdAt: device.created_at
      }))
    };
    
    return res.json(securitySettings);
  } catch (error) {
    logger.error('Error getting security settings:', error);
    return res.status(500).json({ error: 'Failed to get security settings' });
  }
};

/**
 * Set recovery email
 */
const setRecoveryEmail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { email, password } = req.body;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Log failed attempt
      await logSecurityEvent(
        userId,
        'RECOVERY_EMAIL_SETUP_FAILED',
        'Failed recovery email setup attempt - incorrect password',
        req
      );
      
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Check if email is different from primary email
    if (email === user.email) {
      return res.status(400).json({ error: 'Recovery email must be different from your primary email' });
    }
    
    // Generate verification code
    const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    
    // Set expiry time (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Store verification code
    await VerificationCode.create({
      user_id: userId,
      type: 'RECOVERY_EMAIL',
      code: verificationCode,
      expires_at: expiresAt,
      metadata: JSON.stringify({ email }),
      created_at: new Date()
    });
    
    // Send verification email
    await sendEmail({
      to: email,
      subject: 'Verify your recovery email',
      template: 'recovery-email-verification',
      context: {
        code: verificationCode,
        userName: `${user.first_name} ${user.last_name}`,
        expiryHours: 24
      }
    });
    
    // Log recovery email setup attempt
    await logSecurityEvent(
      userId,
      'RECOVERY_EMAIL_VERIFICATION_SENT',
      'Recovery email verification sent',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Verification code sent to recovery email'
    });
  } catch (error) {
    logger.error('Error setting recovery email:', error);
    return res.status(500).json({ error: 'Failed to set recovery email' });
  }
};

/**
 * Verify recovery email
 */
const verifyRecoveryEmail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { code } = req.body;
    
    // Get verification code
    const verificationRecord = await VerificationCode.findOne({
      user_id: userId,
      type: 'RECOVERY_EMAIL',
      code
    });
    
    if (!verificationRecord) {
      // Log failed verification
      await logSecurityEvent(
        userId,
        'RECOVERY_EMAIL_VERIFICATION_FAILED',
        'Invalid verification code',
        req
      );
      
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Check if code is expired
    if (new Date(verificationRecord.expires_at) < new Date()) {
      // Log expired code
      await logSecurityEvent(
        userId,
        'RECOVERY_EMAIL_VERIFICATION_FAILED',
        'Expired verification code',
        req
      );
      
      // Delete expired code
      await VerificationCode.delete({ id: verificationRecord.id });
      
      return res.status(400).json({ error: 'Verification code has expired' });
    }
    
    // Get email from metadata
    const metadata = JSON.parse(verificationRecord.metadata);
    const email = metadata.email;
    
    // Update user with recovery email
    await User.update(
      { 
        recovery_email: email,
        updated_at: new Date()
      },
      { id: userId }
    );
    
    // Delete verification code
    await VerificationCode.delete({ id: verificationRecord.id });
    
    // Log successful verification
    await logSecurityEvent(
      userId,
      'RECOVERY_EMAIL_VERIFIED',
      'Recovery email verified and set',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Recovery email verified and set successfully'
    });
  } catch (error) {
    logger.error('Error verifying recovery email:', error);
    return res.status(500).json({ error: 'Failed to verify recovery email' });
  }
};

/**
 * Remove recovery email
 */
const removeRecoveryEmail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { password } = req.body;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Log failed attempt
      await logSecurityEvent(
        userId,
        'RECOVERY_EMAIL_REMOVAL_FAILED',
        'Failed recovery email removal attempt - incorrect password',
        req
      );
      
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Check if recovery email exists
    if (!user.recovery_email) {
      return res.status(400).json({ error: 'No recovery email is set' });
    }
    
    // Remove recovery email
    await User.update(
      { 
        recovery_email: null,
        updated_at: new Date()
      },
      { id: userId }
    );
    
    // Log removal
    await logSecurityEvent(
      userId,
      'RECOVERY_EMAIL_REMOVED',
      'Recovery email removed',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Recovery email removed successfully'
    });
  } catch (error) {
    logger.error('Error removing recovery email:', error);
    return res.status(500).json({ error: 'Failed to remove recovery email' });
  }
};

/**
 * Get available security questions
 */
const getSecurityQuestions = async (req, res) => {
  try {
    // Get all security questions
    const questions = await SecurityQuestion.findMany({}, { orderBy: 'id', order: 'asc' });
    
    return res.json(questions.map(q => ({
      id: q.id,
      question: q.question
    })));
  } catch (error) {
    logger.error('Error getting security questions:', error);
    return res.status(500).json({ error: 'Failed to get security questions' });
  }
};

/**
 * Set security questions and answers
 */
const setSecurityQuestions = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { password, questions } = req.body;
    
    // Validate questions
    if (!Array.isArray(questions) || questions.length < 3) {
      return res.status(400).json({ error: 'At least 3 security questions are required' });
    }
    
    // Check for duplicate question IDs
    const questionIds = questions.map(q => q.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
      return res.status(400).json({ error: 'Duplicate security questions are not allowed' });
    }
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Log failed attempt
      await logSecurityEvent(
        userId,
        'SECURITY_QUESTIONS_SETUP_FAILED',
        'Failed security questions setup attempt - incorrect password',
        req
      );
      
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Check if security questions exist
    for (const q of questions) {
      const question = await SecurityQuestion.findById(q.questionId);
      if (!question) {
        return res.status(400).json({ error: `Security question with ID ${q.questionId} not found` });
      }
      
      if (!q.answer || q.answer.trim() === '') {
        return res.status(400).json({ error: 'All security questions must have answers' });
      }
    }
    
    // Delete existing security questions
    await UserSecurityQuestion.delete({ user_id: userId });
    
    // Hash and save new security questions
    for (const q of questions) {
      // Hash the answer
      const salt = await bcrypt.genSalt(10);
      const hashedAnswer = await bcrypt.hash(q.answer.toLowerCase().trim(), salt);
      
      await UserSecurityQuestion.create({
        user_id: userId,
        question_id: q.questionId,
        answer_hash: hashedAnswer,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    // Log success
    await logSecurityEvent(
      userId,
      'SECURITY_QUESTIONS_CONFIGURED',
      'Security questions configured successfully',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Security questions set successfully'
    });
  } catch (error) {
    logger.error('Error setting security questions:', error);
    return res.status(500).json({ error: 'Failed to set security questions' });
  }
};

/**
 * Get user's security questions (without answers)
 */
const getUserSecurityQuestions = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's security questions
    const userQuestions = await UserSecurityQuestion.findMany({ user_id: userId });
    
    if (userQuestions.length === 0) {
      return res.status(404).json({ error: 'No security questions found for this user' });
    }
    
    // Get question text
    const questions = [];
    for (const uq of userQuestions) {
      const question = await SecurityQuestion.findById(uq.question_id);
      if (question) {
        questions.push({
          id: uq.id,
          questionId: question.id,
          question: question.question
        });
      }
    }
    
    return res.json(questions);
  } catch (error) {
    logger.error('Error getting user security questions:', error);
    return res.status(500).json({ error: 'Failed to get user security questions' });
  }
};

/**
 * Get security questions for a specific email (used for password reset)
 */
const getSecurityQuestionsForEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if user exists or not for security reasons
      return res.status(200).json({ questions: [] });
    }
    
    // Get user's security questions
    const userQuestions = await UserSecurityQuestion.findMany({ user_id: user.id });
    
    if (userQuestions.length === 0) {
      // User hasn't set up security questions
      return res.status(200).json({ questions: [] });
    }
    
    // Get question text
    const questions = [];
    for (const uq of userQuestions) {
      const question = await SecurityQuestion.findById(uq.question_id);
      if (question) {
        questions.push({
          id: uq.id,
          questionId: question.id,
          question: question.question
        });
      }
    }
    
    // Log the request
    await logSecurityEvent(
      user.id,
      'SECURITY_QUESTIONS_REQUESTED',
      'Security questions requested for password reset',
      req
    );
    
    return res.json({ questions });
  } catch (error) {
    logger.error('Error getting security questions for email:', error);
    return res.status(500).json({ error: 'Failed to get security questions' });
  }
};

/**
 * Verify security question answers (for password reset)
 */
const verifySecurityQuestions = async (req, res) => {
  try {
    const { email, answers } = req.body;
    
    if (!email || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Email and answers are required' });
    }
    
    // Get user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if user exists or not
      return res.status(400).json({ error: 'Invalid email or answers' });
    }
    
    // Verify all answers are provided
    const userQuestions = await UserSecurityQuestion.findMany({ user_id: user.id });
    
    if (userQuestions.length === 0) {
      return res.status(400).json({ error: 'No security questions found for this user' });
    }
    
    // Check if all questions are answered
    const questionIds = userQuestions.map(q => q.id.toString());
    const answeredIds = answers.map(a => a.questionId.toString());
    
    // Make sure all required questions are answered
    const allQuestionsAnswered = questionIds.every(id => answeredIds.includes(id));
    
    if (!allQuestionsAnswered) {
      // Log failed attempt
      await logSecurityEvent(
        user.id,
        'SECURITY_QUESTIONS_VERIFICATION_FAILED',
        'Not all security questions were answered',
        req
      );
      
      return res.status(400).json({ error: 'All security questions must be answered' });
    }
    
    // Verify each answer
    let allCorrect = true;
    for (const answer of answers) {
      const userQuestion = userQuestions.find(q => q.id.toString() === answer.questionId.toString());
      
      if (!userQuestion) {
        allCorrect = false;
        break;
      }
      
      // Compare the answer
      const isMatch = await bcrypt.compare(
        answer.answer.toLowerCase().trim(),
        userQuestion.answer_hash
      );
      
      if (!isMatch) {
        allCorrect = false;
        break;
      }
    }
    
    if (!allCorrect) {
      // Log failed attempt
      await logSecurityEvent(
        user.id,
        'SECURITY_QUESTIONS_VERIFICATION_FAILED',
        'Incorrect security question answers',
        req
      );
      
      return res.status(400).json({ error: 'Invalid email or answers' });
    }
    
    // Generate password reset token
    const token = generateToken({ userId: user.id, type: 'password_reset' }, '15m');
    
    // Log successful verification
    await logSecurityEvent(
      user.id,
      'SECURITY_QUESTIONS_VERIFICATION_SUCCESS',
      'Security questions verified successfully for password reset',
      req
    );
    
    return res.json({ 
      success: true,
      resetToken: token
    });
  } catch (error) {
    logger.error('Error verifying security questions:', error);
    return res.status(500).json({ error: 'Failed to verify security questions' });
  }
};

/**
 * Remove trusted device
 */
const removeTrustedDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.deviceId;
    
    // Get the device
    const device = await TrustedDevice.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Check if device belongs to user
    if (device.user_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to remove this device' });
    }
    
    // Deactivate the device
    await TrustedDevice.update(
      { 
        active: false,
        updated_at: new Date()
      },
      { id: deviceId }
    );
    
    // Log device removal
    await logSecurityEvent(
      userId,
      'TRUSTED_DEVICE_REMOVED',
      `Trusted device removed: ${device.device_name}`,
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Trusted device removed successfully'
    });
  } catch (error) {
    logger.error('Error removing trusted device:', error);
    return res.status(500).json({ error: 'Failed to remove trusted device' });
  }
};

/**
 * Get security activity logs
 */
const getSecurityActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Get activity logs related to security
    const logs = await ActivityLog.findMany(
      { 
        user_id: userId,
        type: { $in: [
          'LOGIN_SUCCESS', 'LOGIN_FAILED', 'PASSWORD_CHANGED',
          'SECURITY_QUESTIONS_CONFIGURED', 'RECOVERY_EMAIL_VERIFIED',
          'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED',
          'TRUSTED_DEVICE_ADDED', 'TRUSTED_DEVICE_REMOVED',
          'SECURITY_QUESTIONS_VERIFICATION_SUCCESS',
          'SECURITY_QUESTIONS_VERIFICATION_FAILED',
          'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED'
        ]}
      },
      {
        orderBy: 'created_at',
        order: 'desc',
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    );
    
    // Get total count
    const totalCount = await ActivityLog.count({ 
      user_id: userId,
      type: { $in: [
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'PASSWORD_CHANGED',
        'SECURITY_QUESTIONS_CONFIGURED', 'RECOVERY_EMAIL_VERIFIED',
        'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED',
        'TRUSTED_DEVICE_ADDED', 'TRUSTED_DEVICE_REMOVED',
        'SECURITY_QUESTIONS_VERIFICATION_SUCCESS',
        'SECURITY_QUESTIONS_VERIFICATION_FAILED',
        'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED'
      ]}
    });
    
    // Format logs
    const formattedLogs = logs.map(log => ({
      id: log.id,
      type: log.type,
      description: log.description,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      createdAt: log.created_at
    }));
    
    return res.json({
      logs: formattedLogs,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting security activity:', error);
    return res.status(500).json({ error: 'Failed to get security activity' });
  }
};

/**
 * Get user's active sessions
 */
const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get active sessions
    const sessions = await db('user_sessions')
      .where({ 
        user_id: userId,
        active: true
      })
      .orderBy('last_activity', 'desc');
    
    // Format sessions
    const formattedSessions = sessions.map(session => ({
      id: session.id,
      deviceName: session.device_name,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ip_address,
      location: session.location,
      lastActivity: session.last_activity,
      createdAt: session.created_at
    }));
    
    return res.json(formattedSessions);
  } catch (error) {
    logger.error('Error getting active sessions:', error);
    return res.status(500).json({ error: 'Failed to get active sessions' });
  }
};

/**
 * Terminate a session
 */
const terminateSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.sessionId;
    
    // Check if current session
    if (req.sessionID === sessionId) {
      return res.status(400).json({ error: 'Cannot terminate your current session' });
    }
    
    // Get session
    const session = await db('user_sessions')
      .where({ 
        id: sessionId,
        user_id: userId
      })
      .first();
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Terminate session
    await db('user_sessions')
      .where({ id: sessionId })
      .update({ 
        active: false,
        updated_at: new Date()
      });
    
    // Log session termination
    await logSecurityEvent(
      userId,
      'SESSION_TERMINATED',
      `Session terminated: ${session.device_name}`,
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    logger.error('Error terminating session:', error);
    return res.status(500).json({ error: 'Failed to terminate session' });
  }
};

/**
 * Terminate all sessions except current
 */
const terminateAllSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.sessionID;
    
    // Terminate all sessions except current
    await db('user_sessions')
      .where({ 
        user_id: userId,
        active: true
      })
      .whereNot({ id: currentSessionId })
      .update({ 
        active: false,
        updated_at: new Date()
      });
    
    // Log termination
    await logSecurityEvent(
      userId,
      'ALL_SESSIONS_TERMINATED',
      'All other sessions terminated',
      req
    );
    
    return res.json({ 
      success: true,
      message: 'All other sessions terminated successfully'
    });
  } catch (error) {
    logger.error('Error terminating all sessions:', error);
    return res.status(500).json({ error: 'Failed to terminate all sessions' });
  }
};

module.exports = {
  getSecuritySettings,
  setRecoveryEmail,
  verifyRecoveryEmail,
  removeRecoveryEmail,
  getSecurityQuestions,
  setSecurityQuestions,
  getUserSecurityQuestions,
  getSecurityQuestionsForEmail,
  verifySecurityQuestions,
  removeTrustedDevice,
  getSecurityActivity,
  getActiveSessions,
  terminateSession,
  terminateAllSessions
};