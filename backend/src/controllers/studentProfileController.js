/**
 * Student Profile Controller — School Management System
 *
 * Handles detailed student profile, month-wise fee ledger,
 * custom additional fees, and monthly fee rate revisions.
 */

const db = require('../config/db');
const ExcelJS = require('exceljs');

/**
 * GET /api/students/:id/profile
 * Returns student details + month-wise fee ledger + additional fees
 */
async function getStudentProfile(req, res) {
  const { id } = req.params;

  try {
    // Get student details
    const student = await db.queryOne(
      `SELECT s.*, c.\`name\` as class_name, sec.\`name\` as section_name
       FROM \`students\` s
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       WHERE s.\`id\` = ? AND s.\`status\` != 'deleted'`,
      [id]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Get monthly fee ledger
    const monthlyFees = await db.query(
      `SELECT mf.*,
         COALESCE(
           (SELECT SUM(pa.\`allocated_amount\`) FROM \`payment_allocations\` pa WHERE pa.\`monthly_fee_id\` = mf.\`id\`),
           mf.\`paid_amount\`,
           0
         ) as paid_amount,
         (SELECT COALESCE(SUM(saf.\`amount\`), 0)
          FROM \`student_additional_fees\` saf
          WHERE saf.\`student_id\` = mf.\`student_id\`
            AND MONTH(saf.\`due_date\`) = mf.\`fee_month\`
            AND YEAR(saf.\`due_date\`) = mf.\`fee_year\`
            AND saf.\`description\` NOT LIKE '%Admission%'
            AND saf.\`description\` NOT LIKE '%Security%'
            AND saf.\`description\` NOT LIKE '%Tie%'
            AND saf.\`description\` NOT LIKE '%Belt%'
            AND saf.\`description\` NOT LIKE '%Caution%'
            AND saf.\`description\` NOT LIKE '%Uniform%') as other_charges,
         (SELECT p.\`payment_date\`
          FROM \`payment_allocations\` pa
          JOIN \`payments\` p ON p.\`id\` = pa.\`payment_id\`
          WHERE pa.\`monthly_fee_id\` = mf.\`id\`
          ORDER BY p.\`payment_date\` DESC LIMIT 1) as actual_payment_date,
         (SELECT p.\`payment_mode\`
          FROM \`payment_allocations\` pa
          JOIN \`payments\` p ON p.\`id\` = pa.\`payment_id\`
          WHERE pa.\`monthly_fee_id\` = mf.\`id\`
          ORDER BY p.\`payment_date\` DESC LIMIT 1) as actual_payment_mode
       FROM \`monthly_fees\` mf
       WHERE mf.\`student_id\` = ?
       ORDER BY mf.\`fee_year\` ASC, mf.\`fee_month\` ASC`,
      [id]
    );

    // Get additional fees
    const additionalFees = await db.query(
      `SELECT saf.*, ft.\`name\` as fee_type_name, ft.\`is_recurring\`
       FROM \`student_additional_fees\` saf
       LEFT JOIN \`fee_types\` ft ON ft.\`id\` = saf.\`fee_type_id\`
       WHERE saf.\`student_id\` = ?
       ORDER BY saf.\`created_at\` DESC`,
      [id]
    );

    // Get recent payments & attach installments by monthly_fee_id
    const payments = await db.query(
      `SELECT p.*, COALESCE(r.\`receipt_number\`, CONCAT('RCP-', LPAD(p.\`id\`, 6, '0'))) as receipt_number,
              pa.\`monthly_fee_id\`, pa.\`allocated_amount\`
       FROM \`payments\` p
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       LEFT JOIN \`payment_allocations\` pa ON pa.\`payment_id\` = p.\`id\`
       WHERE p.\`student_id\` = ?
       ORDER BY p.\`payment_date\` DESC, p.\`created_at\` DESC`,
      [id]
    );

    const allocationsByMonthlyFeeId = {};
    for (const p of payments) {
      if (p.monthly_fee_id) {
        if (!allocationsByMonthlyFeeId[p.monthly_fee_id]) allocationsByMonthlyFeeId[p.monthly_fee_id] = [];
        allocationsByMonthlyFeeId[p.monthly_fee_id].push(p);
      }
    }

    const monthlyFeesWithInstallments = monthlyFees.map(mf => {
      const feeAmt = Number(mf.fee_amount || 0);
      const otherChg = Number(mf.other_charges || 0);
      const paidAmt = Number(mf.paid_amount || 0);
      const dueAmt = Math.max(0, (feeAmt + otherChg) - paidAmt);
      const computedStatus = (feeAmt + otherChg) > 0 && dueAmt === 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'DUE');

      return {
        ...mf,
        fee_amount: feeAmt,
        other_charges: otherChg,
        paid_amount: paidAmt,
        due_amount: dueAmt,
        status: computedStatus,
        installments: allocationsByMonthlyFeeId[mf.id] || [],
      };
    });

    return res.json({
      success: true,
      student: {
        ...student,
        monthly_fee_rate: Number(student.monthly_fee_rate || 0),
        opening_dues: Number(student.opening_dues || 0),
      },
      monthly_fees: monthlyFeesWithInstallments,
      additional_fees: additionalFees,
      recent_payments: payments,
    });
  } catch (err) {
    console.error('[studentProfileController.getStudentProfile]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch student profile.' });
  }
}

