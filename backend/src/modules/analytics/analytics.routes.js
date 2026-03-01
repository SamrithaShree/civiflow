const express = require('express');
const router = express.Router();
const controller = require('./analytics.controller');
const authMiddleware = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');

router.use(authMiddleware);

router.get('/overview', controller.overview);
router.get('/ward', controller.ward);
router.get('/sla', authorize('SUPERVISOR', 'ADMIN'), controller.sla);
router.get('/heatmap', controller.heatmap);
router.get('/departments', authorize('SUPERVISOR', 'ADMIN'), controller.departments);
router.get('/escalations', authorize('SUPERVISOR', 'ADMIN'), controller.escalations);

module.exports = router;
