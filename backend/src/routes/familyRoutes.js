/**
 * Family Routes — School Management System
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  searchStudentsForFamily,
  getFamilyByStudent,
  getFamilyMonthlyLedger,
  concatenateStudents,
  unlinkStudent,
  recordFamilyPayment,
  assignFamilyMonth,
  deleteFamilyMonth,
} = require('../controllers/familyController');

router.use(authenticateToken);

router.get('/search', searchStudentsForFamily);
router.get('/by-student/:student_id', getFamilyByStudent);
router.get('/by-student/:student_id/ledger', getFamilyMonthlyLedger);
router.post('/concatenate', concatenateStudents);
router.post('/unlink', unlinkStudent);
router.post('/record-payment', recordFamilyPayment);
router.post('/assign-month', assignFamilyMonth);
router.post('/delete-month', deleteFamilyMonth);

module.exports = router;