/**
 * PATCH /api/students/:id/monthly-rate
 * Revise a student's monthly fee rate and optionally update future unpaid ledger entries.
 */
async function updateMonthlyRate(req, res) {
  const { id } = req.params;
  const { new_monthly_rate, update_unpaid_future_fees = true } = req.body || {};

  const newRate = Number(new_monthly_rate);
  if (isNaN(newRate) || newRate <= 0) {
    return res.status(400).json({ success: false, message: 'Valid new monthly fee rate (greater than 0) is required.' });
  }

  try {
    const student = await db.queryOne('SELECT `id`, `full_name`, `monthly_fee_rate` FROM `students` WHERE `id` = ?', [id]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const oldRate = Number(student.monthly_fee_rate || 0);

    // Update student's monthly_fee_rate in students table
    await db.query('UPDATE `students` SET `monthly_fee_rate` = ? WHERE `id` = ?', [newRate, id]);

    // Note: Historical past ledgers remain unchanged at their original fee amounts.

    // Log action in audit_logs
    try {
      await db.query(
        `INSERT INTO \`audit_logs\` (\`user_id\`, \`action\`, \`entity_type\`, \`entity_id\`, \`description\`)
         VALUES (?, 'UPDATE_MONTHLY_RATE', 'students', ?, ?)`,
        [
          req.user?.id || 1,
          id,
          `Monthly fee rate for ${student.full_name} updated from ₹${oldRate} to ₹${newRate}. (Historical ledgers preserved)`,
        ]
      );
    } catch (auditErr) {
      console.warn('[updateMonthlyRate] Audit log failed:', auditErr.message);
    }

    return res.json({
      success: true,
      message: `Monthly fee rate for ${student.full_name} updated to ₹${newRate}. Future monthly fees will be calculated at ₹${newRate}. Past monthly dues remain unchanged.`,
      old_rate: oldRate,
      new_rate: newRate,
    });
  } catch (err) {
    console.error('[studentProfileController.updateMonthlyRate]', err);
    return res.status(500).json({ success: false, message: 'Failed to update monthly fee rate.' });
  }
}

/**
 * POST /api/students/:id/add-fee
 * Assign a custom fee type to a student
 */
async function addStudentFee(req, res) {
  const { id } = req.params;
  const { fee_type_id, amount, due_date, description, fee_month, fee_year, notes } = req.body || {};

  if (!amount) {
    return res.status(400).json({ success: false, message: 'Amount is required.' });
  }

  try {
    // Verify student exists
    const student = await db.queryOne('SELECT `id` FROM `students` WHERE `id` = ? AND `status` != "deleted"', [id]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    let validFeeTypeId = fee_type_id ? Number(fee_type_id) : null;
    if (!validFeeTypeId) {
      // Use default fee type or create fallback
      const defaultType = await db.queryOne('SELECT `id` FROM `fee_types` WHERE `is_active` = 1 LIMIT 1');
      validFeeTypeId = defaultType ? defaultType.id : 1;
    }

    const descText = description || notes || 'Custom Extra Charge';

    const result = await db.query(
      `INSERT INTO \`student_additional_fees\`
       (\`student_id\`, \`fee_type_id\`, \`fee_month\`, \`fee_year\`, \`amount\`, \`paid_amount\`, \`due_amount\`, \`due_date\`, \`description\`, \`status\`)
       VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, ?, 'DUE')`,
      [
        id,
        validFeeTypeId,
        fee_month ? Number(fee_month) : null,
        fee_year ? Number(fee_year) : null,
        Number(amount),
        Number(amount),
        due_date || null,
        descText,
      ]
    );

    const newFee = await db.queryOne(
      `SELECT saf.*, ft.\`name\` as fee_type_name, ft.\`is_recurring\`
       FROM \`student_additional_fees\` saf
       LEFT JOIN \`fee_types\` ft ON ft.\`id\` = saf.\`fee_type_id\`
       WHERE saf.\`id\` = ?`,
      [result.insertId]
    );

    return res.status(201).json({ success: true, message: 'Additional fee assigned.', fee: newFee });
  } catch (err) {
    console.error('[studentProfileController.addStudentFee]', err);
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: 'Invalid fee type.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to assign additional fee.' });
  }
}

