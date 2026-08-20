/**
 * Payment Controller — School Management System
 *
 * Day 6: Fee Engine & Payments.
 *
 * Handles payment recording with FIFO allocation.
 */

const db = require('../config/db');
const { allocatePaymentFIFO, canAllocatePayment, getTotalOutstanding } = require('../services/paymentAllocationService');
const { withTransaction } = require('../utils/transactionHandler');
const { generateAndSaveReceipt } = require('../services/pdfReceiptService');

function parseToValidDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date && !isNaN(dateStr)) return dateStr;
  
  const str = String(dateStr).trim();
  // Check DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Check YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return new Date();
}

/**
 * POST /api/payments
 * Record a cash payment and allocate via FIFO
 * Body: { student_id, amount, payment_date, notes, recorded_by }
 */
async function recordPayment(req, res) {
  const { student_id, amount, payment_mode, payment_date, notes, recorded_by } = req.body || {};

  // Validation
  if (!student_id) {
    return res.status(400).json({ success: false, message: 'Student ID is required.' });
  }
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });
  }

  const paymentAmount = Number(amount);
  const paymentChannel = (payment_mode === 'IN_ACCOUNT' || payment_mode === 'in acc.') ? 'IN_ACCOUNT' : 'CASH';

  try {
    // Verify student exists and is active
    const student = await db.queryOne(
      'SELECT `id`, `full_name`, `admission_no`, `status` FROM `students` WHERE `id` = ? AND `status` != "deleted"',
      [student_id]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Check if student has outstanding fees
    const canAllocate = await canAllocatePayment(student_id);
    if (!canAllocate) {
      return res.status(400).json({ success: false, message: 'Student has no outstanding fees.' });
    }

    // Check total outstanding
    const totalOutstanding = await getTotalOutstanding(student_id);
    if (paymentAmount > totalOutstanding) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${paymentAmount}) exceeds total outstanding (₹${totalOutstanding}).`
      });
    }

    // Record payment and allocate in a single transaction
    const result = await withTransaction(async (tx) => {
      // 1. Create payment record
      const paymentReceiptNumber = `RCPT-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
      const validDate = parseToValidDate(payment_date);

      const [paymentResult] = await tx.execute(
        `INSERT INTO \`payments\` (\`student_id\`, \`amount\`, \`payment_mode\`, \`payment_date\`, \`notes\`, \`recorded_by\`, \`receipt_number\`)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [student_id, paymentAmount, paymentChannel, validDate, notes || null, recorded_by || 1, paymentReceiptNumber]
      );

      const paymentId = paymentResult.insertId;

      // 2. Allocate payment using FIFO on current tx
      const allocation = await allocatePaymentFIFO({
        studentId: student_id,
        paymentId,
        amount: paymentAmount,
      }, tx);

      // 3. Create receipt entry in DB
      const receiptNumber = `RCP-${String(paymentId).padStart(6, '0')}`;
      await tx.execute(
        `INSERT INTO \`receipts\` (\`payment_id\`, \`receipt_number\`, \`file_path\`)
         VALUES (?, ?, ?)`,
        [paymentId, receiptNumber, null]
      );

      return { paymentId, receiptNumber, allocation };
    });

    // Auto-generate branded PDF receipt file on disk
    generateAndSaveReceipt(result.paymentId).catch((err) => {
      console.error('[recordPayment] Error auto-generating PDF receipt:', err.message);
    });

    // Fetch the created payment with details
    const payment = await db.queryOne(
      `SELECT p.*, r.\`receipt_number\`
       FROM \`payments\` p
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       WHERE p.\`id\` = ?`,
      [result.paymentId]
    );

    return res.status(201).json({
      success: true,
      message: 'Payment recorded and allocated successfully.',
      payment,
      allocation: result.allocation,
    });
  } catch (err) {
    console.error('[paymentController.recordPayment]', err);
    if (err.message.includes('No outstanding fees')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err.message.includes('exceeds total outstanding')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err.message.includes('Payment amount must be greater than 0')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Failed to record payment.' });
  }
}

