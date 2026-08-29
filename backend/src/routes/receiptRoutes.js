/**
 * Receipt Routes — School Management System
 *
 * Day 8: Receipts & Messaging Foundation.
 */

const express = require('express');
const {
  generateReceipt,
  getReceipt,
  downloadReceipt,
  listReceipts,
  generateDuesNotice,
  sendReceiptWhatsApp,
  sendDuesNoticeWhatsApp,
  sendReceiptWhatsAppImage,
  sendDuesWhatsAppImage,
} = require('../controllers/receiptController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All receipt routes require authentication
router.use(authenticateToken);

router.post('/generate/:paymentId', generateReceipt);
router.get('/', listReceipts);
router.get('/dues-notice/:studentId', generateDuesNotice);
router.get('/:paymentId', getReceipt);
router.get('/download/:paymentId', downloadReceipt);

// Direct WhatsApp dispatch endpoints (Background)
router.post('/send-whatsapp/:paymentId', sendReceiptWhatsApp);
router.post('/send-dues-whatsapp/:studentId', sendDuesNoticeWhatsApp);
router.post('/send-whatsapp-jpg/:paymentId', sendReceiptWhatsAppImage);
router.post('/send-dues-whatsapp-jpg/:studentId', sendDuesWhatsAppImage);

module.exports = router;