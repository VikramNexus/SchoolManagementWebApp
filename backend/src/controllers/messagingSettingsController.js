/**
 * Messaging Settings Controller — School Management System
 *
 * Day 8: Receipts & Messaging Foundation.
 *
 * API endpoints:
 * - GET /api/settings/messaging - Get messaging settings
 * - PUT /api/settings/messaging - Update messaging settings
 */

const db = require('../config/db');

/**
 * GET /api/settings/messaging
 * Get current messaging settings
 */
async function getMessagingSettings(req, res) {
  try {
    const settings = await db.queryOne(
      `SELECT \`id\`, \`sms_enabled\`, \`sms_provider\`, \`sms_api_key\`, \`sms_sender_id\`, \`sms_mock_mode\`,
              \`whatsapp_enabled\`, \`whatsapp_provider\`, \`whatsapp_api_key\`, \`whatsapp_phone_number_id\`, \`whatsapp_mock_mode\`,
              \`updated_at\`
       FROM \`messaging_settings\`
       WHERE \`id\` = 1`
    );

    if (!settings) {
      // Initialize with defaults
      await db.query(
        `INSERT IGNORE INTO \`messaging_settings\` (\`id\`, \`sms_enabled\`, \`sms_provider\`, \`sms_mock_mode\`, \`whatsapp_enabled\`, \`whatsapp_provider\`, \`whatsapp_mock_mode\`)
         VALUES (1, 0, 'twilio', 1, 0, 'twilio', 1)`
      );
      const newSettings = await db.queryOne(
        `SELECT \`id\`, \`sms_enabled\`, \`sms_provider\`, \`sms_api_key\`, \`sms_sender_id\`, \`sms_mock_mode\`,
                \`whatsapp_enabled\`, \`whatsapp_provider\`, \`whatsapp_api_key\`, \`whatsapp_phone_number_id\`, \`whatsapp_mock_mode\`,
                \`updated_at\`
         FROM \`messaging_settings\`
         WHERE \`id\` = 1`
      );
      return res.json({ success: true, settings: newSettings });
    }

    // Mask API keys in response for security
    const response = { ...settings };
    if (response.sms_api_key) {
      response.sms_api_key = '••••••••' + response.sms_api_key.slice(-4);
    }
    if (response.whatsapp_api_key) {
      response.whatsapp_api_key = '••••••••' + response.whatsapp_api_key.slice(-4);
    }

    // Add effective WhatsApp mode (from env or fallback)
    const whatsappMode = process.env.WHATSAPP_MODE?.toLowerCase();
    response.whatsapp_mode = whatsappMode && ['mock', 'meta', 'twilio'].includes(whatsappMode)
      ? whatsappMode
      : (response.whatsapp_mock_mode ? 'mock' : (response.whatsapp_provider || 'meta'));

    return res.json({ success: true, settings: response });
  } catch (err) {
    console.error('[messagingSettingsController.getMessagingSettings]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch messaging settings.' });
  }
}

/**
 * PUT /api/settings/messaging
 * Update messaging settings
 */