/**
 * DELETE /api/students/:id/add-fee/:feeId
 * Remove an additional fee from a student
 */
async function removeStudentFee(req, res) {
  const { id, feeId } = req.params;

  try {
    // Check if fee has been paid
    const fee = await db.queryOne('SELECT `status` FROM `student_additional_fees` WHERE `id` = ? AND `student_id` = ?', [feeId, id]);
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Fee not found.' });
    }
    if (fee.status !== 'DUE') {
      return res.status(400).json({ success: false, message: 'Cannot remove fee that has been paid or partially paid.' });
    }

    await db.query('DELETE FROM `student_additional_fees` WHERE `id` = ? AND `student_id` = ?', [feeId, id]);
    return res.json({ success: true, message: 'Additional fee removed.' });
  } catch (err) {
    console.error('[studentProfileController.removeStudentFee]', err);
    return res.status(500).json({ success: false, message: 'Failed to remove additional fee.' });
  }
}

/**
 * PATCH /api/students/:id/add-fee/:feeId
 * Edit an existing extra expense / custom charge for a student
 */
async function updateStudentFee(req, res) {
  const { id, feeId } = req.params;
  const { amount, description, fee_month, fee_year, due_date, notes } = req.body || {};

  try {
    const fee = await db.queryOne('SELECT * FROM `student_additional_fees` WHERE `id` = ? AND `student_id` = ?', [feeId, id]);
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Fee record not found.' });
    }

    const newAmount = amount !== undefined ? Number(amount) : Number(fee.amount);
    const paid = Number(fee.paid_amount || 0);
    const newDue = Math.max(0, newAmount - paid);
    let newStatus = 'DUE';
    if (newAmount > 0 && paid >= newAmount) {
      newStatus = 'PAID';
    } else if (paid > 0) {
      newStatus = 'PARTIAL';
    }

    const descText = description || notes || fee.description || 'Custom Extra Charge';

    await db.query(
      `UPDATE \`student_additional_fees\`
       SET \`amount\` = ?, \`due_amount\` = ?, \`description\` = ?, \`fee_month\` = ?, \`fee_year\` = ?, \`due_date\` = ?, \`status\` = ?
       WHERE \`id\` = ? AND \`student_id\` = ?`,
      [
        newAmount,
        newDue,
        descText,
        fee_month ? Number(fee_month) : null,
        fee_year ? Number(fee_year) : null,
        due_date || null,
        newStatus,
        feeId,
        id,
      ]
    );

    return res.json({ success: true, message: 'Extra expense updated successfully.' });
  } catch (err) {
    console.error('[studentProfileController.updateStudentFee]', err);
    return res.status(500).json({ success: false, message: 'Failed to update extra expense.' });
  }
}

/**
 * POST /api/students/:id/generate-month-fee
 * Manually generate / assign a monthly fee for a specific month and year to a student.
 */
