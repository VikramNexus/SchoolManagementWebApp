/**
 * Backup Routes — School Management System
 *
 * Day 10: Backup, Security & Launch.
 */

const express = require('express');
const {
  createBackup,
  listBackups,
  downloadBackup,
  restoreBackup,
  deleteBackup,
  getBackupInfo,
  uploadBackup,
  upload,
} = require('../controllers/backupController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All backup routes require authentication
router.use(authenticateToken);

router.get('/info', getBackupInfo);
router.post('/create', createBackup);
router.get('/list', listBackups);
router.get('/download/:filename', downloadBackup);
router.post('/restore/:filename', restoreBackup);
router.delete('/:filename', deleteBackup);
router.post('/upload', upload.single('backup'), uploadBackup);

module.exports = router;