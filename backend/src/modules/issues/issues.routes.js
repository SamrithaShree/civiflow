const express = require('express');
const router = express.Router();
const controller = require('./issues.controller');
const authMiddleware = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/upload');
const rateLimit = require('express-rate-limit');

// Rate limiting for issue creation and media uploads
const actionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// All routes require authentication
router.use(authMiddleware);

// Create issue (citizen)
router.post('/', authorize('CITIZEN', 'ADMIN'), actionLimiter, upload.array('photos', 5), controller.create);

// List issues (role-filtered)
router.get('/', controller.list);

// Get single issue
router.get('/:id', controller.getById);

// Update status (backend enforced)
router.patch('/:id/status', authorize('WORKER', 'SUPERVISOR', 'ADMIN'), controller.updateStatus);

// Citizen verification
router.post('/:id/verify', authorize('CITIZEN', 'ADMIN'), controller.verify);

// Upload media (worker uploads resolution photos)
router.post('/:id/media', authorize('WORKER', 'SUPERVISOR', 'ADMIN'), actionLimiter, upload.array('photos', 5), controller.uploadMedia);

module.exports = router;