async function generateMonthFee(req, res) {
  const { id } = req.params;
  const { fee_month, fee_year } = req.body || {};

  const month = Number(fee_month);
  const year = Number(fee_year);

  if (!month || month < 1 || month > 12) {
    return res.status(400).json({ success: false, message: 'Valid fee month (1-12) is required.' });
  }
  if (!year || year < 2000 || year > 2100) {
    return res.status(400).json({ success: false, message: 'Valid fee year is required.' });
  }

  try {
    const student = await db.queryOne(
      'SELECT `id`, `full_name`, `category`, `monthly_fee_rate` FROM `students` WHERE `id` = ? AND `status` != "deleted"',
      [id]
    );
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Check if fee entry already exists for this month/year
    const existing = await db.queryOne(
      'SELECT `id` FROM `monthly_fees` WHERE `student_id` = ? AND `fee_year` = ? AND `fee_month` = ?',
      [id, year, month]
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Monthly fee for ${month}/${year} has already been assigned to this student.`,
      });
    }

    // Determine monthly rate
    let rate = Number(student.monthly_fee_rate);
    if (isNaN(rate) || rate <= 0) {
      rate = student.category === 'hosteller' ? 5000 : 3000;
    }

    const result = await db.query(
      `INSERT INTO \`monthly_fees\`
       (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
       VALUES (?, ?, ?, ?, 0.00, ?, 'DUE')`,
      [id, month, year, rate, rate]
    );

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return res.status(201).json({
      success: true,
      message: `${monthNames[month - 1]} ${year} monthly fee of ₹${rate.toLocaleString('en-IN')} assigned to ${student.full_name}.`,
      monthly_fee: {
        id: result.insertId,
        student_id: Number(id),
        fee_month: month,
        fee_year: year,
        fee_amount: rate,
        paid_amount: 0,
        due_amount: rate,
        status: 'DUE',
      },
    });
  } catch (err) {
    console.error('[studentProfileController.generateMonthFee]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate month fee.' });
  }
}

/**
 * PATCH /api/students/:id/monthly-fees/:feeId
 * Edit specific monthly fee amount for a student record.
 */
async function updateMonthlyFeeRecord(req, res) {
  const { id, feeId } = req.params;
  const { fee_amount } = req.body || {};

  const newAmount = Number(fee_amount);
  if (isNaN(newAmount) || newAmount < 0) {
    return res.status(400).json({ success: false, message: 'Valid fee amount is required.' });
  }

  try {
    const feeRecord = await db.queryOne(
      'SELECT * FROM `monthly_fees` WHERE `id` = ? AND `student_id` = ?',
      [feeId, id]
    );

    if (!feeRecord) {
      return res.status(404).json({ success: false, message: 'Monthly fee record not found.' });
    }

    const paid = Number(feeRecord.paid_amount || 0);
    const newDue = Math.max(0, newAmount - paid);
    let newStatus = 'DUE';
    if (newAmount > 0 && paid >= newAmount) {
      newStatus = 'PAID';
    } else if (paid > 0) {
      newStatus = 'PARTIAL';
    }

    await db.query(
      'UPDATE `monthly_fees` SET `fee_amount` = ?, `due_amount` = ?, `status` = ? WHERE `id` = ? AND `student_id` = ?',
      [newAmount, newDue, newStatus, feeId, id]
    );

    return res.json({
      success: true,
      message: `Monthly fee updated to ₹${newAmount.toLocaleString('en-IN')}.`,
    });
  } catch (err) {
    console.error('[studentProfileController.updateMonthlyFeeRecord]', err);
    return res.status(500).json({ success: false, message: 'Failed to update monthly fee record.' });
  }
}

/**
 * DELETE /api/students/:id/monthly-fees/:feeId
 * Delete an assigned monthly fee record for a student.
 */
async function deleteMonthlyFeeRecord(req, res) {
  const { id, feeId } = req.params;

  try {
    const feeRecord = await db.queryOne(
      'SELECT * FROM `monthly_fees` WHERE `id` = ? AND `student_id` = ?',
      [feeId, id]
    );

    if (!feeRecord) {
      return res.status(404).json({ success: false, message: 'Monthly fee record not found.' });
    }

    if (Number(feeRecord.paid_amount || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a monthly fee record that has payments allocated to it. Revert/Edit payment first.',
      });
    }

    await db.query('DELETE FROM `monthly_fees` WHERE `id` = ? AND `student_id` = ?', [feeId, id]);

    return res.json({
      success: true,
      message: 'Assigned monthly fee record deleted successfully.',
    });
  } catch (err) {
    console.error('[studentProfileController.deleteMonthlyFeeRecord]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete monthly fee record.' });
  }
}

/**
 * POST /api/students/:id/additional-fees/:feeId/discount
 * Apply fee relief / concession / discount to an admission fee or custom additional fee
 */
