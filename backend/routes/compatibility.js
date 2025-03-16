const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const compatibilityController = require('../controllers/compatibilityController');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Route for generating a password (works with or without authentication)
router.post('/generate', 
  optionalAuth,
  [
    body('alias').notEmpty().withMessage('Alias is required'),
    body('secret').notEmpty().withMessage('Secret is required'),
    body('overrideSettings').optional()
  ],
  compatibilityController.generatePassword
);

// Routes that require authentication
router.post('/override',
  authenticate,
  [
    body('domain').notEmpty().withMessage('Domain is required'),
    body('ignoreCase').isBoolean(),
    body('removeSpecialCharacters').isBoolean(),
    body('suffixZero').isBoolean(),
    body('prefixHash').isBoolean()
  ],
  compatibilityController.saveOverrideSetting
);

router.get('/overrides',
  authenticate,
  compatibilityController.getOverrideSettings
);

module.exports = router;