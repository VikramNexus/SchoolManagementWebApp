/**
 * Student Controller — School Management System
 *
 * Handles Student CRUD operations:
 *   - GET /api/students (list with search, filters, pagination)
 *   - POST /api/students (create with individual monthly_fee_rate & initial charges)
 *   - GET /api/students/:id (profile with fee ledger)
 *   - PUT /api/students/:id (update)
 *   - PATCH /api/students/:id (partial update)
 *   - DELETE /api/students/:id (soft delete or permanent delete with force support)
 */

const db = require('../config/db');
const { generateMonthlyFeesForStudent } = require('../services/feeGeneratorService');

/**
 * Helpers
 */
function buildListQuery(params) {
  const { search, class_id, section_id, category, status, page = 1, limit = 25 } = params;
  const conditions = ["s.`status` != 'deleted'"];
  const values = [];

  if (search) {
    conditions.push('(s.`admission_no` LIKE ? OR s.`full_name` LIKE ? OR s.`phone` LIKE ? OR s.`whatsapp_number` LIKE ?)');
    const term = `%${search}%`;
    values.push(term, term, term, term);
  }
  if (class_id) {
    conditions.push('s.`class_id` = ?');
    values.push(class_id);
  }
  if (section_id) {
    conditions.push('s.`section_id` = ?');
    values.push(section_id);
  }
  if (category) {
    conditions.push('s.`category` = ?');
    values.push(category);
  }
  if (status) {
    conditions.push('s.`status` = ?');
    values.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const numLimit = Math.max(1, Number(limit) || 25);
  const numPage = Math.max(1, Number(page) || 1);
  const numOffset = (numPage - 1) * numLimit;

  const countSql = `SELECT COUNT(*) as total FROM \`students\` s ${whereClause}`;
  const dataSql = `
    SELECT s.*, c.\`name\` as class_name, sec.\`name\` as section_name
    FROM \`students\` s
    LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
    LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
    ${whereClause}
    ORDER BY s.\`created_at\` DESC
    LIMIT ? OFFSET ?
  `;

  return { countSql, dataSql, values, offset: numOffset, limit: numLimit };
}

// GET /api/students
async function listStudents(req, res) {
  try {
    const { countSql, dataSql, values, offset, limit } = buildListQuery(req.query);

    const [countResult, students] = await Promise.all([
      db.queryOne(countSql, values),
      db.query(dataSql, [...values, limit, offset]),
    ]);

    return res.json({
      success: true,
      students: students.map(s => ({ ...s, monthly_fee_rate: Number(s.monthly_fee_rate || 0) })),
      pagination: {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / (Number(req.query.limit) || 25)),
      },
    });
  } catch (err) {
    console.error('[studentController.listStudents]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch students.' });
  }
}

// POST /api/students
async function createStudent(req, res) {
  const {
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
    status = 'active',
    initial_fee_type_ids = [],
  } = req.body || {};

  // Validation
  if (!admission_no || !admission_no.trim()) {
    return res.status(400).json({ success: false, message: 'Admission number is required.' });
  }
  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ success: false, message: 'Full name is required.' });
  }
  if (!class_id) {
    return res.status(400).json({ success: false, message: 'Class is required.' });
  }
  if (!category || !['day_scholar', 'hosteller'].includes(category)) {
    return res.status(400).json({ success: false, message: 'Category must be "day_scholar" or "hosteller".' });
  }

  // Parse monthly rate or fallback to defaults
  let rate = Number(monthly_fee_rate);
  if (isNaN(rate) || rate <= 0) {
    rate = category === 'hosteller' ? 5000 : 3000;
  }

  const effectiveFather = father_name?.trim() || parent_name?.trim() || null;
  const effectiveMother = mother_name?.trim() || null;
  const effectiveParent = effectiveFather || effectiveMother || null;
  const effectiveGender = gender?.trim() || 'male';

  try {
    // Check section belongs to class if provided
    if (section_id) {
      const section = await db.queryOne('SELECT `id` FROM `sections` WHERE `id` = ? AND `class_id` = ?', [section_id, class_id]);
      if (!section) {
        return res.status(400).json({ success: false, message: 'Section does not belong to the selected class.' });
      }
    }

    const result = await db.query(
      `INSERT INTO \`students\`
       (\`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`section_id\`, \`category\`, \`father_name\`, \`mother_name\`, \`parent_name\`, \`phone\`, \`whatsapp_number\`, \`address\`, \`admission_date\`, \`monthly_fee_rate\`, \`status\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        admission_no.trim(),
        full_name.trim(),
        effectiveGender,
        class_id,
        section_id || null,
        category,
        effectiveFather,
        effectiveMother,
        effectiveParent,
        phone?.trim() || null,
        whatsapp_number?.trim() || null,
        address?.trim() || null,
        admission_date || null,
        rate,
        status,
      ]
    );

    const studentId = result.insertId;

    // Note: Automatic fee generation on student creation disabled per workflow requirement.
    // Monthly fees are generated when Admin runs fee generation for a target month.

    // Assign initial charges if selected
    if (Array.isArray(initial_fee_type_ids) && initial_fee_type_ids.length > 0) {
      for (const ftId of initial_fee_type_ids) {
        const feeType = await db.queryOne('SELECT `id`, `name` FROM `fee_types` WHERE `id` = ? AND `is_active` = 1', [ftId]);
        if (feeType) {
          await db.query(
            `INSERT INTO \`student_additional_fees\` (\`student_id\`, \`fee_type_id\`, \`amount\`, \`status\`)
             VALUES (?, ?, 1000.00, 'DUE')`,
            [studentId, ftId]
          );
        }
      }
    }

    const student = await db.queryOne(
      `SELECT s.*, c.\`name\` as class_name, sec.\`name\` as section_name
       FROM \`students\` s
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       WHERE s.\`id\` = ?`,
      [studentId]
    );

    return res.status(201).json({
      success: true,
      message: 'Student created with custom monthly fee rate.',
      student: { ...student, monthly_fee_rate: Number(student.monthly_fee_rate || 0) },
    });
  } catch (err) {
    console.error('[studentController.createStudent]', err);
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('admission_no')) {
        return res.status(409).json({ success: false, message: 'Admission number already exists.' });
      }
      return res.status(409).json({ success: false, message: 'Duplicate entry.' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: 'Invalid class or section ID.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create student.' });
  }
}

