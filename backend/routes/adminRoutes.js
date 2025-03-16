// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');

// ATP management routes
router.get('/suspicious-activities', isAdmin, adminController.getSuspiciousActivities);
router.post('/suspicious-activities/:id/review', isAdmin, adminController.reviewSuspiciousActivity);
router.get('/user/:id/activities', isAdmin, adminController.getUserActivities);
router.post('/user/:id/monitoring', isAdmin, adminController.setUserMonitoring);

module.exports = router;