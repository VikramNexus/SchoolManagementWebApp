/**
 * Student Routes — School Management System
 *
 * Day 5: Settings Integration & Students.
 */

const express = require('express');
const {
  listStudents,
  createStudent,
  getStudent,
  updateStudent,
  patchStudent,
  deleteStudent,
  downloadStudentLedgerPDF,
  sendStudentLedgerWhatsApp,
} = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All student routes require authentication
router.use(authenticateToken);

router.get('/', listStudents);
router.post('/', createStudent);
router.get('/:id/ledger-pdf', downloadStudentLedgerPDF);
router.post('/:id/send-ledger-whatsapp', sendStudentLedgerWhatsApp);
router.get('/:id', getStudent);
router.put('/:id', updateStudent);
router.patch('/:id', patchStudent);
router.delete('/:id', deleteStudent);

module.exports = router;