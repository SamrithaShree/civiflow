const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');
const authMiddleware = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const { strictLimiter } = require('../../middleware/rateLimiter');

// Public routes
router.post('/register', strictLimiter, controller.register);
router.post('/login', strictLimiter, controller.login);

// Protected
router.get('/me', authMiddleware, controller.getMe);

// Admin: create any user role
router.post('/users', authMiddleware, authorize('ADMIN'), controller.createUser);

module.exports = router;
