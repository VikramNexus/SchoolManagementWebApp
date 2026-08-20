/**
 * Message Controller — School Management System
 *
 * Day 9: Reminders, Messages & Financial Reports.
 *
 * Handles message templates CRUD, bulk messaging, and sending reminders.
 */

const db = require('../config/db');
const { sendSMS, sendWhatsApp } = require('../services/smsService');
const { sendWhatsApp: sendWhatsAppService } = require('../services/whatsappService');
const { getSMSSettings, getWhatsAppSettings } = require('../services/smsService');

/**
 * GET /api/messages/templates
 * List all message templates
 */
async function getTemplates(req, res) {
  try {
    const templates = await db.query(
      'SELECT * FROM `message_templates` WHERE `is_active` = 1 ORDER BY `channel`, `name`'
    );
    return res.json({ success: true, templates });
  } catch (err) {
    console.error('[messageController.getTemplates]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch message templates.' });
  }
}

/**
 * POST /api/messages/templates
 * Create a new message template
 */
async function createTemplate(req, res) {
  const { name, channel, body, is_active } = req.body || {};

  if (!name || !channel || !body) {
    return res.status(400).json({ success: false, message: 'Name, channel, and body are required.' });
  }

  if (!['sms', 'whatsapp', 'both'].includes(channel)) {
    return res.status(400).json({ success: false, message: 'Invalid channel. Must be sms, whatsapp, or both.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO `message_templates` (`name`, `channel`, `body`, `is_active`) VALUES (?, ?, ?, ?)',
      [name, channel, body, is_active ? 1 : 0]
    );

    const template = await db.queryOne('SELECT * FROM `message_templates` WHERE `id` = ?', [result.insertId]);
    return res.status(201).json({ success: true, template, message: 'Template created successfully.' });
  } catch (err) {
    console.error('[messageController.createTemplate]', err);
    return res.status(500).json({ success: false, message: 'Failed to create template.' });
  }
}

/**
 * PUT /api/messages/templates/:id
 * Update a message template
 */
async function updateTemplate(req, res) {
  const { id } = req.params;
  const { name, channel, body, is_active } = req.body || {};

  if (!name || !channel || !body) {
    return res.status(400).json({ success: false, message: 'Name, channel, and body are required.' });
  }

  if (!['sms', 'whatsapp', 'both'].includes(channel)) {
    return res.status(400).json({ success: false, message: 'Invalid channel. Must be sms, whatsapp, or both.' });
  }

  try {
    await db.query(
      'UPDATE `message_templates` SET `name` = ?, `channel` = ?, `body` = ?, `is_active` = ? WHERE `id` = ?',
      [name, channel, body, is_active ? 1 : 0, id]
    );

    const template = await db.queryOne('SELECT * FROM `message_templates` WHERE `id` = ?', [id]);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    return res.json({ success: true, template, message: 'Template updated successfully.' });
  } catch (err) {
    console.error('[messageController.updateTemplate]', err);
    return res.status(500).json({ success: false, message: 'Failed to update template.' });
  }
}

/**
 * DELETE /api/messages/templates/:id
 * Delete a message template
 */
async function deleteTemplate(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM `message_templates` WHERE `id` = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }
    return res.json({ success: true, message: 'Template deleted successfully.' });
  } catch (err) {
    console.error('[messageController.deleteTemplate]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete template.' });
  }
}

/**
 * Helper: Replace placeholders in template body
 */
function replacePlaceholders(body, student, schoolSettings) {
  return body
    .replace(/\{student_name\}/g, student.full_name || '')
    .replace(/\{admission_no\}/g, student.admission_no || '')
    .replace(/\{due_amount\}/g, student.total_due?.toLocaleString('en-IN') || '0')
    .replace(/\{school_name\}/g, schoolSettings?.school_name || '')
    .replace(/\{payment_date\}/g, student.payment_date ? new Date(student.payment_date).toLocaleDateString('en-IN') : '')
    .replace(/\{receipt_number\}/g, student.receipt_number || '')
    .replace(/\{class_name\}/g, student.class_name || '')
    .replace(/\{section_name\}/g, student.section_name || '')
    .replace(/\{category\}/g, student.category || '');
}

