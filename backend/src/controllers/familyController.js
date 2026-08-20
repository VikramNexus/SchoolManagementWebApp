/**
 * Family Controller — School Management System
 * Multi-Student / Sibling Family Account Management & Concatenation
 */

const db = require('../config/db');
const { withTransaction } = require('../utils/transactionHandler');
const { allocatePaymentFIFO } = require('../services/paymentAllocationService');

/**
 * GET /api/family/search?q=...
 * Search students to link as siblings
 */
async function searchStudentsForFamily(req, res) {
  const { q } = req.query || {};
  if (!q || !q.trim()) {
    return res.json({ success: true, students: [] });
  }

  try {
    const term = `%${q.trim()}%`;
    const sql = `
      SELECT
        s.id,
        s.admission_no,
        s.full_name,
        s.father_name,
        s.mother_name,
        s.parent_name,
        s.phone,
        s.category,
        s.family_id,
        s.monthly_fee_rate,
        c.name as class_name,
        sec.name as section_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      WHERE s.status = 'active'
        AND (s.full_name LIKE ? OR s.admission_no LIKE ? OR s.phone LIKE ? OR s.parent_name LIKE ? OR s.father_name LIKE ?)
      LIMIT 20
    `;

    const students = await db.query(sql, [term, term, term, term, term]);
    return res.json({ success: true, students });
  } catch (err) {
    console.error('[familyController.searchStudentsForFamily]', err);
    return res.status(500).json({ success: false, message: 'Failed to search students.' });
  }
}

/**
 * GET /api/family/by-student/:student_id
 * Get family account & sibling details for a student
 */
async function getFamilyByStudent(req, res) {
  const { student_id } = req.params;

  try {
    const student = await db.queryOne(
      'SELECT id, full_name, admission_no, family_id, father_name, mother_name, parent_name, phone, address FROM students WHERE id = ?',
      [student_id]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    if (!student.family_id) {
      return res.json({
        success: true,
        has_family: false,
        family_id: null,
        siblings: [student],
        total_family_dues: 0,
      });
    }

    // Fetch all siblings in this family
    const siblingsSql = `
      SELECT
        s.id,
        s.admission_no,
        s.full_name,
        s.gender,
        s.category,
        s.father_name,
        s.mother_name,
        s.parent_name,
        s.phone,
        s.monthly_fee_rate,
        s.family_id,
        c.name as class_name,
        sec.name as section_name,
        COALESCE(
          (SELECT SUM(mf.due_amount) FROM monthly_fees mf WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0
        ) as monthly_dues,
        COALESCE(
          (SELECT SUM(saf.amount) FROM student_additional_fees saf WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')), 0
        ) as additional_dues
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      WHERE s.family_id = ? AND s.status = 'active'
      ORDER BY s.id ASC
    `;

    const siblings = await db.query(siblingsSql, [student.family_id]);

    const formattedSiblings = siblings.map(s => ({
      ...s,
      monthly_dues: Number(s.monthly_dues),
      additional_dues: Number(s.additional_dues),
      total_due: Number(s.monthly_dues) + Number(s.additional_dues),
    }));

    const totalFamilyDues = formattedSiblings.reduce((sum, s) => sum + s.total_due, 0);

    return res.json({
      success: true,
      has_family: true,
      family_id: student.family_id,
      siblings_count: formattedSiblings.length,
      siblings: formattedSiblings,
      total_family_dues: totalFamilyDues,
    });
  } catch (err) {
    console.error('[familyController.getFamilyByStudent]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch family details.' });
  }
}

/**
 * POST /api/family/concatenate
 * Link / concatenate two or more existing students into a single Family Account
 * Body: { student_ids: [1, 2, ...], custom_family_id }
 */
async function concatenateStudents(req, res) {
  const { student_ids, custom_family_id } = req.body || {};

  if (!Array.isArray(student_ids) || student_ids.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Please select at least 2 students to link as a family group.',
    });
  }

  try {
    // Generate or use existing family_id
    const existingFamilyStudent = await db.queryOne(
      'SELECT family_id FROM students WHERE id IN (?) AND family_id IS NOT NULL LIMIT 1',
      [student_ids]
    );

    const familyId =
      custom_family_id?.trim() ||
      existingFamilyStudent?.family_id ||
      `FAM-${Date.now().toString().slice(-6)}`;

    // Update all selected students with the unified family_id
    await db.query('UPDATE students SET family_id = ? WHERE id IN (?)', [familyId, student_ids]);

    return res.json({
      success: true,
      message: `Successfully linked ${student_ids.length} students into Family Account (${familyId}).`,
      family_id: familyId,
    });
  } catch (err) {
    console.error('[familyController.concatenateStudents]', err);
    return res.status(500).json({ success: false, message: 'Failed to link students into family.' });
  }
}

