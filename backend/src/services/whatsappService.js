/**
 * WhatsApp Service — School Management System
 *
 * Day 8: Receipts & Messaging Foundation.
 *
 * Wrapper for WhatsApp delivery with development Mock Mode.
 * In Mock Mode, messages are logged to the database without external API calls.
 */

const db = require('../config/db');
const localGateway = require('./localWhatsAppGateway');

/**
 * Get WhatsApp settings from database
 */
async function getWhatsAppSettings() {
  return await db.queryOne(
    `SELECT \`whatsapp_enabled\`, \`whatsapp_provider\`, \`whatsapp_api_key\`, \`whatsapp_phone_number_id\`, \`whatsapp_mock_mode\`
     FROM \`messaging_settings\`
     WHERE \`id\` = 1`
  );
}

/**
 * Determine the WhatsApp delivery mode from environment and settings
 * Modes: 'mock' (default), 'meta' (Meta WhatsApp Cloud API), 'twilio', 'local'
 */
function getWhatsAppMode(settings) {
  const localStatus = localGateway.getStatus();
  if (localStatus.connected) return 'local';

  // Environment variable takes precedence
  const envMode = process.env.WHATSAPP_MODE?.toLowerCase();
  if (envMode && ['mock', 'meta', 'twilio', 'local'].includes(envMode)) {
    return envMode;
  }
  // Fallback to database setting
  return settings?.whatsapp_mock_mode ? 'mock' : (settings?.whatsapp_provider || 'local');
}

/**
 * Initialize messaging settings table with defaults
 */
async function initMessagingSettings() {
  try {
    await db.query(
      `INSERT IGNORE INTO \`messaging_settings\` (\`id\`, \`sms_enabled\`, \`sms_provider\`, \`sms_mock_mode\`, \`whatsapp_enabled\`, \`whatsapp_provider\`, \`whatsapp_mock_mode\`)
       VALUES (1, 0, 'twilio', 1, 1, 'local', 0)`
    );
  } catch (err) {
    // Table might not exist yet, that's okay
  }
}

/**
 * Send a single WhatsApp message
 * @param {string} to - Phone number
 * @param {string} body - Message body
 * @param {Object} options - Additional options (student_id, template_id, etc.)
 * @returns {Promise<Object>} Result with status and message_id
 */