/**
 * POST /api/messages/send-reminders
 * Send bulk fee reminders to students with outstanding dues
 * Body: { template_id, channel, student_ids[], custom_message? }
 */
async function sendReminders(req, res) {
  const { template_id, channel, student_ids, custom_message } = req.body || {};

  if (!template_id) {
    return res.status(400).json({ success: false, message: 'Template ID is required.' });
  }
  if (!channel || !['sms', 'whatsapp', 'both'].includes(channel)) {
    return res.status(400).json({ success: false, message: 'Valid channel (sms, whatsapp, or both) is required.' });
  }
  if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one student ID is required.' });
  }

  try {
    // Get template
    const template = await db.queryOne('SELECT * FROM `message_templates` WHERE `id` = ? AND `is_active` = 1', [template_id]);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found or inactive.' });
    }

    // Get school settings
    const schoolSettings = await db.queryOne(
      'SELECT `school_name` FROM `school_settings` WHERE `id` = 1 LIMIT 1'
    );

    // Get students with their dues
    const placeholders = student_ids.map(() => '?').join(',');
    const students = await db.query(
      `SELECT s.*, c.name as class_name, sec.name as section_name,
              COALESCE(
                (SELECT SUM(mf.due_amount)
                 FROM monthly_fees mf
                 WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0
              ) as monthly_dues,
              COALESCE(
                (SELECT SUM(saf.amount)
                 FROM student_additional_fees saf
                 WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')), 0
              ) as additional_dues
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id IN (${placeholders}) AND s.status = 'active'`,
      student_ids
    );

    // Add total_due to each student
    students.forEach(s => {
      s.total_due = Number(s.monthly_dues) + Number(s.additional_dues);
    });

    // Filter students with actual dues
    const studentsWithDues = students.filter(s => s.total_due > 0);

    if (studentsWithDues.length === 0) {
      return res.json({ success: true, message: 'No students with outstanding dues found.', sent: 0, failed: 0 });
    }

    // Send messages
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const student of studentsWithDues) {
      const messageBody = custom_message || replacePlaceholders(template.body, student, schoolSettings);

      const sendChannels = channel === 'both' ? ['sms', 'whatsapp'] : [channel];

      for (const ch of sendChannels) {
        try {
          if (ch === 'sms') {
            await sendSMS(student.phone, messageBody, {
              student_id: student.id,
              template_id: template.id,
            });
          } else {
            await sendWhatsApp(student.phone, messageBody, {
              student_id: student.id,
              template_id: template.id,
            });
          }
          sent++;
        } catch (err) {
          failed++;
          errors.push({ student_id: student.id, channel: ch, error: err.message });
        }
      }
    }

    return res.json({
      success: true,
      message: `Reminders sent: ${sent}, failed: ${failed}`,
      sent,
      failed,
      errors,
    });
  } catch (err) {
    console.error('[messageController.sendReminders]', err);
    return res.status(500).json({ success: false, message: 'Failed to send reminders.' });
  }
}

/**
 * GET /api/messages/logs
 * Get message logs with pagination and filters
 */
async function getMessageLogs(req, res) {
  const { page = 1, limit = 50, channel, status, student_id, start_date, end_date } = req.query;

  try {
    const conditions = [];
    const values = [];

    if (channel) {
      conditions.push('ml.channel = ?');
      values.push(channel);
    }
    if (status) {
      conditions.push('ml.status = ?');
      values.push(status);
    }
    if (student_id) {
      conditions.push('ml.student_id = ?');
      values.push(Number(student_id));
    }
    if (start_date) {
      conditions.push('ml.sent_at >= ?');
      values.push(start_date);
    }
    if (end_date) {
      conditions.push('ml.sent_at <= ?');
      values.push(end_date);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const numLimit = Math.max(1, Number(limit) || 50);
    const numPage = Math.max(1, Number(page) || 1);
    const numOffset = (numPage - 1) * numLimit;

    const countSql = `SELECT COUNT(*) as total FROM message_logs ml ${whereClause}`;
    const [{ total }] = await db.query(countSql, values);

    const dataSql = `
      SELECT ml.*, s.full_name as student_name, s.admission_no, mt.name as template_name
      FROM message_logs ml
      LEFT JOIN students s ON s.id = ml.student_id
      LEFT JOIN message_templates mt ON mt.id = ml.template_id
      ${whereClause}
      ORDER BY ml.sent_at DESC
      LIMIT ? OFFSET ?
    `;
    const logs = await db.query(dataSql, [...values, numLimit, numOffset]);

    return res.json({
      success: true,
      logs,
      pagination: {
        page: numPage,
        limit: numLimit,
        total,
        total_pages: Math.ceil(total / numLimit),
      },
    });
  } catch (err) {
    console.error('[messageController.getMessageLogs]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch message logs.' });
  }
}

