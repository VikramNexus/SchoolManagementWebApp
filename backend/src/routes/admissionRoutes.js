/**
 * Admission Routes — School Management System
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  enrollStudent,
  getAdmissionStats,
  listAdmissions,
  sendAdmissionWhatsApp,
} = require('../controllers/admissionController');

router.use(authenticateToken);

router.post('/enroll', enrollStudent);
router.get('/stats', getAdmissionStats);
router.get('/list', listAdmissions);
router.post('/send-whatsapp/:studentId', sendAdmissionWhatsApp);

module.exports = router;
