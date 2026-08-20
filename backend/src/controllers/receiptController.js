/**
 * Receipt Controller — School Management System
 *
 * Day 8: Receipts & Messaging Foundation.
 *
 * API endpoints:
 * - POST /api/receipts/generate/:paymentId - Generate receipt PDF for a payment
 * - GET /api/receipts/:paymentId - Get receipt info (for inline viewing)
 * - GET /api/receipts/download/:paymentId - Download receipt PDF
 * - GET /api/receipts - List all receipts with filters
 */

const db = require('../config/db');
const { generateAndSaveReceipt, generateAndSaveDuesNotice, getPaymentDetailsForReceipt, getPaymentAllocations } = require('../services/pdfReceiptService');

/**
 * POST /api/receipts/generate/:paymentId
 * Generate a PDF receipt for a payment
 */
async function generateReceipt(req, res) {
  const { paymentId } = req.params;

  try {
    // Verify payment exists
    const payment = await db.queryOne(
      `SELECT p.*, r.\`receipt_number\`, r.\`file_path\`
       FROM \`payments\` p
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       WHERE p.\`id\` = ?`,
      [paymentId]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // Generate receipt PDF
    const result = await generateAndSaveReceipt(paymentId);

    // Fetch updated receipt info
    const receipt = await db.queryOne(
      `SELECT r.*, p.\`amount\`, p.\`payment_date\`, s.\`full_name\`, s.\`admission_no\`
       FROM \`receipts\` r
       LEFT JOIN \`payments\` p ON p.\`id\` = r.\`payment_id\`
       LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
       WHERE r.\`payment_id\` = ?`,
      [paymentId]
    );

    return res.json({
      success: true,
      message: 'Receipt generated successfully.',
      receipt,
      filePath: result.relativePath,
    });
  } catch (err) {
    console.error('[receiptController.generateReceipt]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate receipt.' });
  }
}

/**
 * GET /api/receipts/:paymentId
 * Get receipt information (for inline viewing)
 */
