/**
 * Report Routes — School Management System
 *
 * Day 9: Reminders, Messages & Financial Reports.
 */

const express = require('express');
const {
  getPendingDuesList,
  getAdmissionDuesList,
  getDemographicsReport,
  getCollectionsReport,
} = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/pending-dues-list', getPendingDuesList);
router.get('/admission-dues-list', getAdmissionDuesList);
router.get('/demographics', getDemographicsReport);
router.get('/collections', getCollectionsReport);

module.exports = router;
