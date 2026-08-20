/**
 * Admission Controller — School Management System
 * Comprehensive Admission Desk, Itemized Billing, Advance Month Allocation & Sibling Linking
 */

const db = require('../config/db');
const { withTransaction } = require('../utils/transactionHandler');
const { allocatePaymentFIFO } = require('../services/paymentAllocationService');

/**
 * POST /api/admissions/enroll
 * Comprehensive student enrollment with itemized admission charges & advance fee
 */
async function enrollStudent(req, res) {
  const {
    // Demographics
    admission_no,
    full_name,
    gender = 'male',
    class_id,
    section_id,
    category = 'day_scholar',
    father_name,
    mother_name,
    parent_name,
    phone,
    whatsapp_number,
    address,
    admission_date,
    monthly_fee_rate,

    // Sibling / Family linking
    sibling_student_id,
    custom_family_id,

    // Billing Breakdown
    admission_fee_amount = 0,
    security_deposit_amount = 0,
    custom_expenses = [], // [{ description: 'Uniform', amount: 1500 }]

    // 1-Month Advance Fee
    include_advance_month = true,
    advance_fee_month, // 1-12
    advance_fee_year,

    // Payment Collection
    collect_payment = true,
    paid_amount = 0,
    payment_mode = 'CASH',
    payment_notes = '',
    recorded_by = 1,
  } = req.body || {};

  // 1. Validation
  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ success: false, message: 'Student full name is required.' });
  }
  if (!class_id) {
    return res.status(400).json({ success: false, message: 'Class is required.' });
  }

  // Monthly rate
  let rate = Number(monthly_fee_rate);
  if (isNaN(rate) || rate <= 0) {
    rate = category === 'hosteller' ? 5000 : 3000;
  }

  const effectiveFather = father_name?.trim() || parent_name?.trim() || null;
  const effectiveMother = mother_name?.trim() || null;
  const effectiveParent = effectiveFather || effectiveMother || null;
  const effectiveDate = admission_date ? new Date(admission_date) : new Date();

  // Advance Month resolution
  const now = new Date();
  const targetMonth = advance_fee_month ? Number(advance_fee_month) : now.getMonth() + 1;
  const targetYear = advance_fee_year ? Number(advance_fee_year) : now.getFullYear();

  try {
    // Check class exists
    const classRow = await db.queryOne('SELECT id, name FROM classes WHERE id = ?', [class_id]);
    if (!classRow) {
      return res.status(400).json({ success: false, message: 'Selected class does not exist.' });
    }

    // Resolve Family ID if sibling selected
    let resolvedFamilyId = custom_family_id?.trim() || null;
    if (sibling_student_id) {
      const sibling = await db.queryOne('SELECT id, family_id FROM students WHERE id = ?', [sibling_student_id]);
      if (sibling) {
        if (sibling.family_id) {
          resolvedFamilyId = sibling.family_id;
        } else {
          // Generate new family_id for both
          resolvedFamilyId = `FAM-${Date.now().toString().slice(-6)}`;
          await db.query('UPDATE students SET family_id = ? WHERE id = ?', [resolvedFamilyId, sibling.id]);
        }
      }
    }

    // Auto-generate admission_no if blank
    let finalAdmNo = admission_no?.trim();
    if (!finalAdmNo) {
      const countRes = await db.queryOne('SELECT COUNT(*) as cnt FROM students');
      finalAdmNo = `ADM-${targetYear}-${String(countRes.cnt + 1).padStart(4, '0')}`;
    }

    // Check duplicate admission_no
    const dupAdm = await db.queryOne('SELECT id FROM students WHERE admission_no = ?', [finalAdmNo]);
    if (dupAdm) {
      return res.status(400).json({
        success: false,
        message: `Admission number "${finalAdmNo}" is already assigned to another student.`,
      });
    }

    // Look up fee type IDs
    const feeTypes = await db.query('SELECT id, name FROM fee_types');
    const admissionFeeTypeId = feeTypes.find(f => f.name.toLowerCase().includes('admission'))?.id || 1;
    const securityDepositTypeId = feeTypes.find(f => f.name.toLowerCase().includes('security'))?.id || null;

    // Run entire enrollment in an atomic database transaction
    const enrollmentResult = await withTransaction(async (tx) => {
      // 1. Insert Student Record
      const [stdResult] = await tx.execute(
        `INSERT INTO \`students\` (
          \`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`section_id\`, \`category\`,
          \`parent_name\`, \`family_id\`, \`father_name\`, \`mother_name\`, \`phone\`, \`whatsapp_number\`,
          \`address\`, \`admission_date\`, \`monthly_fee_rate\`, \`status\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          finalAdmNo,
          full_name.trim(),
          gender || 'male',
          class_id,
          section_id || null,
          category,
          effectiveParent,
          resolvedFamilyId,
          effectiveFather,
          effectiveMother,
          phone?.trim() || null,
          whatsapp_number?.trim() || phone?.trim() || null,
          address?.trim() || null,
          effectiveDate,
          rate,
        ]
      );

      const studentId = stdResult.insertId;

      // 2. Generate 1-Month Advance Fee in monthly_fees
      let advanceMonthlyFeeId = null;
      if (include_advance_month) {
        const [mfRes] = await tx.execute(
          `INSERT INTO \`monthly_fees\` (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
           VALUES (?, ?, ?, ?, 0, ?, 'DUE')`,
          [studentId, targetMonth, targetYear, rate, rate]
        );
        advanceMonthlyFeeId = mfRes.insertId;
      }

      // 3. Insert Admission Charge if > 0
      const parsedAdmissionFee = Number(admission_fee_amount || 0);
      if (parsedAdmissionFee > 0) {
        await tx.execute(
          `INSERT INTO \`student_additional_fees\` (\`student_id\`, \`fee_type_id\`, \`description\`, \`amount\`, \`status\`, \`due_date\`)
           VALUES (?, ?, 'Admission Charge', ?, 'DUE', ?)`,
          [studentId, admissionFeeTypeId, parsedAdmissionFee, effectiveDate]
        );
      }

      // 4. Insert Security Deposit if > 0
      const parsedSecurityDeposit = Number(security_deposit_amount || 0);
      if (parsedSecurityDeposit > 0) {
        await tx.execute(
          `INSERT INTO \`student_additional_fees\` (\`student_id\`, \`fee_type_id\`, \`description\`, \`amount\`, \`status\`, \`due_date\`)
           VALUES (?, ?, 'Security Deposit / Caution Money (Refundable)', ?, 'DUE', ?)`,
          [studentId, securityDepositTypeId || admissionFeeTypeId, parsedSecurityDeposit, effectiveDate]
        );
      }

      // 5. Insert Custom Expenses
      if (Array.isArray(custom_expenses)) {
        for (const item of custom_expenses) {
          const itemAmt = Number(item.amount || 0);
          if (itemAmt > 0 && item.description?.trim()) {
            await tx.execute(
              `INSERT INTO \`student_additional_fees\` (\`student_id\`, \`description\`, \`amount\`, \`status\`, \`due_date\`)
               VALUES (?, ?, ?, 'DUE', ?)`,
              [studentId, item.description.trim(), itemAmt, effectiveDate]
            );
          }
        }
      }

      // 6. Record Immediate Payment if collected
      let paymentRecord = null;
      const parsedPaidAmount = Number(paid_amount || 0);
      if (collect_payment && parsedPaidAmount > 0) {
        const receiptNumber = `ADM-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
        const paymentChannel = payment_mode === 'IN_ACCOUNT' ? 'IN_ACCOUNT' : 'CASH';

        const [payRes] = await tx.execute(
          `INSERT INTO \`payments\` (\`student_id\`, \`family_id\`, \`amount\`, \`payment_mode\`, \`payment_category\`, \`payment_date\`, \`notes\`, \`recorded_by\`, \`receipt_number\`)
           VALUES (?, ?, ?, ?, 'ADMISSION_CHARGE', ?, ?, ?, ?)`,
          [
            studentId,
            resolvedFamilyId,
            parsedPaidAmount,
            paymentChannel,
            effectiveDate,
            payment_notes ? `[Admission Collection] ${payment_notes}` : '[Admission Collection] Initial admission & advance fee payment',
            recorded_by || 1,
            receiptNumber,
          ]
        );

        const paymentId = payRes.insertId;

        // Allocate FIFO across advance monthly fee and admission charges
        const allocations = await allocatePaymentFIFO(
          { studentId, paymentId, amount: parsedPaidAmount },
          tx
        );

        paymentRecord = {
          payment_id: paymentId,
          receipt_number: receiptNumber,
          amount: parsedPaidAmount,
          payment_mode: paymentChannel,
          allocations,
        };
      }

      return {
        student_id: studentId,
        admission_no: finalAdmNo,
        family_id: resolvedFamilyId,
        payment: paymentRecord,
      };
    });

    return res.status(201).json({
      success: true,
      message: `Student "${full_name}" admitted successfully with Admission No. ${enrollmentResult.admission_no}!`,
      student_id: enrollmentResult.student_id,
      admission_no: enrollmentResult.admission_no,
      family_id: enrollmentResult.family_id,
      payment: enrollmentResult.payment,
    });
  } catch (err) {
    console.error('[admissionController.enrollStudent]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to complete student admission.' });
  }
}