async function updateMessagingSettings(req, res) {
  const {
    sms_enabled,
    sms_provider,
    sms_api_key,
    sms_sender_id,
    sms_mock_mode,
    whatsapp_enabled,
    whatsapp_provider,
    whatsapp_mode,
    whatsapp_api_key,
    whatsapp_phone_number_id,
    whatsapp_mock_mode,
  } = req.body || {};

  try {
    // Validate provider values
    if (sms_provider && !['twilio', 'msg91'].includes(sms_provider)) {
      return res.status(400).json({ success: false, message: 'Invalid SMS provider.' });
    }
    if (whatsapp_provider && !['twilio', 'meta'].includes(whatsapp_provider)) {
      return res.status(400).json({ success: false, message: 'Invalid WhatsApp provider.' });
    }
    if (whatsapp_mode && !['mock', 'meta', 'twilio'].includes(whatsapp_mode)) {
      return res.status(400).json({ success: false, message: 'Invalid WhatsApp mode. Use mock, meta, or twilio.' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (sms_enabled !== undefined) {
      updates.push('`sms_enabled` = ?');
      values.push(sms_enabled ? 1 : 0);
    }
    if (sms_provider !== undefined) {
      updates.push('`sms_provider` = ?');
      values.push(sms_provider);
    }
    if (sms_api_key !== undefined) {
      updates.push('`sms_api_key` = ?');
      values.push(sms_api_key || null);
    }
    if (sms_sender_id !== undefined) {
      updates.push('`sms_sender_id` = ?');
      values.push(sms_sender_id || null);
    }
    if (sms_mock_mode !== undefined) {
      updates.push('`sms_mock_mode` = ?');
      values.push(sms_mock_mode ? 1 : 0);
    }
    if (whatsapp_enabled !== undefined) {
      updates.push('`whatsapp_enabled` = ?');
      values.push(whatsapp_enabled ? 1 : 0);
    }
    if (whatsapp_provider !== undefined) {
      updates.push('`whatsapp_provider` = ?');
      values.push(whatsapp_provider);
    }
    if (whatsapp_api_key !== undefined) {
      updates.push('`whatsapp_api_key` = ?');
      values.push(whatsapp_api_key || null);
    }
    if (whatsapp_phone_number_id !== undefined) {
      updates.push('`whatsapp_phone_number_id` = ?');
      values.push(whatsapp_phone_number_id || null);
    }
    if (whatsapp_mock_mode !== undefined) {
      updates.push('`whatsapp_mock_mode` = ?');
      values.push(whatsapp_mock_mode ? 1 : 0);
    }
    // Note: whatsapp_mode is determined by WHATSAPP_MODE env var, not stored in DB

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    // Ensure settings row exists
    await db.query(
      `INSERT IGNORE INTO \`messaging_settings\` (\`id\`, \`sms_enabled\`, \`sms_provider\`, \`sms_mock_mode\`, \`whatsapp_enabled\`, \`whatsapp_provider\`, \`whatsapp_mock_mode\`)
       VALUES (1, 0, 'twilio', 1, 0, 'twilio', 1)`
    );

    const sql = `UPDATE \`messaging_settings\` SET ${updates.join(', ')} WHERE \`id\` = 1`;
    await db.query(sql, values);

    // Fetch updated settings
    const settings = await db.queryOne(
      `SELECT \`id\`, \`sms_enabled\`, \`sms_provider\`, \`sms_api_key\`, \`sms_sender_id\`, \`sms_mock_mode\`,
              \`whatsapp_enabled\`, \`whatsapp_provider\`, \`whatsapp_api_key\`, \`whatsapp_phone_number_id\`, \`whatsapp_mock_mode\`,
              \`updated_at\`
       FROM \`messaging_settings\`
       WHERE \`id\` = 1`
    );

    // Mask API keys in response
    const response = { ...settings };
    if (response.sms_api_key) {
      response.sms_api_key = '••••••••' + response.sms_api_key.slice(-4);
    }
    if (response.whatsapp_api_key) {
      response.whatsapp_api_key = '••••••••' + response.whatsapp_api_key.slice(-4);
    }

    return res.json({ success: true, message: 'Messaging settings updated.', settings: response });
  } catch (err) {
    console.error('[messagingSettingsController.updateMessagingSettings]', err);
    return res.status(500).json({ success: false, message: 'Failed to update messaging settings.' });
  }
}

/**
 * POST /api/settings/messaging/test-sms
 * Send a test SMS
 */
async function testSMS(req, res) {
  const { phone_number } = req.body || {};

  if (!phone_number) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  try {
    const { sendSMS } = require('../services/smsService');
    const result = await sendSMS(phone_number, 'Test SMS from School Management System', {
      template_id: null,
    });

    return res.json({ success: true, message: 'Test SMS sent.', result });
  } catch (err) {
    console.error('[messagingSettingsController.testSMS]', err);
    return res.status(500).json({ success: false, message: 'Failed to send test SMS.' });
  }
}

/**
 * POST /api/settings/messaging/test-whatsapp
 * Send a test WhatsApp message
 */
async function testWhatsApp(req, res) {
  const { phone_number } = req.body || {};

  if (!phone_number) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  try {
    const { sendWhatsApp } = require('../services/whatsappService');
    const result = await sendWhatsApp(phone_number, 'Test WhatsApp from Aryavart Portal — System active & connected!', {
      template_id: null,
    });

    return res.json({ success: true, message: 'Test WhatsApp sent.', result });
  } catch (err) {
    console.error('[messagingSettingsController.testWhatsApp]', err);
    return res.status(500).json({ success: false, message: 'Failed to send test WhatsApp.' });
  }
}

/**
 * GET /api/settings/messaging/whatsapp-qr
 * Get current QR code and live connection status for linked WhatsApp phone
 */
async function getWhatsAppQR(req, res) {
  try {
    const localGateway = require('../services/localWhatsAppGateway');
    const status = localGateway.getStatus();

    // If completely disconnected, trigger background initialization so QR code generates
    if (status.status === 'disconnected') {
      localGateway.initWhatsAppGateway().catch((e) => console.error('[getWhatsAppQR init]', e));
    }

    return res.json({
      success: true,
      ...localGateway.getStatus(),
    });
  } catch (err) {
    console.error('[messagingSettingsController.getWhatsAppQR]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve WhatsApp QR code.' });
  }
}

/**
 * POST /api/settings/messaging/whatsapp-disconnect
 * Disconnect / Log out currently linked WhatsApp phone
 */
async function disconnectWhatsApp(req, res) {
  try {
    const localGateway = require('../services/localWhatsAppGateway');
    const result = await localGateway.disconnectGateway();
    return res.json(result);
  } catch (err) {
    console.error('[messagingSettingsController.disconnectWhatsApp]', err);
    return res.status(500).json({ success: false, message: 'Failed to disconnect WhatsApp.' });
  }
}

/**
 * POST /api/settings/messaging/whatsapp-restart
 * Refresh / Regenerate WhatsApp QR code
 */
async function restartWhatsApp(req, res) {
  try {
    const localGateway = require('../services/localWhatsAppGateway');
    const status = await localGateway.restartGateway();
    return res.json({ success: true, ...status });
  } catch (err) {
    console.error('[messagingSettingsController.restartWhatsApp]', err);
    return res.status(500).json({ success: false, message: 'Failed to restart WhatsApp socket.' });
  }
}

module.exports = {
  getMessagingSettings,
  updateMessagingSettings,
  testSMS,
  testWhatsApp,
  getWhatsAppQR,
  disconnectWhatsApp,
  restartWhatsApp,
};