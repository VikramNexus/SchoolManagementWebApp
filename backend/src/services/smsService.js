/**
 * SMS Service — School Management System
 *
 * Day 8: Receipts & Messaging Foundation.
 *
 * Wrapper for SMS delivery with development Mock Mode.
 * In Mock Mode, messages are logged to the database without external API calls.
 */

const db = require('../config/db');

/**
 * Get SMS settings from database
 */
async function getSMSSettings() {
  return await db.queryOne(
    `SELECT \`sms_enabled\`, \`sms_provider\`, \`sms_api_key\`, \`sms_sender_id\`, \`sms_mock_mode\`
     FROM \`messaging_settings\`
     WHERE \`id\` = 1`
  );
}

/**
 * Initialize messaging settings table with defaults
 */
async function initMessagingSettings() {
  try {
    await db.query(
      `INSERT IGNORE INTO \`messaging_settings\` (\`id\`, \`sms_enabled\`, \`sms_provider\`, \`sms_mock_mode\`, \`whatsapp_enabled\`, \`whatsapp_provider\`, \`whatsapp_mock_mode\`)
       VALUES (1, 0, 'twilio', 1, 0, 'twilio', 1)`
    );
  } catch (err) {
    // Table might not exist yet, that's okay
  }
}

/**
 * Send a single SMS
 * @param {string} to - Phone number
 * @param {string} body - Message body
 * @param {Object} options - Additional options (student_id, template_id, etc.)
 * @returns {Promise<Object>} Result with status and message_id
 */
async function sendSMS(to, body, options = {}) {
  const { student_id = null, template_id = null, payment_id = null } = options;

  // Initialize settings if needed
  await initMessagingSettings();

  const settings = await getSMSSettings();
  const mockMode = settings?.sms_mock_mode ?? true;
  const enabled = settings?.sms_enabled ?? false;

  if (!enabled) {
    // SMS is disabled, log as mock
    return logMessage({
      student_id,
      template_id,
      channel: 'sms',
      recipient: to,
      message: body,
      status: 'mock',
      error_message: 'SMS disabled in settings',
    });
  }

  if (mockMode) {
    // Development mock mode - log to database only
    return logMessage({
      student_id,
      template_id,
      channel: 'sms',
      recipient: to,
      message: body,
      status: 'mock',
      error_message: null,
    });
  }

  // Production mode - actually send SMS
  const provider = settings?.sms_provider || 'twilio';
  const apiKey = settings?.sms_api_key;
  const senderId = settings?.sms_sender_id;

  if (!apiKey) {
    return logMessage({
      student_id,
      template_id,
      channel: 'sms',
      recipient: to,
      message: body,
      status: 'failed',
      error_message: 'SMS API key not configured',
    });
  }

  try {
    let result;
    if (provider === 'twilio') {
      result = await sendViaTwilio(to, body, apiKey, senderId);
    } else if (provider === 'msg91') {
      result = await sendViaMsg91(to, body, apiKey, senderId);
    } else {
      throw new Error(`Unknown SMS provider: ${provider}`);
    }

    return logMessage({
      student_id,
      template_id,
      channel: 'sms',
      recipient: to,
      message: body,
      status: 'sent',
      error_message: null,
    });
  } catch (err) {
    console.error('[smsService.sendSMS] Error:', err);
    return logMessage({
      student_id,
      template_id,
      channel: 'sms',
      recipient: to,
      message: body,
      status: 'failed',
      error_message: err.message,
    });
  }
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(to, body, apiKey, senderId) {
  // Twilio uses Account SID and Auth Token
  // Format: "account_sid:auth_token"
  const [accountSid, authToken] = apiKey.split(':');
  if (!accountSid || !authToken) {
    throw new Error('Invalid Twilio credentials format. Use "account_sid:auth_token"');
  }

  const twilio = require('twilio')(accountSid, authToken);
  const message = await twilio.messages.create({
    body,
    from: senderId || '+15005550006', // Default test number
    to: formatPhoneNumber(to),
  });

  return { messageId: message.sid };
}

/**
 * Send SMS via MSG91
 */
async function sendViaMsg91(to, body, apiKey, senderId) {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch('https://api.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'authkey': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      flow_id: senderId || 'default',
      sender: senderId || 'SCHOOL',
      mobiles: formatPhoneNumber(to).replace('+91', ''),
      message: body,
    }),
  });

  const data = await response.json();
  if (data.type !== 'success') {
    throw new Error(data.message || 'MSG91 API error');
  }

  return { messageId: data.request_id };
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');

  // Handle Indian numbers
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `+91${cleaned.substring(1)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 13 && cleaned.startsWith('+91')) {
    return cleaned;
  }

  // Default: assume it's already formatted or add +
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

/**
 * Log message to database
 */
async function logMessage({ student_id, template_id, channel, recipient, message, status, error_message }) {
  try {
    const result = await db.query(
      `INSERT INTO \`message_logs\` (\`student_id\`, \`template_id\`, \`channel\`, \`recipient\`, \`message\`, \`status\`, \`error_message\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [student_id, template_id, channel, recipient, message, status, error_message]
    );

    return {
      success: true,
      messageId: result.insertId,
      status,
      mock: status === 'mock',
    };
  } catch (err) {
    console.error('[smsService.logMessage] Failed to log message:', err);
    return {
      success: false,
      status: 'failed',
      error: err.message,
    };
  }
}

/**
 * Send bulk SMS
 * @param {Array} messages - Array of { to, body, student_id, template_id }
 * @returns {Promise<Array>} Results for each message
 */
async function sendBulkSMS(messages) {
  const results = [];
  for (const msg of messages) {
    const result = await sendSMS(msg.to, msg.body, {
      student_id: msg.student_id,
      template_id: msg.template_id,
    });
    results.push(result);
  }
  return results;
}

/**
 * Interpolate template with student data
 */
function interpolateTemplate(template, data) {
  return template
    .replace(/\{student_name\}/g, data.student_name || '')
    .replace(/\{admission_no\}/g, data.admission_no || '')
    .replace(/\{due_amount\}/g, data.due_amount || '0')
    .replace(/\{school_name\}/g, data.school_name || '')
    .replace(/\{payment_date\}/g, data.payment_date || '')
    .replace(/\{receipt_number\}/g, data.receipt_number || '')
    .replace(/\{class_name\}/g, data.class_name || '')
    .replace(/\{section_name\}/g, data.section_name || '');
}

module.exports = {
  sendSMS,
  sendBulkSMS,
  getSMSSettings,
  initMessagingSettings,
  interpolateTemplate,
  logMessage,
  formatPhoneNumber,
};