async function giveFeeDiscount(req, res) {
  const { id, feeId } = req.params;
  const { discount_amount, discount_reason } = req.body || {};

  const discAmt = Number(discount_amount);
  if (isNaN(discAmt) || discAmt <= 0) {
    return res.status(400).json({ success: false, message: 'Valid discount / relief amount is required.' });
  }

  try {
    const fee = await db.queryOne('SELECT * FROM `student_additional_fees` WHERE `id` = ? AND `student_id` = ?', [feeId, id]);
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Additional fee item not found.' });
    }

    const totalAmt = Number(fee.amount || 0);
    const paidAmt = Number(fee.paid_amount || 0);
    const maxAllowedDiscount = Math.max(0, totalAmt - paidAmt);

    if (discAmt > maxAllowedDiscount) {
      return res.status(400).json({
        success: false,
        message: `Discount amount (₹${discAmt}) cannot exceed pending fee balance (₹${maxAllowedDiscount}).`,
      });
    }

    const newDiscount = Number(fee.discount_amount || 0) + discAmt;
    const newStatus = (paidAmt + newDiscount) >= totalAmt ? 'PAID' : 'PARTIAL';

    await db.query(
      `UPDATE \`student_additional_fees\`
       SET \`discount_amount\` = ?, \`discount_reason\` = ?, \`status\` = ?
       WHERE \`id\` = ? AND \`student_id\` = ?`,
      [newDiscount, discount_reason?.trim() || 'Management Concession / Fee Relief', newStatus, feeId, id]
    );

    return res.json({
      success: true,
      message: `Discount / relief of ₹${discAmt.toLocaleString('en-IN')} applied successfully.`,
      fee: {
        ...fee,
        discount_amount: newDiscount,
        discount_reason: discount_reason?.trim() || 'Management Concession / Fee Relief',
        status: newStatus,
        due_amount: Math.max(0, totalAmt - paidAmt - newDiscount),
      },
    });
  } catch (err) {
    console.error('[studentProfileController.giveFeeDiscount]', err);
    return res.status(500).json({ success: false, message: 'Failed to apply fee discount: ' + err.message });
  }
}

/**
 * GET /api/students/:id/export-excel
 * Export complete individual student profile, monthly fee history, additional fees & receipts dossier (.xlsx)
 */