/**
 * GET /api/admissions/stats
 * Overview KPIs for Admissions Desk
 */
async function getAdmissionStats(req, res) {
  try {
    const stats = await db.queryOne(`
      SELECT
        COUNT(DISTINCT s.id) as total_admissions,
        COALESCE(
          (SELECT SUM(p.amount) FROM payments p JOIN students s2 ON s2.id = p.student_id WHERE p.payment_category = 'ADMISSION_CHARGE' AND s2.status = 'active'), 0
        ) as admission_revenue,
        COALESCE(
          (SELECT SUM(saf.amount) FROM student_additional_fees saf JOIN students s3 ON s3.id = saf.student_id WHERE saf.description LIKE '%Security%' AND s3.status = 'active'), 0
        ) as security_deposit_total,
        COALESCE(
          (SELECT SUM(mf.paid_amount) FROM monthly_fees mf JOIN payments p2 ON p2.student_id = mf.student_id WHERE p2.payment_category = 'ADMISSION_CHARGE'), 0
        ) as advance_fees_collected
      FROM students s
      WHERE s.status = 'active'
    `);

    return res.json({
      success: true,
      stats: {
        total_admissions: Number(stats?.total_admissions || 0),
        admission_revenue: Number(stats?.admission_revenue || 0),
        security_deposit_total: Number(stats?.security_deposit_total || 0),
        advance_fees_collected: Number(stats?.advance_fees_collected || 0),
      },
    });
  } catch (err) {
    console.error('[admissionController.getAdmissionStats]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch admission statistics.' });
  }
}