// GET /api/students/:id
async function getStudent(req, res) {
  const { id } = req.params;
  try {
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

    return res.json({
      success: true,
      student: { ...student, monthly_fee_rate: Number(student.monthly_fee_rate || 0) },
    });
  } catch (err) {
    console.error('[studentController.getStudent]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch student.' });
  }
}

// PUT /api/students/:id (full update)
async function updateStudent(req, res) {
  const { id } = req.params;
  const allowed = [
    'admission_no', 'full_name', 'gender', 'class_id', 'section_id', 'category',
    'father_name', 'mother_name', 'parent_name', 'phone', 'whatsapp_number', 'address', 'admission_date', 'monthly_fee_rate', 'status'
  ];

  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`\`${key}\` = ?`);
      values.push(req.body[key]);
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update.' });
  }

  try {
    values.push(id);
    await db.query(`UPDATE \`students\` SET ${fields.join(', ')} WHERE \`id\` = ?`, values);

    // Note: Past monthly_fees ledgers remain unchanged to preserve accounting history.
    // Future monthly fee calculations will use the newly updated monthly_fee_rate.

    const student = await db.queryOne(
      `SELECT s.*, c.\`name\` as class_name, sec.\`name\` as section_name
       FROM \`students\` s
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       WHERE s.\`id\` = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Student details updated. Future monthly fees will be calculated at the new rate.',
      student: { ...student, monthly_fee_rate: Number(student.monthly_fee_rate || 0) },
    });
  } catch (err) {
    console.error('[studentController.updateStudent]', err);
    return res.status(500).json({ success: false, message: 'Failed to update student.' });
  }
}

// PATCH /api/students/:id
async function patchStudent(req, res) {
  return updateStudent(req, res);
}

// DELETE /api/students/:id (supports mode=soft or mode=permanent with force option)
async function deleteStudent(req, res) {
  const { id } = req.params;
  const { mode = 'soft', force } = req.query;

  try {
    const student = await db.queryOne('SELECT `id`, `full_name`, `admission_no` FROM `students` WHERE `id` = ?', [id]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    if (mode === 'permanent') {
      const paymentCount = await db.queryOne('SELECT COUNT(*) as cnt FROM `payments` WHERE `student_id` = ?', [id]);
      const isForce = force === 'true' || force === '1';

      if (paymentCount && paymentCount.cnt > 0 && !isForce) {
        return res.status(400).json({
          success: false,
          has_payments: true,
          payment_count: paymentCount.cnt,
          message: `Student "${student.full_name}" has ${paymentCount.cnt} payment receipts on record. Check "Force Delete" to purge payments or choose "Mark as Left (TC Issued)" to preserve audit history.`,
        });
      }

      // Permanent delete cleanup (receipts, payment allocations, payments, monthly fees, additional fees, message logs)
      await db.query('DELETE FROM `receipts` WHERE `payment_id` IN (SELECT `id` FROM `payments` WHERE `student_id` = ?)', [id]);
      await db.query('DELETE FROM `payment_allocations` WHERE `payment_id` IN (SELECT `id` FROM `payments` WHERE `student_id` = ?)', [id]);
      await db.query('DELETE FROM `payment_allocations` WHERE `monthly_fee_id` IN (SELECT `id` FROM `monthly_fees` WHERE `student_id` = ?)', [id]);
      await db.query('DELETE FROM `payments` WHERE `student_id` = ?', [id]);
      await db.query('DELETE FROM `monthly_fees` WHERE `student_id` = ?', [id]);
      await db.query('DELETE FROM `student_additional_fees` WHERE `student_id` = ?', [id]);
      await db.query('DELETE FROM `message_logs` WHERE `student_id` = ?', [id]);
      await db.query('DELETE FROM `students` WHERE `id` = ?', [id]);

      return res.json({
        success: true,
        message: `Student "${student.full_name}" permanently deleted from database.`,
      });
    }

    // Soft delete ("Mark as Left / TC Issued")
    await db.query('UPDATE `students` SET `status` = "inactive" WHERE `id` = ?', [id]);
    return res.json({
      success: true,
      message: `Student "${student.full_name}" marked as Left (TC Issued). Historical financial receipts preserved.`,
    });
  } catch (err) {
    console.error('[studentController.deleteStudent]', err);
    return res.status(500).json({ success: false, message: 'Failed to process student deletion: ' + err.message });
  }
}

module.exports = {
  listStudents,
  createStudent,
  getStudent,
  updateStudent,
  patchStudent,
  deleteStudent,
};