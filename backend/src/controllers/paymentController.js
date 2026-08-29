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
  const { student_id, amount, payment_mode, payment_category, payment_date, notes, recorded_by } = req.body || {};

  // Validation
  if (!student_id) {
    return res.status(400).json({ success: false, message: 'Student ID is required.' });
  }
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });
  }

  const paymentAmount = Number(amount);
  const paymentChannel = (payment_mode === 'IN_ACCOUNT' || payment_mode === 'in acc.') ? 'IN_ACCOUNT' : 'CASH';
  const category = payment_category || (notes && notes.toLowerCase().includes('admission') ? 'ADMISSION_CHARGE' : 'MONTHLY_TUITION');
  const prefix = category === 'ADMISSION_CHARGE' ? 'ADM' : 'RCP';

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
      const paymentReceiptNumber = `${prefix}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
      const validDate = parseToValidDate(payment_date);

      const [paymentResult] = await tx.execute(
        `INSERT INTO \`payments\` (\`student_id\`, \`amount\`, \`payment_mode\`, \`payment_category\`, \`payment_date\`, \`notes\`, \`recorded_by\`, \`receipt_number\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [student_id, paymentAmount, paymentChannel, category, validDate, notes || null, recorded_by || 1, paymentReceiptNumber]
      );

      const paymentId = paymentResult.insertId;

      // 2. Allocate payment using FIFO on current tx
      const allocation = await allocatePaymentFIFO({
        studentId: student_id,
        paymentId,
        amount: paymentAmount,
      }, tx);

      // 3. Create receipt entry in DB
      const receiptNumber = `${prefix}-${String(paymentId).padStart(6, '0')}`;
      await tx.execute(
        `INSERT INTO \`receipts\` (\`payment_id\`, \`receipt_number\`, \`file_path\`, \`generated_at\`)
         VALUES (?, ?, ?, NOW())`,
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
  const { student_id, search, start_date, end_date, class_id, category, page = 1, limit = 20, sort_by = 'payment_date', sort_order = 'desc' } = req.query;

  try {
    const conditions = [];
    const values = [];

    if (student_id) {
      conditions.push('p.`student_id` = ?');
      values.push(student_id);
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(s.`full_name` LIKE ? OR s.`admission_no` LIKE ? OR r.`receipt_number` LIKE ? OR p.`receipt_number` LIKE ? OR p.`notes` LIKE ?)');
      values.push(term, term, term, term, term);
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
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const offsetNum = (pageNum - 1) * limitNum;

    const allowedSorts = {
      payment_date: 'p.`payment_date`',
      amount: 'p.`amount`',
      full_name: 's.`full_name`',
      created_at: 'p.`created_at`',
      receipt_number: 'COALESCE(r.`receipt_number`, p.`receipt_number`)',
    };
    const sortCol = allowedSorts[sort_by] || 'p.`payment_date`';
    const sortDir = sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const countSql = `
      SELECT COUNT(*) as total
      FROM \`payments\` p
      LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
      LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
      LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
      ${whereClause}
    `;

    const dataSql = `
      SELECT p.*,
             COALESCE(r.\`receipt_number\`, p.\`receipt_number\`, CONCAT('RCP-', LPAD(p.\`id\`, 6, '0'))) as receipt_number,
             s.\`full_name\`, s.\`admission_no\`, s.\`phone\`, s.\`whatsapp_number\`, s.\`category\`,
             c.\`name\` as class_name, sec.\`name\` as section_name
      FROM \`payments\` p
      LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
      LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
      LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
      LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}, p.\`id\` DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const [countResult, payments] = await Promise.all([
      db.queryOne(countSql, values),
      db.query(dataSql, values),
    ]);

    return res.json({
      success: true,
      payments: payments.map(p => ({
        ...p,
        amount: Number(p.amount || 0),
        full_name: p.full_name || '—',
        student_name: p.full_name || '—',
        admission_no: p.admission_no || '—',
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limitNum),
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
      `SELECT p.*,
              COALESCE(r.\`receipt_number\`, p.\`receipt_number\`, CONCAT('RCP-', LPAD(p.\`id\`, 6, '0'))) as receipt_number,
              s.\`full_name\`, s.\`admission_no\`, s.\`phone\`, s.\`whatsapp_number\`, s.\`category\`,
              c.\`name\` as class_name, sec.\`name\` as section_name
       FROM \`payments\` p
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       WHERE p.\`id\` = ?`,
      [id]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // Get allocations with both monthly fees and extra fees details
    const allocations = await db.query(
      `SELECT pa.*, mf.\`fee_month\`, mf.\`fee_year\`, mf.\`fee_amount\`,
              saf.\`description\` as additional_fee_description, saf.\`amount\` as additional_fee_amount
       FROM \`payment_allocations\` pa
       LEFT JOIN \`monthly_fees\` mf ON mf.\`id\` = pa.\`monthly_fee_id\`
       LEFT JOIN \`student_additional_fees\` saf ON saf.\`id\` = pa.\`additional_fee_id\`
       WHERE pa.\`payment_id\` = ?
       ORDER BY pa.\`id\` ASC`,
      [id]
    );

    return res.json({
      success: true,
      payment: {
        ...payment,
        amount: Number(payment.amount || 0),
        full_name: payment.full_name || '—',
        student_name: payment.full_name || '—',
        admission_no: payment.admission_no || '—',
      },
      allocations: allocations.map(a => ({
        ...a,
        allocated_amount: Number(a.allocated_amount || 0),
        fee_amount: Number(a.fee_amount || a.additional_fee_amount || a.allocated_amount || 0),
        description: a.additional_fee_description || null,
      })),
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

/**
 * GET /api/payments/admissions
 * List all payments collected during student / family admissions
 */
async function listAdmissionPayments(req, res) {
  const { page = 1, limit = 20, search, class_id, start_date, end_date } = req.query;

  try {
    const conditions = ["(p.`payment_category` = 'ADMISSION_CHARGE' OR p.`notes` LIKE '%Admission%' OR p.`notes` LIKE '%Enrollment%')"];
    const values = [];

    if (search) {
      conditions.push('(s.`full_name` LIKE ? OR s.`admission_no` LIKE ? OR r.`receipt_number` LIKE ? OR s.`phone` LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term, term);
    }

    if (class_id) {
      conditions.push('s.`class_id` = ?');
      values.push(class_id);
    }

    if (start_date) {
      conditions.push('DATE(p.`payment_date`) >= ?');
      values.push(start_date);
    }

    if (end_date) {
      conditions.push('DATE(p.`payment_date`) <= ?');
      values.push(end_date);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const offsetNum = (pageNum - 1) * limitNum;

    const countSql = `SELECT COUNT(*) as total FROM \`payments\` p LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\` LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\` ${whereClause}`;
    const dataSql = `
      SELECT p.*, r.\`receipt_number\`, s.\`full_name\`, s.\`admission_no\`, s.\`phone\`, s.\`whatsapp_number\`, s.\`category\`,
             c.\`name\` as class_name, sec.\`name\` as section_name,
             COALESCE((
               SELECT SUM(saf.amount) FROM student_additional_fees saf WHERE saf.student_id = s.id
             ), 0) + COALESCE((
               SELECT SUM(mf.fee_amount) FROM monthly_fees mf WHERE mf.student_id = s.id AND mf.created_at <= p.created_at
             ), 0) as total_assessed,
             COALESCE((
               SELECT SUM(GREATEST(0, saf.amount - saf.paid_amount - saf.discount_amount)) FROM student_additional_fees saf WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')
             ), 0) + COALESCE((
               SELECT SUM(mf.due_amount) FROM monthly_fees mf WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')
             ), 0) as remaining_dues
      FROM \`payments\` p
      LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
      LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
      LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
      LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
      ${whereClause}
      ORDER BY p.\`id\` DESC
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
        page: pageNum,
        limit: limitNum,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limitNum),
      },
    });
  } catch (err) {
    console.error('[paymentController.listAdmissionPayments]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch admission payments.' });
  }
}

module.exports = {
  recordPayment,
  updatePayment,
  deletePayment,
  listPayments,
  listAdmissionPayments,
  getPaymentSummary,
  getPayment,
};