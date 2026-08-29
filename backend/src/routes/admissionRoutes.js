/**
 * Admission Routes — School Management System
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  enrollStudent,
  enrollFamily,
  getAdmissionStats,
  listAdmissions,
  sendAdmissionWhatsApp,
  sendAdmissionWhatsAppImage,
} = require('../controllers/admissionController');

router.use(authenticateToken);

router.post('/enroll', enrollStudent);
router.post('/enroll-family', enrollFamily);
router.get('/stats', getAdmissionStats);
router.get('/list', listAdmissions);
router.post('/send-whatsapp/:studentId', sendAdmissionWhatsApp);
router.post('/send-whatsapp-jpg/:studentId', sendAdmissionWhatsAppImage);

module.exports = router;
