/**
 * Messaging Settings Routes — School Management System
 *
 * Day 8: Receipts & Messaging Foundation.
 */

const express = require('express');
const {
  getMessagingSettings,
  updateMessagingSettings,
  testSMS,
  testWhatsApp,
  getWhatsAppQR,
  disconnectWhatsApp,
  restartWhatsApp,
} = require('../controllers/messagingSettingsController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All messaging settings routes require authentication
router.use(authenticateToken);

router.get('/', getMessagingSettings);
router.put('/', updateMessagingSettings);
router.post('/test-sms', testSMS);
router.post('/test-whatsapp', testWhatsApp);

// WhatsApp Linked Device & QR Code Management
router.get('/whatsapp-qr', getWhatsAppQR);
router.post('/whatsapp-disconnect', disconnectWhatsApp);
router.post('/whatsapp-restart', restartWhatsApp);

module.exports = router;