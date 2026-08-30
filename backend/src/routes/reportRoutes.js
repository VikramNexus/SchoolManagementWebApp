/**
 * Report Routes — School Management System
 * Executive Intelligence, Day-Book, Defaulters, Demographics & Auditing
 */

const express = require('express');
const {
  getExecutiveOverview,
  getPendingDuesList,
  getAdmissionDuesList,
  getDemographicsReport,
  getCollectionsReport,
} = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/executive-overview', getExecutiveOverview);
router.get('/pending-dues-list', getPendingDuesList);
router.get('/admission-dues-list', getAdmissionDuesList);
router.get('/demographics', getDemographicsReport);
router.get('/collections', getCollectionsReport);

module.exports = router;
