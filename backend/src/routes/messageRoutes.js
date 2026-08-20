/**
 * Message Routes — School Management System
 *
 * Day 9: Reminders, Messages & Financial Reports.
 */

const express = require('express');
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendReminders,
  getMessageLogs,
  sendPaymentConfirmation,
} = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All message routes require authentication
router.use(authenticateToken);

/**
 * Message Templates
 */
router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

/**
 * Bulk Messaging
 */
router.post('/send-reminders', sendReminders);
router.post('/send-payment-confirmation', sendPaymentConfirmation);

/**
 * Message Logs
 */
router.get('/logs', getMessageLogs);

module.exports = router;