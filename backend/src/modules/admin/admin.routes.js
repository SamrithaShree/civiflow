const express = require('express');
const router = express.Router();
const controller = require('./admin.controller');
const authMiddleware = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');

router.use(authMiddleware, authorize('ADMIN'));

router.post('/incident-mode', controller.toggleIncidentMode);
router.get('/incident-mode', controller.getIncidentMode);
router.get('/departments', controller.getDepartments);
router.post('/departments', controller.createDepartment);
router.get('/users', controller.getUsers);

module.exports = router;