async function exportStudentProfileExcel(req, res) {
  const { id } = req.params;

  try {
    // 1. Get Student Bio
    const student = await db.queryOne(
      `SELECT s.*, c.\`name\` as class_name, sec.\`name\` as section_name
       FROM \`students\` s
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       WHERE s.\`id\` = ? AND s.\`status\` != 'deleted'`,
      [id]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // 2. Get Monthly Fees
    const monthlyFees = await db.query(
      `SELECT mf.*,
         COALESCE(
           (SELECT SUM(pa.\`allocated_amount\`) FROM \`payment_allocations\` pa WHERE pa.\`monthly_fee_id\` = mf.\`id\`),
           mf.\`paid_amount\`,
           0
         ) as actual_paid,
         (SELECT p.\`payment_date\`
          FROM \`payment_allocations\` pa
          JOIN \`payments\` p ON p.\`id\` = pa.\`payment_id\`
          WHERE pa.\`monthly_fee_id\` = mf.\`id\`
          ORDER BY p.\`payment_date\` DESC LIMIT 1) as payment_date,
         (SELECT p.\`payment_mode\`
          FROM \`payment_allocations\` pa
          JOIN \`payments\` p ON p.\`id\` = pa.\`payment_id\`
          WHERE pa.\`monthly_fee_id\` = mf.\`id\`
          ORDER BY p.\`payment_date\` DESC LIMIT 1) as payment_mode,
         (SELECT p.\`receipt_number\`
          FROM \`payment_allocations\` pa
          JOIN \`payments\` p ON p.\`id\` = pa.\`payment_id\`
          WHERE pa.\`monthly_fee_id\` = mf.\`id\`
          ORDER BY p.\`payment_date\` DESC LIMIT 1) as receipt_no
       FROM \`monthly_fees\` mf
       WHERE mf.\`student_id\` = ?
       ORDER BY mf.\`fee_year\` DESC, mf.\`fee_month\` DESC`,
      [id]
    );

    // 3. Get Additional & Custom Fees
    const additionalFees = await db.query(
      `SELECT saf.*, ft.\`name\` as fee_type_name
       FROM \`student_additional_fees\` saf
       LEFT JOIN \`fee_types\` ft ON ft.\`id\` = saf.\`fee_type_id\`
       WHERE saf.\`student_id\` = ?
       ORDER BY saf.\`due_date\` DESC, saf.\`id\` DESC`,
      [id]
    );

    // 4. Get Payment Receipts
    const payments = await db.query(
      `SELECT p.*
       FROM \`payments\` p
       WHERE p.\`student_id\` = ?
       ORDER BY p.\`payment_date\` DESC, p.\`id\` DESC`,
      [id]
    );

    // Build Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'School Management System';
    workbook.created = new Date();

    const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };

    // ----------------------------------------------------
    // Sheet 1: 👤 Student Bio & Parents
    // ----------------------------------------------------
    const wsBio = workbook.addWorksheet('👤 Student Profile', { views: [{ showGridLines: true }] });
    wsBio.columns = [
      { header: 'Profile Field', key: 'field', width: 28 },
      { header: 'Student & Guardian Details', key: 'value', width: 45 },
    ];
    wsBio.getRow(1).font = headerFont;
    wsBio.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }; // Blue

    const bioData = [
      { field: 'Admission Number', value: student.admission_no || '—' },
      { field: 'Full Name', value: student.full_name || '—' },
      { field: 'Class & Section', value: `${student.class_name || '—'} ${student.section_name || ''}`.trim() },
      { field: 'Roll Number', value: student.roll_number || '—' },
      { field: 'Category / Residence', value: student.category === 'hosteller' ? 'Hosteller / Residential' : 'Day Scholar' },
      { field: 'Monthly Tuition Rate', value: `₹${Number(student.monthly_fee_rate || 3000).toLocaleString('en-IN')}` },
      { field: "Father's Name", value: student.father_name || student.parent_name || '—' },
      { field: "Mother's Name", value: student.mother_name || '—' },
      { field: 'Primary Phone Number', value: student.phone || '—' },
      { field: 'WhatsApp Number', value: student.whatsapp_number || student.phone || '—' },
      { field: 'Residential Address', value: student.address || '—' },
      { field: 'Date of Birth', value: student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : '—' },
      { field: 'Gender', value: student.gender ? (student.gender.charAt(0).toUpperCase() + student.gender.slice(1)) : '—' },
      { field: 'Blood Group', value: student.blood_group || '—' },
      { field: 'Emergency Contact', value: student.emergency_contact || '—' },
      { field: 'Admission Date', value: student.admission_date ? new Date(student.admission_date).toLocaleDateString('en-IN') : '—' },
      { field: 'Family Group ID', value: student.family_id || '—' },
      { field: 'Enrollment Status', value: (student.status || 'active').toUpperCase() },
      { field: 'Opening / Previous Balance', value: `₹${Number(student.opening_dues || 0).toLocaleString('en-IN')}` },
    ];

    bioData.forEach((item) => {
      const r = wsBio.addRow(item);
      r.getCell('field').font = { bold: true, color: { argb: 'FF1E293B' } };
    });

    // ----------------------------------------------------
    // Sheet 2: 📅 Monthly Tuition Ledger
    // ----------------------------------------------------
    const wsMonth = workbook.addWorksheet('📅 Monthly Tuition', { views: [{ showGridLines: true }] });
    wsMonth.columns = [
      { header: 'Month', key: 'month_name', width: 14 },
      { header: 'Year', key: 'fee_year', width: 10 },
      { header: 'Assessed Fee (₹)', key: 'amount', width: 18 },
      { header: 'Concession / Discount (₹)', key: 'discount_amount', width: 22 },
      { header: 'Amount Paid (₹)', key: 'actual_paid', width: 18 },
      { header: 'Pending Due (₹)', key: 'due_amount', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Payment Date', key: 'payment_date', width: 16 },
      { header: 'Payment Mode', key: 'payment_mode', width: 16 },
      { header: 'Receipt No', key: 'receipt_no', width: 18 },
    ];
    wsMonth.getRow(1).font = headerFont;
    wsMonth.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }; // Green

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    monthlyFees.forEach((mf) => {
      const row = wsMonth.addRow({
        month_name: monthNames[mf.fee_month] || `Month ${mf.fee_month}`,
        fee_year: mf.fee_year,
        amount: Number(mf.amount || 0),
        discount_amount: Number(mf.discount_amount || 0),
        actual_paid: Number(mf.actual_paid || 0),
        due_amount: Math.max(0, Number(mf.amount || 0) - Number(mf.discount_amount || 0) - Number(mf.actual_paid || 0)),
        status: mf.status,
        payment_date: mf.payment_date ? new Date(mf.payment_date).toLocaleDateString('en-IN') : '—',
        payment_mode: mf.payment_mode || '—',
        receipt_no: mf.receipt_no || '—',
      });
      row.getCell('amount').numFmt = '₹#,##0.00';
      row.getCell('discount_amount').numFmt = '₹#,##0.00';
      row.getCell('actual_paid').numFmt = '₹#,##0.00';
      row.getCell('due_amount').numFmt = '₹#,##0.00';
    });

    // ----------------------------------------------------
    // Sheet 3: 💳 Additional & Custom Fees
    // ----------------------------------------------------
    const wsAdd = workbook.addWorksheet('💳 Additional Fees', { views: [{ showGridLines: true }] });
    wsAdd.columns = [
      { header: 'Fee Description', key: 'description', width: 32 },
      { header: 'Fee Category', key: 'category', width: 20 },
      { header: 'Total Assessed (₹)', key: 'amount', width: 20 },
      { header: 'Discount (₹)', key: 'discount_amount', width: 16 },
      { header: 'Amount Paid (₹)', key: 'paid_amount', width: 18 },
      { header: 'Balance Due (₹)', key: 'due_amount', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Due Date', key: 'due_date', width: 16 },
    ];
    wsAdd.getRow(1).font = headerFont;
    wsAdd.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }; // Purple

    additionalFees.forEach((af) => {
      const total = Number(af.amount || 0);
      const paid = Number(af.paid_amount || 0);
      const disc = Number(af.discount_amount || 0);
      const row = wsAdd.addRow({
        description: af.description || af.fee_type_name || 'Additional Fee',
        category: af.fee_type_name || 'Custom Expense',
        amount: total,
        discount_amount: disc,
        paid_amount: paid,
        due_amount: Math.max(0, total - paid - disc),
        status: af.status,
        due_date: af.due_date ? new Date(af.due_date).toLocaleDateString('en-IN') : '—',
      });
      row.getCell('amount').numFmt = '₹#,##0.00';
      row.getCell('discount_amount').numFmt = '₹#,##0.00';
      row.getCell('paid_amount').numFmt = '₹#,##0.00';
      row.getCell('due_amount').numFmt = '₹#,##0.00';
    });

    // ----------------------------------------------------
    // Sheet 4: 🧾 Payment Receipts & Ledger History
    // ----------------------------------------------------
    const wsPay = workbook.addWorksheet('🧾 Receipts Ledger', { views: [{ showGridLines: true }] });
    wsPay.columns = [
      { header: 'Receipt Number', key: 'receipt_number', width: 22 },
      { header: 'Payment Date', key: 'payment_date', width: 16 },
      { header: 'Amount Paid (₹)', key: 'amount', width: 20 },
      { header: 'Payment Mode', key: 'payment_mode', width: 18 },
      { header: 'Category', key: 'payment_category', width: 22 },
      { header: 'Notes / Remarks', key: 'notes', width: 35 },
    ];
    wsPay.getRow(1).font = headerFont;
    wsPay.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // Amber

    payments.forEach((p) => {
      const row = wsPay.addRow({
        receipt_number: p.receipt_number || `PAY-${p.id}`,
        payment_date: p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—',
        amount: Number(p.amount || 0),
        payment_mode: p.payment_mode === 'IN_ACCOUNT' ? 'In Account / Online' : 'Cash',
        payment_category: p.payment_category || 'FEE_PAYMENT',
        notes: p.notes || '—',
      });
      row.getCell('amount').numFmt = '₹#,##0.00';
    });

    const safeName = (student.full_name || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeAdm = (student.admission_no || id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Student_Profile_${safeAdm}_${safeName}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('[studentProfileController.exportStudentProfileExcel] Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Failed to export student profile Excel: ' + err.message });
    }
  }
}

module.exports = {
  getStudentProfile,
  updateMonthlyRate,
  addStudentFee,
  updateStudentFee,
  removeStudentFee,
  giveFeeDiscount,
  generateMonthFee,
  updateMonthlyFeeRecord,
  deleteMonthlyFeeRecord,
  exportStudentProfileExcel,
};