/**
 * GET /api/payments
 * Get payments with filters
 * Query: student_id, start_date, end_date, class_id, category, page, limit
 */
async function listPayments(req, res) {
  const { student_id, start_date, end_date, class_id, category, page = 1, limit = 25 } = req.query;

  try {
    const conditions = [];
    const values = [];

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

    // Class and category filters require joining students
    let joinClause = '';
    if (class_id || category) {
      joinClause = 'LEFT JOIN `students` s ON s.`id` = p.`student_id`';
      if (class_id) {
        conditions.push('s.`class_id` = ?');
        values.push(class_id);
      }
      if (category) {
        conditions.push('s.`category` = ?');
        values.push(category);
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);
    const offsetNum = Number(offset);

    const countSql = `SELECT COUNT(*) as total FROM \`payments\` p ${joinClause} ${whereClause}`;
    const dataSql = `
      SELECT p.*, r.\`receipt_number\`, s.\`full_name\`, s.\`admission_no\`, s.\`category\`,
             c.\`name\` as class_name
      FROM \`payments\` p
      ${joinClause}
      LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
      LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
      LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
      ${whereClause}
      ORDER BY p.\`created_at\` DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const [countResult, payments] = await Promise.all([
      db.queryOne(countSql, values),
      db.query(dataSql, values),
    ]);

    return res.json({
      success: true,
      payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / Number(limit)),
      },
    });
  } catch (err) {
    console.error('[paymentController.listPayments]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
  }
}

/**
 * GET /api/payments/summary
 * Get collection summaries (daily, weekly, monthly)
 */
async function getPaymentSummary(req, res) {
  const { start_date, end_date } = req.query;

  try {
    const conditions = [];
    const values = [];

    if (start_date) {
      conditions.push('DATE(`payment_date`) >= ?');
      values.push(start_date);
    }
    if (end_date) {
      conditions.push('DATE(`payment_date`) <= ?');
      values.push(end_date);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Daily summary
    const dailySql = `
      SELECT DATE(\`payment_date\`) as date, COUNT(*) as count, SUM(\`amount\`) as total
      FROM \`payments\`
      ${whereClause}
      GROUP BY DATE(\`payment_date\`)
      ORDER BY DATE(\`payment_date\`) DESC
    `;

    // Monthly summary
    const monthlySql = `
      SELECT DATE_FORMAT(\`payment_date\`, '%Y-%m') as month, COUNT(*) as count, SUM(\`amount\`) as total
      FROM \`payments\`
      ${whereClause}
      GROUP BY DATE_FORMAT(\`payment_date\`, '%Y-%m')
      ORDER BY month DESC
    `;

    // Overall total
    const totalSql = `
      SELECT COUNT(*) as count, SUM(\`amount\`) as total
      FROM \`payments\`
      ${whereClause}
    `;

    const [daily, monthly, total] = await Promise.all([
      db.query(dailySql, values),
      db.query(monthlySql, values),
      db.queryOne(totalSql, values),
    ]);

    return res.json({
      success: true,
      daily,
      monthly,
      total: {
        count: total.count,
        amount: total.total || 0,
      },
    });
  } catch (err) {
    console.error('[paymentController.getPaymentSummary]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment summary.' });
  }
}

/**
 * GET /api/payments/:id
 * Get a single payment with allocations
 */
async function getPayment(req, res) {
  const { id } = req.params;

  try {
    const payment = await db.queryOne(
      `SELECT p.*, r.\`receipt_number\`, s.\`full_name\`, s.\`admission_no\`
       FROM \`payments\` p
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
       WHERE p.\`id\` = ?`,
      [id]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // Get allocations
    const allocations = await db.query(
      `SELECT pa.*, mf.\`fee_month\`, mf.\`fee_year\`, mf.\`fee_amount\`
       FROM \`payment_allocations\` pa
       LEFT JOIN \`monthly_fees\` mf ON mf.\`id\` = pa.\`monthly_fee_id\`
       WHERE pa.\`payment_id\` = ?
       ORDER BY pa.\`id\` ASC`,
      [id]
    );

    return res.json({
      success: true,
      payment,
      allocations,
    });
  } catch (err) {
    console.error('[paymentController.getPayment]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment.' });
  }
}

/**
 * PUT /api/payments/:id
 * Edit/Update a recorded payment.
 * Reverts previous allocations, updates student/amount/date/notes, and re-allocates via FIFO.
 */
async function updatePayment(req, res) {
  const { id } = req.params;
  const { student_id, amount, payment_date, notes } = req.body || {};

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });
  }

  try {
    const payment = await db.queryOne('SELECT * FROM `payments` WHERE `id` = ?', [id]);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    const targetStudentId = student_id || payment.student_id;
    const newAmount = Number(amount);

    await withTransaction(async (tx) => {
      // 1. Revert previous allocations on old payment
      const { revertPaymentAllocations } = require('../services/paymentAllocationService');
      await revertPaymentAllocations(id, tx);

      // 2. Update payment row
      await tx.execute(
        `UPDATE \`payments\`
         SET \`student_id\` = ?, \`amount\` = ?, \`payment_date\` = ?, \`notes\` = ?
         WHERE \`id\` = ?`,
        [targetStudentId, newAmount, payment_date || payment.payment_date, notes !== undefined ? notes : payment.notes, id]
      );

      // 3. Re-allocate payment using FIFO
      await allocatePaymentFIFO({
        studentId: targetStudentId,
        paymentId: id,
        amount: newAmount,
      }, tx);
    });

    // 4. Re-generate PDF receipt file
    generateAndSaveReceipt(id).catch((err) => {
      console.error('[updatePayment] PDF regeneration failed:', err);
    });

    const updatedPayment = await db.queryOne(
      `SELECT p.*, r.\`receipt_number\`
       FROM \`payments\` p
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       WHERE p.\`id\` = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Payment updated & re-allocated successfully.',
      payment: updatedPayment,
    });
  } catch (err) {
    console.error('[paymentController.updatePayment]', err);
    return res.status(500).json({ success: false, message: 'Failed to update payment.' });
  }
}

/**
 * DELETE /api/payments/:id
 * Delete a recorded payment and revert all linked allocations, receipts, and student dues.
 */
async function deletePayment(req, res) {
  const { id } = req.params;

  try {
    const payment = await db.queryOne('SELECT * FROM `payments` WHERE `id` = ?', [id]);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    const receipt = await db.queryOne('SELECT * FROM `receipts` WHERE `payment_id` = ?', [id]);

    await withTransaction(async (tx) => {
      // 1. Revert previous allocations on monthly_fees & extra fees
      const { revertPaymentAllocations } = require('../services/paymentAllocationService');
      await revertPaymentAllocations(id, tx);

      // 2. Delete linked receipt row in database
      await tx.execute('DELETE FROM `receipts` WHERE `payment_id` = ?', [id]);

      // 3. Delete payment row in database
      await tx.execute('DELETE FROM `payments` WHERE `id` = ?', [id]);
    });

    // 4. Delete physical PDF receipt file on disk if exists
    if (receipt && receipt.file_path) {
      try {
        const fs = require('fs');
        const path = require('path');
        const fullPath = path.isAbsolute(receipt.file_path)
          ? receipt.file_path
          : path.join(__dirname, '..', '..', receipt.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (fileErr) {
        console.warn('[deletePayment] Could not delete receipt PDF file on disk:', fileErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'Payment and linked receipt deleted successfully. Student dues restored.',
    });
  } catch (err) {
    console.error('[paymentController.deletePayment]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete payment.' });
  }
}

module.exports = {
  recordPayment,
  updatePayment,
  deletePayment,
  listPayments,
  getPaymentSummary,
  getPayment,
};