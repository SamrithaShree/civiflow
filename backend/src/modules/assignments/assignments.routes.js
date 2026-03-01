const express = require('express');
const router = express.Router();
const controller = require('./assignments.controller');
const authMiddleware = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');

router.use(authMiddleware);

// Worker: view my assignments
router.get('/mine', authorize('WORKER'), controller.getMyAssignments);

// Supervisor/Admin: list workers with load
router.get('/workers', authorize('SUPERVISOR', 'ADMIN'), controller.getWorkers);

// Supervisor/Admin: reassign a worker to an issue
router.patch('/issues/:issueId/reassign', authorize('SUPERVISOR', 'ADMIN'), controller.reassign);

module.exports = router;
