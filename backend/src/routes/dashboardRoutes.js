/**
 * Dashboard Routes — School Management System
 *
 * Day 4: Settings, Fees & Application Shell.
 */

const express = require('express');
const { getKpis } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All dashboard routes require authentication
router.use(authenticateToken);

router.get('/kpis', getKpis);

module.exports = router;