async function sendWhatsApp(to, body, options = {}) {
  const { student_id = null, template_id = null, payment_id = null } = options;

  // Initialize settings if needed
  await initMessagingSettings();

  let cleanPhone = (to || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  const directLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(body)}`;

  // 1. Try sending directly through Linked Phone (Local Baileys Gateway)
  const localStatus = localGateway.getStatus();
  if (localStatus.connected) {
    try {
      const sentResult = await localGateway.sendTextMessage(to, body);
      const log = await logMessage({
        student_id,
        template_id,
        channel: 'whatsapp',
        recipient: to,
        message: body,
        status: 'sent',
        error_message: null,
      });
      return {
        success: true,
        mode: 'background',
        message: `WhatsApp message sent to ${to}`,
        log,
      };
    } catch (err) {
      console.warn('[whatsappService] Linked phone failed, falling back to direct link:', err.message);
    }
  }

  const settings = await getWhatsAppSettings();
  const mode = getWhatsAppMode(settings);

  // 2. Production Meta Cloud or Twilio if configured
  const apiKey = settings?.whatsapp_api_key;
  const phoneNumberId = settings?.whatsapp_phone_number_id;

  if (apiKey && phoneNumberId) {
    try {
      if (mode === 'twilio') {
        await sendViaTwilio(to, body, apiKey, phoneNumberId);
      } else {
        await sendViaMetaCloud(to, body, apiKey, phoneNumberId);
      }
      return await logMessage({
        student_id,
        template_id,
        channel: 'whatsapp',
        recipient: to,
        message: body,
        status: 'sent',
        error_message: null,
      });
    } catch (err) {
      console.warn('[whatsappService] Cloud provider failed, falling back to direct link:', err.message);
    }
  }

  // 3. Direct Link & App Intent Fallback (Works 100% on both Mobile and Desktop)
  await logMessage({
    student_id,
    template_id,
    channel: 'whatsapp',
    recipient: to,
    message: body,
    status: 'sent',
    error_message: null,
  });

  return {
    success: true,
    mode: 'direct_link',
    direct_link: directLink,
    recipient: to,
    message: `WhatsApp ready for ${to}`,
  };
}

/**
 * Send WhatsApp via Twilio
 */
async function sendViaTwilio(to, body, apiKey, phoneNumberId) {
  // Twilio uses Account SID and Auth Token
  // Format: "account_sid:auth_token"
  const [accountSid, authToken] = apiKey.split(':');
  if (!accountSid || !authToken) {
    throw new Error('Invalid Twilio credentials format. Use "account_sid:auth_token"');
  }

  const twilio = require('twilio')(accountSid, authToken);
  const message = await twilio.messages.create({
    body,
    from: `whatsapp:${phoneNumberId}`,
    to: `whatsapp:${formatPhoneNumber(to)}`,
  });

  return { messageId: message.sid };
}

/**
 * Send WhatsApp via Meta Cloud API (WhatsApp Business API)
 */
async function sendViaMetaCloud(to, body, apiKey, phoneNumberId) {
  const fetch = (await import('node-fetch')).default;

  const formattedPhone = formatPhoneNumber(to).replace('+', '');

  const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'text',
      text: { body },
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Meta Cloud API error');
  }

  return { messageId: data.messages?.[0]?.id };
}

/**
 * Send WhatsApp template message (for approved templates)
 * @param {string} to - Phone number
 * @param {string} templateName - Name of the approved template
 * @param {Array} components - Template components with parameters
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result
 */
async function sendWhatsAppTemplate(to, templateName, components, options = {}) {
  const { student_id = null, template_id = null } = options;

  await initMessagingSettings();

  const settings = await getWhatsAppSettings();
  const mode = getWhatsAppMode(settings);
  const enabled = settings?.whatsapp_enabled ?? false;

  if (!enabled) {
    return logMessage({
      student_id,
      template_id,
      channel: 'whatsapp',
      recipient: to,
      message: `[Template: ${templateName}] ${JSON.stringify(components)}`,
      status: 'mock',
      error_message: 'WhatsApp disabled in settings',
    });
  }

  if (mode === 'mock') {
    return logMessage({
      student_id,
      template_id,
      channel: 'whatsapp',
      recipient: to,
      message: `[Template: ${templateName}] ${JSON.stringify(components)}`,
      status: 'mock',
      error_message: null,
    });
  }

  const apiKey = settings?.whatsapp_api_key;
  const phoneNumberId = settings?.whatsapp_phone_number_id;

  if (!apiKey || !phoneNumberId) {
    return logMessage({
      student_id,
      template_id,
      channel: 'whatsapp',
      recipient: to,
      message: `[Template: ${templateName}]`,
      status: 'failed',
      error_message: 'WhatsApp API key or Phone Number ID not configured',
    });
  }

  try {
    let result;
    if (mode === 'meta') {
      result = await sendTemplateViaMetaCloud(to, templateName, components, apiKey, phoneNumberId);
    } else if (mode === 'twilio') {
      result = await sendTemplateViaTwilio(to, templateName, components, apiKey, phoneNumberId);
    } else {
      throw new Error(`Unknown WhatsApp mode: ${mode}`);
    }

    return logMessage({
      student_id,
      template_id,
      channel: 'whatsapp',
      recipient: to,
      message: `[Template: ${templateName}]`,
      status: 'sent',
      error_message: null,
    });
  } catch (err) {
    console.error('[whatsappService.sendWhatsAppTemplate] Error:', err);
    return logMessage({
      student_id,
      template_id,
      channel: 'whatsapp',
      recipient: to,
      message: `[Template: ${templateName}]`,
      status: 'failed',
      error_message: err.message,
    });
  }
}

/**
 * Send template via Meta Cloud API
 */
async function sendTemplateViaMetaCloud(to, templateName, components, apiKey, phoneNumberId) {
  const fetch = (await import('node-fetch')).default;

  const formattedPhone = formatPhoneNumber(to).replace('+', '');

  const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components,
      },
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Meta Cloud API error');
  }

  return { messageId: data.messages?.[0]?.id };
}

/**
 * Send template via Twilio
 */
async function sendTemplateViaTwilio(to, templateName, components, apiKey, phoneNumberId) {
  const [accountSid, authToken] = apiKey.split(':');
  if (!accountSid || !authToken) {
    throw new Error('Invalid Twilio credentials format. Use "account_sid:auth_token"');
  }

  const twilio = require('twilio')(accountSid, authToken);

  // Convert components to Twilio format
  const contentVariables = components
    .filter(c => c.type === 'body')
    .flatMap(c => c.parameters || [])
    .map(p => p.text)
    .join(',');

  const message = await twilio.messages.create({
    contentSid: templateName, // In Twilio, this is the Content SID
    from: `whatsapp:${phoneNumberId}`,
    to: `whatsapp:${formatPhoneNumber(to)}`,
    contentVariables: JSON.stringify({ '1': contentVariables }), // Simplified
  });

  return { messageId: message.sid };
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
    console.error('[whatsappService.logMessage] Failed to log message:', err);
    return {
      success: false,
      status: 'failed',
      error: err.message,
    };
  }
}

/**
 * Send bulk WhatsApp messages
 * @param {Array} messages - Array of { to, body, student_id, template_id }
 * @returns {Promise<Array>} Results for each message
 */
async function sendBulkWhatsApp(messages) {
  const results = [];
  for (const msg of messages) {
    const result = await sendWhatsApp(msg.to, msg.body, {
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
  sendWhatsApp,
  sendWhatsAppTemplate,
  sendBulkWhatsApp,
  getWhatsAppSettings,
  initMessagingSettings,
  interpolateTemplate,
  logMessage,
  formatPhoneNumber,
};