/**
 * POST /api/messages/send-payment-confirmation
 * Send payment confirmation message
 * Body: { payment_id, channel, template_id? }
 */
async function sendPaymentConfirmation(req, res) {
  const { payment_id, channel, template_id } = req.body || {};

  if (!payment_id) {
    return res.status(400).json({ success: false, message: 'Payment ID is required.' });
  }
  if (!channel || !['sms', 'whatsapp', 'both'].includes(channel)) {
    return res.status(400).json({ success: false, message: 'Valid channel (sms, whatsapp, or both) is required.' });
  }

  try {
    // Get payment with student details
    const payment = await db.queryOne(
      `SELECT p.*, s.full_name, s.admission_no, s.phone, s.class_id, s.section_id, s.category,
              c.name as class_name, sec.name as section_name,
              r.receipt_number
       FROM payments p
       JOIN students s ON s.id = p.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN receipts r ON r.payment_id = p.id
       WHERE p.id = ?`,
      [payment_id]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // Get template (default to payment confirmation if not specified)
    let template;
    if (template_id) {
      template = await db.queryOne('SELECT * FROM `message_templates` WHERE `id` = ? AND `is_active` = 1', [template_id]);
    } else {
      // Find default payment confirmation template for the channel
      const ch = channel === 'both' ? 'sms' : channel;
      template = await db.queryOne(
        "SELECT * FROM `message_templates` WHERE `name` LIKE ? AND `channel` IN (?, 'both') AND `is_active` = 1 LIMIT 1",
        [`%Payment Confirmation%`, ch]
      );
    }

    if (!template) {
      return res.status(404).json({ success: false, message: 'No suitable template found. Please create a payment confirmation template.' });
    }

    const schoolSettings = await db.queryOne('SELECT `school_name` FROM `school_settings` WHERE `id` = 1 LIMIT 1');

    // Prepare student object with payment data
    const studentData = {
      ...payment,
      total_due: payment.amount,
      payment_date: payment.payment_date,
      receipt_number: payment.receipt_number,
    };

    const messageBody = replacePlaceholders(template.body, studentData, schoolSettings);

    let sent = 0;
    let failed = 0;
    const errors = [];

    const sendChannels = channel === 'both' ? ['sms', 'whatsapp'] : [channel];

    for (const ch of sendChannels) {
      try {
        if (ch === 'sms') {
          await sendSMS(payment.phone, messageBody, {
            student_id: payment.id,
            template_id: template.id,
            payment_id: payment.id,
          });
        } else {
          await sendWhatsApp(payment.phone, messageBody, {
            student_id: payment.id,
            template_id: template.id,
            payment_id: payment.id,
          });
        }
        sent++;
      } catch (err) {
        failed++;
        errors.push({ channel: ch, error: err.message });
      }
    }

    return res.json({
      success: true,
      message: `Confirmation sent: ${sent}, failed: ${failed}`,
      sent,
      failed,
      errors,
    });
  } catch (err) {
    console.error('[messageController.sendPaymentConfirmation]', err);
    return res.status(500).json({ success: false, message: 'Failed to send payment confirmation.' });
  }
}

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendReminders,
  getMessageLogs,
  sendPaymentConfirmation,
};