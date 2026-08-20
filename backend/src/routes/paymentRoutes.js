/**
 * Payment Routes — School Management System
 *
 * Day 6 & Day 7: Cash Payment Recording & Payment History.
 */

const express = require('express');
const { recordPayment, updatePayment, deletePayment } = require('../controllers/paymentController');
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
router.put('/:id', updatePayment);
router.delete('/:id', deletePayment);
router.get('/', getPaymentHistory);
router.get('/summary', getCollectionSummary);
router.get('/:id', getPaymentDetails);

module.exports = router;