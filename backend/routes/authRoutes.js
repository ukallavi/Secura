// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter, twoFactorLimiter, passwordResetLimiter } = require('../middleware/security');
const { verificationCheck } = require('../middleware/accountTakeoverProtection');

// Existing routes
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);
router.post('/password-reset-request', passwordResetLimiter, authController.requestPasswordReset);
router.post('/password-reset', passwordResetLimiter, authController.resetPassword);

// New routes for ATP
router.post('/verification/send-code', twoFactorLimiter, authController.sendVerificationCode);
router.post('/verification/complete', twoFactorLimiter, authController.completeVerification);

// Protected routes that require verification
router.get('/profile', verificationCheck, authController.getProfile);
router.put('/profile', verificationCheck, authController.updateProfile);

module.exports = router;