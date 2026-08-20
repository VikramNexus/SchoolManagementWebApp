/**
 * Student Profile Routes — School Management System
 */

const express = require('express');
const {
  getStudentProfile,
  updateMonthlyRate,
  addStudentFee,
  updateStudentFee,
  removeStudentFee,
  generateMonthFee,
  updateMonthlyFeeRecord,
  deleteMonthlyFeeRecord,
} = require('../controllers/studentProfileController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/:id/profile', getStudentProfile);
router.patch('/:id/monthly-rate', updateMonthlyRate);
router.post('/:id/add-fee', addStudentFee);
router.patch('/:id/add-fee/:feeId', updateStudentFee);
router.delete('/:id/add-fee/:feeId', removeStudentFee);
router.post('/:id/generate-month-fee', generateMonthFee);
router.patch('/:id/monthly-fees/:feeId', updateMonthlyFeeRecord);
router.delete('/:id/monthly-fees/:feeId', deleteMonthlyFeeRecord);

module.exports = router;