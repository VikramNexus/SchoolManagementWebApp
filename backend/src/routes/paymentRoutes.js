/**
 * Payment Routes — School Management System
 *
 * Day 6 & Day 7: Cash Payment Recording & Payment History.
 */

const express = require('express');
const {
  recordPayment,
  updatePayment,
  deletePayment,
  listAdmissionPayments,
} = require('../controllers/paymentController');
const {
  getPaymentHistory,
  getCollectionSummary,
  getPaymentDetails,
} = require('../controllers/paymentHistoryController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All payment routes require authentication
router.use(authenticateToken);

router.post('/', recordPayment);
router.get('/admissions', listAdmissionPayments);
router.get('/summary', getCollectionSummary);
router.get('/', getPaymentHistory);
router.get('/:id', getPaymentDetails);
router.put('/:id', updatePayment);
router.delete('/:id', deletePayment);

module.exports = router;