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

      let siblingIdx = 0;
      for (const item of allocations) {
        const studentAmount = Number(item.amount);
        if (studentAmount <= 0) continue;
        siblingIdx += 1;
        const individualReceiptNumber = `${receiptNumber}-${siblingIdx}`;

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
            individualReceiptNumber,
          ]
        );

        const paymentId = payRes.insertId;

        // Also insert into official receipts table
        await tx.execute(
          `INSERT INTO \`receipts\` (\`payment_id\`, \`receipt_number\`, \`file_path\`)
           VALUES (?, ?, ?)`,
          [paymentId, individualReceiptNumber, `uploads/receipts/receipt_${individualReceiptNumber}.pdf`]
        );

        // Allocate FIFO for this student
        const studentAllocations = await allocatePaymentFIFO(
          { studentId: item.student_id, paymentId, amount: studentAmount },
          tx
        );

        paymentsCreated.push({
          student_id: item.student_id,
          payment_id: paymentId,
          receipt_number: individualReceiptNumber,
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

/**
 * GET /api/family/by-student/:student_id/ledger
 * Return consolidated month-by-month family fee schedule aggregating all siblings
 */
async function getFamilyMonthlyLedger(req, res) {
  const { student_id } = req.params;

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  try {
    const student = await db.queryOne(
      'SELECT id, full_name, admission_no, family_id, monthly_fee_rate, class_id FROM students WHERE id = ?',
      [student_id]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

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
        COALESCE(s.monthly_fee_rate, 0) as monthly_fee_rate,
        s.family_id,
        c.name as class_name,
        sec.name as section_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      WHERE (s.family_id = ? AND ? IS NOT NULL AND s.status != 'deleted')
         OR s.id = ?
      ORDER BY s.id ASC
    `;
    const siblings = await db.query(siblingsSql, [student.family_id, student.family_id, student.id]);
    const siblingIds = siblings.map(s => s.id);

    // Calculate total family monthly rate (e.g. 5000 + 4000 + 3000 = 12000)
    const totalFamilyMonthlyRate = siblings.reduce((sum, s) => sum + Number(s.monthly_fee_rate || 0), 0);

    // Fetch actual monthly fees for all siblings
    const monthlyFees = siblingIds.length > 0
      ? await db.query(
          `SELECT mf.*,
                  COALESCE(
                    (SELECT SUM(pa.allocated_amount) FROM payment_allocations pa WHERE pa.monthly_fee_id = mf.id),
                    mf.paid_amount,
                    0
                  ) as paid_amount,
                  s.full_name, s.admission_no, c.name as class_name
           FROM monthly_fees mf
           JOIN students s ON s.id = mf.student_id
           LEFT JOIN classes c ON c.id = s.class_id
           WHERE mf.student_id IN (?)
           ORDER BY mf.fee_year ASC, mf.fee_month ASC`,
          [siblingIds]
        )
      : [];

    // Fetch payment allocations / installments for all siblings in the family
    const feeIds = monthlyFees.map(mf => mf.id).filter(Boolean);
    const allocations = feeIds.length > 0
      ? await db.query(
          `SELECT pa.id as allocation_id, pa.monthly_fee_id, pa.allocated_amount,
                  p.id as payment_id, p.payment_date, p.payment_mode, p.receipt_number, p.notes,
                  s.full_name as student_name
           FROM payment_allocations pa
           JOIN payments p ON p.id = pa.payment_id
           JOIN students s ON s.id = p.student_id
           WHERE pa.monthly_fee_id IN (?)
           ORDER BY p.payment_date ASC, p.id ASC`,
          [feeIds]
        )
      : [];

    // Fetch any additional charges / other charges for all siblings
    const extraCharges = siblingIds.length > 0
      ? await db.query(
          `SELECT * FROM student_additional_fees WHERE student_id IN (?)`,
          [siblingIds]
        )
      : [];

    // Distinct assigned months across all siblings
    const assignedMonthKeys = new Set();
    monthlyFees.forEach(mf => {
      if (mf.fee_month && mf.fee_year) {
        assignedMonthKeys.add(`${mf.fee_year}-${mf.fee_month}`);
      }
    });

    const sortedAssignedMonths = Array.from(assignedMonthKeys).map(key => {
      const [y, m] = key.split('-').map(Number);
      return { fee_year: y, fee_month: m };
    }).sort((a, b) => {
      if (a.fee_year !== b.fee_year) return a.fee_year - b.fee_year;
      return a.fee_month - b.fee_month;
    });

    const monthByMonthLedger = sortedAssignedMonths.map(({ fee_month: monthNum, fee_year: year }) => {
      const monthName = MONTH_NAMES[monthNum - 1] || `Month ${monthNum}`;

      // Sibling fee breakdown for this month
      const siblingFeeRecords = [];
      const siblingBreakdown = siblings.map(sib => {
        const feeRecord = monthlyFees.find(
          mf => mf.student_id === sib.id && mf.fee_month === monthNum && mf.fee_year === year
        );
        if (feeRecord) siblingFeeRecords.push(feeRecord);

        const feeAmount = feeRecord ? Number(feeRecord.fee_amount) : Number(sib.monthly_fee_rate || 0);
        const paidAmount = feeRecord ? Number(feeRecord.paid_amount || 0) : 0;
        const dueAmount = feeRecord
          ? (feeRecord.due_amount !== undefined ? Number(feeRecord.due_amount) : Math.max(0, feeAmount - paidAmount))
          : feeAmount;
        const status = feeRecord ? feeRecord.status : (dueAmount === 0 ? 'PAID' : 'DUE');

        return {
          student_id: sib.id,
          student_name: sib.full_name,
          admission_no: sib.admission_no,
          class_name: sib.class_name || 'Class —',
          monthly_rate: Number(sib.monthly_fee_rate || 0),
          fee_record_id: feeRecord ? feeRecord.id : null,
          fee_amount: feeAmount,
          paid_amount: paidAmount,
          due_amount: dueAmount,
          status,
        };
      });

      const totalFamilyFee = siblingBreakdown.reduce((sum, item) => sum + item.fee_amount, 0);
      const totalFamilyPaid = siblingBreakdown.reduce((sum, item) => sum + item.paid_amount, 0);
      const totalFamilyDue = siblingBreakdown.reduce((sum, item) => sum + item.due_amount, 0);

      // Other charges for siblings in this month (exclude one-time admission/security/accessories)
      const monthExtraCharges = extraCharges.filter(ec => {
        const desc = (ec.description || '').toLowerCase();
        if (desc.includes('admission') || desc.includes('security') || desc.includes('caution') || desc.includes('tie') || desc.includes('belt') || desc.includes('uniform')) {
          return false;
        }
        if (ec.fee_month === monthNum && ec.fee_year === year) return true;
        if (!ec.fee_month && ec.due_date) {
          const d = new Date(ec.due_date);
          return d.getMonth() + 1 === monthNum && d.getFullYear() === year;
        }
        return false;
      });
      const totalOtherCharges = monthExtraCharges.reduce((sum, ec) => sum + Number(ec.amount || 0), 0);

      // Installments / payment receipts for this month
      const monthFeeIds = siblingFeeRecords.map(fr => fr.id);
      const monthAllocations = allocations.filter(a => monthFeeIds.includes(a.monthly_fee_id));
      const monthInstallments = monthAllocations.map(a => ({
        id: a.payment_id,
        receipt_number: a.receipt_number || `RCP-${a.payment_id}`,
        payment_date: a.payment_date,
        payment_mode: a.payment_mode,
        allocated_amount: a.allocated_amount,
        amount: a.allocated_amount,
        notes: a.notes,
        student_name: a.student_name,
      }));

      // Dominant payment date & mode
      const latestPaymentDate = monthInstallments.length > 0
        ? monthInstallments[monthInstallments.length - 1].payment_date
        : null;
      const dominantPaymentMode = monthInstallments.length > 0
        ? monthInstallments[0].payment_mode
        : 'CASH';

      let familyStatus = 'DUE';
      if (totalFamilyDue === 0 && (totalFamilyFee + totalOtherCharges) > 0) {
        familyStatus = 'PAID';
      } else if (totalFamilyPaid > 0) {
        familyStatus = 'PARTIAL';
      }

      return {
        id: `fam-m-${monthNum}-${year}`,
        fee_month: monthNum,
        fee_year: year,
        month_name: monthName,
        month_label: `${monthName} ${year}`,
        fee_amount: totalFamilyFee, // Combined Monthly Fee (e.g. 12000)
        other_charges: totalOtherCharges,
        paid_amount: totalFamilyPaid,
        due_amount: totalFamilyDue,
        total_family_fee: totalFamilyFee,
        total_family_paid: totalFamilyPaid,
        total_family_due: totalFamilyDue,
        family_status: familyStatus,
        status: familyStatus,
        payment_date: latestPaymentDate,
        payment_mode: dominantPaymentMode,
        actual_payment_date: latestPaymentDate,
        actual_payment_mode: dominantPaymentMode,
        installments: monthInstallments,
        sibling_breakdown: siblingBreakdown,
      };
    });

    const totalFamilyPaidAll = monthByMonthLedger.reduce((sum, m) => sum + m.total_family_paid, 0);
    const totalFamilyDueAll = monthByMonthLedger.reduce((sum, m) => sum + m.total_family_due, 0);
    const totalFamilyAssessed = monthByMonthLedger.reduce((sum, m) => sum + m.total_family_fee + m.other_charges, 0);
    const totalFamilyOpeningDues = siblings.reduce((sum, s) => sum + Number(s.opening_dues || 0), 0);

    return res.json({
      success: true,
      has_family: Boolean(student.family_id && siblings.length > 1),
      family_id: student.family_id,
      siblings_count: siblings.length,
      siblings: siblings.map(s => ({
        ...s,
        monthly_fee_rate: Number(s.monthly_fee_rate || 0),
        opening_dues: Number(s.opening_dues || 0),
      })),
      total_family_monthly_rate: totalFamilyMonthlyRate,
      total_family_opening_dues: totalFamilyOpeningDues,
      total_annual_family_fee: totalFamilyMonthlyRate * 12,
      summary: {
        total_assessed: totalFamilyAssessed,
        total_paid: totalFamilyPaidAll,
        total_due: totalFamilyDueAll,
      },
      ledger: monthByMonthLedger,
      monthly_fees: monthByMonthLedger, // Formatted for FeeLedgerTable
    });
  } catch (err) {
    console.error('[familyController.getFamilyMonthlyLedger]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch family ledger.' });
  }
}

/**
 * POST /api/family/assign-month
 * Assign next month fee records for all siblings in a family group
 * Body: { student_id, fee_month, fee_year }
 */
async function assignFamilyMonth(req, res) {
  const { student_id, fee_month, fee_year } = req.body || {};

  const m = Number(fee_month);
  const y = Number(fee_year);

  if (!student_id || !m || !y) {
    return res.status(400).json({ success: false, message: 'student_id, fee_month, and fee_year are required.' });
  }

  try {
    const student = await db.queryOne('SELECT id, family_id, category, monthly_fee_rate FROM students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    let siblingIds = [student.id];
    if (student.family_id) {
      const sibs = await db.query('SELECT id FROM students WHERE family_id = ? AND status != "deleted"', [student.family_id]);
      if (sibs.length > 0) siblingIds = sibs.map(s => s.id);
    }

    let newlyAssigned = 0;
    for (const sibId of siblingIds) {
      const sib = await db.queryOne('SELECT id, category, monthly_fee_rate FROM students WHERE id = ?', [sibId]);
      const existing = await db.queryOne(
        'SELECT id FROM monthly_fees WHERE student_id = ? AND fee_month = ? AND fee_year = ?',
        [sibId, m, y]
      );
      if (!existing) {
        let rate = Number(sib?.monthly_fee_rate || 0);
        if (isNaN(rate) || rate <= 0) {
          rate = sib?.category === 'hosteller' ? 5000 : 3000;
        }
        await db.query(
          'INSERT INTO monthly_fees (student_id, fee_month, fee_year, fee_amount, due_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
          [sibId, m, y, rate, rate, rate === 0 ? 'PAID' : 'DUE']
        );
        newlyAssigned++;
      }
    }

    return res.json({
      success: true,
      message: newlyAssigned > 0
        ? `Month fee (${m}/${y}) assigned for ${siblingIds.length} family member(s).`
        : `Month fee (${m}/${y}) was already assigned for family members.`,
    });
  } catch (err) {
    console.error('[familyController.assignFamilyMonth]', err);
    return res.status(500).json({ success: false, message: 'Failed to assign family month.' });
  }
}

/**
 * POST /api/family/delete-month
 * Delete assigned month fee records for all siblings in a family group
 * Body: { student_id, fee_month, fee_year }
 */
async function deleteFamilyMonth(req, res) {
  const { student_id, fee_month, fee_year } = req.body || {};

  const m = Number(fee_month);
  const y = Number(fee_year);

  if (!student_id || !m || !y) {
    return res.status(400).json({ success: false, message: 'student_id, fee_month, and fee_year are required.' });
  }

  try {
    const student = await db.queryOne('SELECT id, family_id FROM students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    let siblingIds = [student.id];
    if (student.family_id) {
      const sibs = await db.query('SELECT id FROM students WHERE family_id = ? AND status != "deleted"', [student.family_id]);
      if (sibs.length > 0) siblingIds = sibs.map(s => s.id);
    }

    // Check if any sibling has payments allocated for this month
    const paidRecords = await db.query(
      `SELECT mf.id, mf.paid_amount, s.full_name
       FROM monthly_fees mf
       JOIN students s ON s.id = mf.student_id
       WHERE mf.student_id IN (?) AND mf.fee_month = ? AND mf.fee_year = ? AND mf.paid_amount > 0`,
      [siblingIds, m, y]
    );

    if (paidRecords.length > 0) {
      const names = paidRecords.map(r => r.full_name).join(', ');
      return res.status(400).json({
        success: false,
        message: `Cannot delete month (${m}/${y}) because payment has already been recorded for: ${names}. Revert or delete payment first.`,
      });
    }

    const deleteResult = await db.query(
      `DELETE FROM monthly_fees WHERE student_id IN (?) AND fee_month = ? AND fee_year = ?`,
      [siblingIds, m, y]
    );

    return res.json({
      success: true,
      message: `Deleted month (${m}/${y}) fee records for family.`,
      affectedRows: deleteResult.affectedRows,
    });
  } catch (err) {
    console.error('[familyController.deleteFamilyMonth]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete family month fee records.' });
  }
}

module.exports = {
  searchStudentsForFamily,
  getFamilyByStudent,
  concatenateStudents,
  unlinkStudent,
  recordFamilyPayment,
  getFamilyMonthlyLedger,
  assignFamilyMonth,
  deleteFamilyMonth,
};