/**
 * POST /api/family/unlink
 * Unlink / detach a student from a family group
 * Body: { student_id }
 */
async function unlinkStudent(req, res) {
  const { student_id } = req.body || {};

  if (!student_id) {
    return res.status(400).json({ success: false, message: 'Student ID is required.' });
  }

  try {
    const student = await db.queryOne('SELECT id, family_id FROM students WHERE id = ?', [student_id]);
    if (!student || !student.family_id) {
      return res.status(400).json({ success: false, message: 'Student is not part of a family group.' });
    }

    const familyId = student.family_id;
    await db.query('UPDATE students SET family_id = NULL WHERE id = ?', [student_id]);

    // If only 1 student remains in this family, we can optionally clear their family_id or leave it
    const remaining = await db.query('SELECT id FROM students WHERE family_id = ?', [familyId]);
    if (remaining.length === 1) {
      await db.query('UPDATE students SET family_id = NULL WHERE id = ?', [remaining[0].id]);
    }

    return res.json({
      success: true,
      message: 'Student unlinked from family group successfully.',
    });
  } catch (err) {
    console.error('[familyController.unlinkStudent]', err);
    return res.status(500).json({ success: false, message: 'Failed to unlink student.' });
  }
}

/**
 * POST /api/family/record-payment
 * Record a combined payment for multiple siblings in a family group
 * Body: {
 *   family_id,
 *   payment_mode: 'CASH' | 'IN_ACCOUNT',
 *   payment_date: 'YYYY-MM-DD',
 *   notes: 'Family fee payment',
 *   allocations: [{ student_id: 1, amount: 2000 }, { student_id: 2, amount: 3000 }]
 * }
 */
async function recordFamilyPayment(req, res) {
  const { family_id, payment_mode = 'CASH', payment_date, notes, allocations, recorded_by } = req.body || {};

  if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
    return res.status(400).json({ success: false, message: 'Payment allocations for siblings are required.' });
  }

  const totalAmount = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  if (totalAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Total family payment amount must be greater than 0.' });
  }

  try {
    const receiptNumber = `FAM-${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
    const paymentModeNormalized = payment_mode === 'IN_ACCOUNT' ? 'IN_ACCOUNT' : 'CASH';

    const result = await withTransaction(async (tx) => {
      const paymentsCreated = [];

      for (const item of allocations) {
        const studentAmount = Number(item.amount);
        if (studentAmount <= 0) continue;

        // Insert payment tagged as FAMILY_FEE
        const [payRes] = await tx.execute(
          `INSERT INTO \`payments\` (\`student_id\`, \`family_id\`, \`amount\`, \`payment_mode\`, \`payment_category\`, \`payment_date\`, \`notes\`, \`recorded_by\`, \`receipt_number\`)
           VALUES (?, ?, ?, ?, 'FAMILY_FEE', ?, ?, ?, ?)`,
          [
            item.student_id,
            family_id || null,
            studentAmount,
            paymentModeNormalized,
            payment_date ? new Date(payment_date) : new Date(),
            notes ? `[Family Receipt: ${receiptNumber}] ${notes}` : `[Family Receipt: ${receiptNumber}] Combined family fee payment`,
            recorded_by || 1,
            receiptNumber,
          ]
        );

        const paymentId = payRes.insertId;

        // Allocate FIFO for this student
        const studentAllocations = await allocatePaymentFIFO(
          { studentId: item.student_id, paymentId, amount: studentAmount },
          tx
        );

        paymentsCreated.push({
          student_id: item.student_id,
          payment_id: paymentId,
          amount: studentAmount,
          allocations: studentAllocations,
        });
      }

      return { receiptNumber, totalAmount, paymentsCreated };
    });

    return res.json({
      success: true,
      message: `Family payment of ₹${totalAmount.toLocaleString('en-IN')} recorded successfully.`,
      receipt_number: result.receiptNumber,
      total_amount: result.totalAmount,
      payments: result.paymentsCreated,
    });
  } catch (err) {
    console.error('[familyController.recordFamilyPayment]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to record family payment.' });
  }
}

module.exports = {
  searchStudentsForFamily,
  getFamilyByStudent,
  concatenateStudents,
  unlinkStudent,
  recordFamilyPayment,
};
