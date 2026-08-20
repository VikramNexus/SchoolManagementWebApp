/**
 * Family Routes — School Management System
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  searchStudentsForFamily,
  getFamilyByStudent,
  concatenateStudents,
  unlinkStudent,
  recordFamilyPayment,
} = require('../controllers/familyController');

router.use(authenticateToken);

router.get('/search', searchStudentsForFamily);
router.get('/by-student/:student_id', getFamilyByStudent);
router.post('/concatenate', concatenateStudents);
router.post('/unlink', unlinkStudent);
router.post('/record-payment', recordFamilyPayment);

module.exports = router;
