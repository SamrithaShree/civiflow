const express = require('express');
const router = express.Router();
const controller = require('./issues.controller');
const authMiddleware = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/upload');

// All routes require authentication
router.use(authMiddleware);

// Create issue (citizen)
router.post('/', upload.array('photos', 5), controller.create);

// List issues (role-filtered)
router.get('/', controller.list);

// Get single issue
router.get('/:id', controller.getById);

// Update status (backend enforced)
router.patch('/:id/status', authorize('WORKER', 'SUPERVISOR', 'ADMIN'), controller.updateStatus);

// Citizen verification
router.post('/:id/verify', authorize('CITIZEN'), controller.verify);

// Upload media (worker uploads resolution photos)
router.post('/:id/media', upload.array('photos', 5), controller.uploadMedia);

module.exports = router;