async function getReceipt(req, res) {
  const { paymentId } = req.params;

  try {
    let payment = await db.queryOne(
      `SELECT p.*, r.\`id\` as receipt_id, r.\`receipt_number\`, r.\`file_path\`, r.\`created_at\` as receipt_created_at,
              s.\`full_name\`, s.\`admission_no\`, s.\`class_id\`, s.\`section_id\`, s.\`category\`, s.\`phone\`, s.\`whatsapp_number\`,
              c.\`name\` as class_name, sec.\`name\` as section_name
       FROM \`payments\` p
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       WHERE p.\`id\` = ?`,
      [paymentId]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // If receipt not generated yet, auto-generate it now
    if (!payment.receipt_id || !payment.file_path) {
      try {
        await generateAndSaveReceipt(paymentId);
        payment = await db.queryOne(
          `SELECT p.*, r.\`id\` as receipt_id, r.\`receipt_number\`, r.\`file_path\`, r.\`created_at\` as receipt_created_at,
                  s.\`full_name\`, s.\`admission_no\`, s.\`class_id\`, s.\`section_id\`, s.\`category\`, s.\`phone\`, s.\`whatsapp_number\`,
                  c.\`name\` as class_name, sec.\`name\` as section_name
           FROM \`payments\` p
           LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
           LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
           LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
           LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
           WHERE p.\`id\` = ?`,
          [paymentId]
        );
      } catch (genErr) {
        console.error('[getReceipt auto-gen]', genErr);
      }
    }

    // Get allocations
    const allocations = await getPaymentAllocations(paymentId);

    // Get school settings
    const school = await db.queryOne(
      `SELECT \`school_name\`, \`address\`, \`phone\`, \`email\`, \`logo_path\`, \`currency_symbol\`
       FROM \`school_settings\` WHERE \`id\` = 1`
    ) || { school_name: 'Aryavart Public School' };

    // Get outstanding
    const monthlyOutstanding = await db.queryOne(
      `SELECT COALESCE(SUM(\`due_amount\`), 0) as total
       FROM \`monthly_fees\`
       WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
      [payment.student_id]
    );

    const additionalOutstanding = await db.queryOne(
      `SELECT COALESCE(SUM(\`due_amount\`), 0) as total
       FROM \`student_additional_fees\`
       WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
      [payment.student_id]
    );

    return res.json({
      success: true,
      receipt: {
        id: payment.receipt_id,
        receipt_number: payment.receipt_number || `REC-${payment.id.toString().padStart(5, '0')}`,
        file_path: payment.file_path,
        created_at: payment.receipt_created_at,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        payment_mode: payment.payment_mode,
        notes: payment.notes,
      },
      student: {
        id: payment.student_id,
        full_name: payment.full_name,
        admission_no: payment.admission_no,
        class_name: payment.class_name,
        section_name: payment.section_name,
        category: payment.category,
        phone: payment.phone,
        whatsapp_number: payment.whatsapp_number,
      },
      allocations,
      school,
      outstanding: {
        monthly: Number(monthlyOutstanding?.total || 0),
        additional: Number(additionalOutstanding?.total || 0),
        total: Number(monthlyOutstanding?.total || 0) + Number(additionalOutstanding?.total || 0),
      },
    });
  } catch (err) {
    console.error('[receiptController.getReceipt]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch receipt.' });
  }
}

/**
 * GET /api/receipts/download/:paymentId
 * Download the receipt PDF file
 */
async function downloadReceipt(req, res) {
  const { paymentId } = req.params;
  const path = require('path');
  const fs = require('fs');

  try {
    let receipt = await db.queryOne(
      `SELECT r.\`file_path\`, r.\`receipt_number\`, p.\`payment_date\`, s.\`full_name\`
       FROM \`payments\` p
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
       WHERE p.\`id\` = ?`,
      [paymentId]
    );

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    let filePath = receipt.file_path ? path.join(__dirname, '../../', receipt.file_path) : null;

    if (!filePath || !fs.existsSync(filePath)) {
      const result = await generateAndSaveReceipt(paymentId);
      filePath = result.filePath;
      receipt = await db.queryOne(
        `SELECT r.\`file_path\`, r.\`receipt_number\`
         FROM \`receipts\` r WHERE r.\`payment_id\` = ?`,
        [paymentId]
      );
    }

    const filename = `Receipt_${receipt?.receipt_number || paymentId}.pdf`;
    return res.download(filePath, filename);
  } catch (err) {
    console.error('[receiptController.downloadReceipt]', err);
    return res.status(500).json({ success: false, message: 'Failed to download receipt: ' + err.message });
  }
}

/**
 * GET /api/receipts
 * List all receipts with filters
 * Query: student_id, start_date, end_date, class_id, category, page, limit
 */
async function listReceipts(req, res) {
  const { search, student_id, start_date, end_date, class_id, category, sort_by = 'payment_date', sort_order = 'desc', page = 1, limit = 25 } = req.query;

  try {
    const conditions = [];
    const values = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(s.`full_name` LIKE ? OR s.`admission_no` LIKE ? OR r.`receipt_number` LIKE ?)');
      values.push(term, term, term);
    }

    if (student_id) {
      conditions.push('p.`student_id` = ?');
      values.push(student_id);
    }
    if (start_date) {
      conditions.push('DATE(p.`payment_date`) >= ?');
      values.push(start_date);
    }
    if (end_date) {
      conditions.push('DATE(p.`payment_date`) <= ?');
      values.push(end_date);
    }
    if (class_id) {
      conditions.push('s.`class_id` = ?');
      values.push(class_id);
    }
    if (category) {
      conditions.push('s.`category` = ?');
      values.push(category);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);
    const offsetNum = Number(offset);

    const orderDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    let orderByClause = `p.\`payment_date\` ${orderDirection}, p.\`created_at\` ${orderDirection}`;
    if (sort_by === 'amount') {
      orderByClause = `p.\`amount\` ${orderDirection}`;
    } else if (sort_by === 'student_name') {
      orderByClause = `s.\`full_name\` ${orderDirection}`;
    } else if (sort_by === 'receipt_number') {
      orderByClause = `r.\`receipt_number\` ${orderDirection}`;
    }

    const countSql = `
      SELECT COUNT(*) as total
      FROM \`receipts\` r
      LEFT JOIN \`payments\` p ON p.\`id\` = r.\`payment_id\`
      LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
      ${whereClause}
    `;

    const dataSql = `
      SELECT r.*, p.\`amount\`, p.\`payment_date\`, p.\`payment_mode\`,
             s.\`full_name\` as student_name, s.\`admission_no\`, s.\`category\` as student_category,
             c.\`name\` as class_name
      FROM \`receipts\` r
      LEFT JOIN \`payments\` p ON p.\`id\` = r.\`payment_id\`
      LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
      LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
      ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const [countResult, receipts] = await Promise.all([
      db.queryOne(countSql, values),
      db.query(dataSql, values),
    ]);

    return res.json({
      success: true,
      receipts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / Number(limit)),
      },
    });
  } catch (err) {
    console.error('[receiptController.listReceipts]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch receipts.' });
  }
}

/**
 * GET /api/receipts/dues-notice/:studentId
 * Generate and stream Dues Statement PDF for a student
 */
async function generateDuesNotice(req, res) {
  const { studentId } = req.params;

  try {
    const student = await db.queryOne(
      'SELECT `id`, `full_name` FROM `students` WHERE `id` = ? AND `status` != "deleted"',
      [studentId]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const { filePath } = await generateAndSaveDuesNotice(studentId);
    return res.download(filePath, `Dues_Notice_${student.full_name.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error('[receiptController.generateDuesNotice]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate dues notice.' });
  }
}

/**
 * POST /api/receipts/send-whatsapp/:paymentId
 * Dispatch payment receipt directly via WhatsApp in background
 */
async function sendReceiptWhatsApp(req, res) {
  const { paymentId } = req.params;

  try {
    const payment = await db.queryOne(
      `SELECT p.*, r.\`receipt_number\`,
              s.\`id\` as student_id, s.\`full_name\`, s.\`admission_no\`, s.\`phone\`, s.\`whatsapp_number\`,
              c.\`name\` as class_name, sec.\`name\` as section_name
       FROM \`payments\` p
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       WHERE p.\`id\` = ?`,
      [paymentId]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    const recipientPhone = payment.whatsapp_number || payment.phone;
    if (!recipientPhone) {
      return res.status(400).json({ success: false, message: 'No phone or WhatsApp number registered for student.' });
    }

    const school = await db.queryOne('SELECT `school_name`, `phone` FROM `school_settings` WHERE `id` = 1') || { school_name: 'Aryavart Public School' };

    // Get outstanding
    const monthlyDue = await db.queryOne(
      `SELECT COALESCE(SUM(\`due_amount\`), 0) as total FROM \`monthly_fees\` WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
      [payment.student_id]
    );
    const additionalDue = await db.queryOne(
      `SELECT COALESCE(SUM(\`amount\`), 0) as total FROM \`student_additional_fees\` WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
      [payment.student_id]
    );
    const totalOutstanding = Number(monthlyDue?.total || 0) + Number(additionalDue?.total || 0);

    const formattedDate = new Date(payment.payment_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const receiptNo = payment.receipt_number || `REC-${payment.id.toString().padStart(5, '0')}`;
    const amountStr = `₹${Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const outstandingStr = `₹${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const messageText = 
`🧾 *${(school.school_name || 'ARYAVART PUBLIC SCHOOL').toUpperCase()}*
*FEE PAYMENT RECEIPT*
━━━━━━━━━━━━━━━━━━━━
📄 *Receipt No:* ${receiptNo}
📅 *Payment Date:* ${formattedDate}

👤 *Student:* ${payment.full_name}
🆔 *Adm No:* ${payment.admission_no || 'N/A'}
🏫 *Class:* ${payment.class_name || 'N/A'}${payment.section_name ? ` (${payment.section_name})` : ''}

💰 *Amount Paid:* ${amountStr}
💳 *Payment Mode:* ${payment.payment_mode || 'Cash'}
${payment.notes ? `📝 *Note:* ${payment.notes}\n` : ''}
📊 *Current Balance Due:* ${outstandingStr}
━━━━━━━━━━━━━━━━━━━━
Thank you for your payment!
_${school.school_name}_`;

    const { sendWhatsApp } = require('../services/whatsappService');
    const result = await sendWhatsApp(recipientPhone, messageText, {
      student_id: payment.student_id,
      payment_id: payment.id,
    });

    return res.json({
      success: true,
      mode: result?.mode || 'background',
      direct_link: result?.direct_link || null,
      message: result?.mode === 'direct_link' ? `Opening WhatsApp for ${recipientPhone}...` : `WhatsApp receipt sent to ${recipientPhone}`,
      recipient: recipientPhone,
    });
  } catch (err) {
    console.error('[receiptController.sendReceiptWhatsApp]', err);
    return res.status(500).json({ success: false, message: 'Failed to send WhatsApp receipt: ' + err.message });
  }
}

/**
 * POST /api/receipts/send-dues-whatsapp/:studentId
 * Dispatch itemized Dues Notice directly via WhatsApp in background
 */
async function sendDuesNoticeWhatsApp(req, res) {
  const { studentId } = req.params;

  try {
    const student = await db.queryOne(
      `SELECT s.*, c.\`name\` as class_name, sec.\`name\` as section_name
       FROM \`students\` s
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       WHERE s.\`id\` = ? AND s.\`status\` != 'deleted'`,
      [studentId]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const recipientPhone = student.whatsapp_number || student.phone;
    if (!recipientPhone) {
      return res.status(400).json({ success: false, message: 'No phone or WhatsApp number registered for student.' });
    }

    const school = await db.queryOne('SELECT `school_name`, `phone` FROM `school_settings` WHERE `id` = 1') || { school_name: 'Aryavart Public School' };

    // Get itemized dues
    const monthlyDue = await db.queryOne(
      `SELECT COALESCE(SUM(\`due_amount\`), 0) as total FROM \`monthly_fees\` WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
      [studentId]
    );
    const additionalDue = await db.queryOne(
      `SELECT COALESCE(SUM(\`amount\`), 0) as total FROM \`student_additional_fees\` WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
      [studentId]
    );
    const totalOutstanding = Number(monthlyDue?.total || 0) + Number(additionalDue?.total || 0);

    const mStr = `₹${Number(monthlyDue?.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const aStr = `₹${Number(additionalDue?.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const totalStr = `₹${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const messageText = 
`⚠️ *${(school.school_name || 'ARYAVART PUBLIC SCHOOL').toUpperCase()}*
*FEE DUES NOTICE & DEMAND BILL*
━━━━━━━━━━━━━━━━━━━━
Dear Parent / Guardian,
This is a gentle reminder regarding the outstanding school fees for your ward:

👤 *Student:* ${student.full_name}
🆔 *Adm No:* ${student.admission_no || 'N/A'}
🏫 *Class:* ${student.class_name || 'N/A'}${student.section_name ? ` (${student.section_name})` : ''}

📅 *Pending Monthly Dues:* ${mStr}
🏷️ *Additional Charges:* ${aStr}
🔴 *TOTAL OUTSTANDING DUE:* ${totalStr}
━━━━━━━━━━━━━━━━━━━━
Kindly clear the pending dues at your earliest convenience to ensure uninterrupted academic facilities.
_${school.school_name}_`;

    const { sendWhatsApp } = require('../services/whatsappService');
    const result = await sendWhatsApp(recipientPhone, messageText, {
      student_id: student.id,
    });

    return res.json({
      success: true,
      mode: result?.mode || 'background',
      direct_link: result?.direct_link || null,
      message: result?.mode === 'direct_link' ? `Opening WhatsApp for ${recipientPhone}...` : `WhatsApp dues notice sent to ${recipientPhone}`,
      recipient: recipientPhone,
    });
  } catch (err) {
    console.error('[receiptController.sendDuesNoticeWhatsApp]', err);
    return res.status(500).json({ success: false, message: 'Failed to send WhatsApp dues notice: ' + err.message });
  }
}

module.exports = {
  generateReceipt,
  getReceipt,
  downloadReceipt,
  listReceipts,
  generateDuesNotice,
  sendReceiptWhatsApp,
  sendDuesNoticeWhatsApp,
};