/**
 * GET /api/admissions/list
 * List admitted students with charge summaries
 */
async function listAdmissions(req, res) {
  const { search, class_id, page = 1, limit = 50 } = req.query || {};

  try {
    const conditions = ["s.status = 'active'"];
    const values = [];

    if (search) {
      conditions.push('(s.admission_no LIKE ? OR s.full_name LIKE ? OR s.phone LIKE ? OR s.father_name LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term, term);
    }
    if (class_id) {
      conditions.push('s.class_id = ?');
      values.push(Number(class_id));
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const numLimit = Math.max(1, Number(limit) || 50);
    const numPage = Math.max(1, Number(page) || 1);
    const numOffset = (numPage - 1) * numLimit;

    const sql = `
      SELECT
        s.id,
        s.admission_no,
        s.full_name,
        s.gender,
        s.category,
        s.father_name,
        s.mother_name,
        s.phone,
        s.admission_date,
        s.monthly_fee_rate,
        s.family_id,
        c.name as class_name,
        sec.name as section_name,
        COALESCE(
          (SELECT SUM(p.amount) FROM payments p WHERE p.student_id = s.id AND p.payment_category = 'ADMISSION_CHARGE'), 0
        ) as admission_paid_amount,
        COALESCE(
          (SELECT p.receipt_number FROM payments p WHERE p.student_id = s.id AND p.payment_category = 'ADMISSION_CHARGE' ORDER BY p.id DESC LIMIT 1), NULL
        ) as admission_receipt_no
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      ${whereClause}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `SELECT COUNT(*) as total FROM students s ${whereClause}`;

    const [admissions, countRes] = await Promise.all([
      db.query(sql, [...values, numLimit, numOffset]),
      db.queryOne(countSql, values),
    ]);

    return res.json({
      success: true,
      admissions: admissions.map(a => ({
        ...a,
        monthly_fee_rate: Number(a.monthly_fee_rate),
        admission_paid_amount: Number(a.admission_paid_amount),
      })),
      pagination: {
        page: numPage,
        limit: numLimit,
        total: countRes.total,
        totalPages: Math.ceil(countRes.total / numLimit),
      },
    });
  } catch (err) {
    console.error('[admissionController.listAdmissions]', err);
    return res.status(500).json({ success: false, message: 'Failed to list admissions.' });
  }
}

/**
 * POST /api/admissions/send-whatsapp/:studentId
 * Send official Admission Confirmation and Fee Summary via WhatsApp in background
 */
async function sendAdmissionWhatsApp(req, res) {
  const { studentId } = req.params;

  try {
    const student = await db.queryOne(
      `SELECT s.*, c.\`name\` as class_name, sec.\`name\` as section_name
       FROM \`students\` s
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       WHERE s.\`id\` = ?`,
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

    // Get admission initial payment
    const initialPayment = await db.queryOne(
      `SELECT * FROM \`payments\` WHERE \`student_id\` = ? AND (\`notes\` LIKE '%Admission%' OR \`notes\` LIKE '%Enrollment%') ORDER BY \`id\` ASC LIMIT 1`,
      [studentId]
    );

    const formattedDate = new Date(student.admission_date || new Date()).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const paidStr = initialPayment ? `₹${Number(initialPayment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Fees Recorded';
    const monthlyRateStr = `₹${Number(student.monthly_fee_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / month`;

    const messageText = 
`🎓 *${(school.school_name || 'ARYAVART PUBLIC SCHOOL').toUpperCase()}*
*ADMISSION CONFIRMATION & ENROLLMENT RECEIPT*
━━━━━━━━━━━━━━━━━━━━
Dear Parent / Guardian,
Congratulations! Admission is officially confirmed for your ward:

👤 *Student Name:* ${student.full_name}
🆔 *Admission No:* ${student.admission_no || 'N/A'}
🏫 *Class Assigned:* ${student.class_name || 'N/A'}${student.section_name ? ` (${student.section_name})` : ''}
📅 *Admission Date:* ${formattedDate}
📊 *Category:* ${(student.category || 'day_scholar').replace('_', ' ').toUpperCase()}

💰 *Initial Payment Collected:* ${paidStr}
📌 *Monthly Tuition Rate:* ${monthlyRateStr}
━━━━━━━━━━━━━━━━━━━━
Welcome to the *${school.school_name}* family!
For any queries, contact administration at ${school.phone || 'school desk'}.`;

    const { sendWhatsApp } = require('../services/whatsappService');
    await sendWhatsApp(recipientPhone, messageText, {
      student_id: student.id,
      payment_id: initialPayment ? initialPayment.id : null,
    });

    return res.json({
      success: true,
      message: `Admission WhatsApp confirmation sent to ${recipientPhone}`,
      recipient: recipientPhone,
    });
  } catch (err) {
    console.error('[admissionController.sendAdmissionWhatsApp]', err);
    return res.status(500).json({ success: false, message: 'Failed to send WhatsApp admission receipt: ' + err.message });
  }
}

module.exports = {
  enrollStudent,
  getAdmissionStats,
  listAdmissions,
  sendAdmissionWhatsApp,
};
