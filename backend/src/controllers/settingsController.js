/**
 * Settings Controller — School Management System
 *
 * Day 4: Settings, Fees & Application Shell.
 *
 * Handles:
 *   - School Profile (GET/PUT /api/settings/school)
 *   - Classes & Sections (GET/POST/DELETE /api/settings/classes, /api/settings/sections)
 *   - Fee Structures (GET/POST/PUT/DELETE /api/settings/fee-structures)
 *   - Fee Types (GET/POST/PUT/DELETE /api/settings/fee-types)
 */

const db = require('../config/db');

/**
 * Helpers
 */
function buildUpdateSql(table, allowedFields, body, id, idField = 'id') {
  const fields = [];
  const values = [];
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (fields.length === 0) return null;
  values.push(id);
  return {
    sql: `UPDATE \`${table}\` SET ${fields.join(', ')} WHERE \`${idField}\` = ?`,
    values,
  };
}

/**
 * SCHOOL PROFILE
 */

// GET /api/settings/school
async function getSchool(req, res) {
  try {
    let school = await db.queryOne('SELECT * FROM `school_settings` WHERE `id` = 1 LIMIT 1');
    if (!school) {
      await db.query(
        `INSERT INTO \`school_settings\` (\`id\`, \`school_name\`, \`address\`, \`phone\`, \`email\`, \`currency_symbol\`, \`academic_year\`)
         VALUES (1, 'Aryavart Shikshan Sansthan', 'School Campus Address', '+91-9876543210', 'admin@school.com', '₹', '2025-2026')`
      );
      school = await db.queryOne('SELECT * FROM `school_settings` WHERE `id` = 1 LIMIT 1');
    }
    return res.json({
      success: true,
      school: {
        ...school,
        logo_url: school.logo_path || '',
      },
    });
  } catch (err) {
    console.error('[settingsController.getSchool]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch school settings.' });
  }
}

// PUT /api/settings/school
async function updateSchool(req, res) {
  const { school_name, address, phone, email, logo_url, logo_path, currency_symbol, academic_year } = req.body || {};

  const effectiveLogo = logo_path !== undefined ? logo_path : (logo_url !== undefined ? logo_url : undefined);

  const updateFields = [];
  const updateValues = [];

  if (school_name !== undefined) {
    updateFields.push('`school_name` = ?');
    updateValues.push(school_name ? school_name.trim() : 'School Name');
  }
  if (address !== undefined) {
    updateFields.push('`address` = ?');
    updateValues.push(address ? address.trim() : null);
  }
  if (phone !== undefined) {
    updateFields.push('`phone` = ?');
    updateValues.push(phone ? phone.trim() : null);
  }
  if (email !== undefined) {
    updateFields.push('`email` = ?');
    updateValues.push(email ? email.trim() : null);
  }
  if (effectiveLogo !== undefined) {
    updateFields.push('`logo_path` = ?');
    updateValues.push(effectiveLogo ? effectiveLogo.trim() : null);
  }
  if (currency_symbol !== undefined) {
    updateFields.push('`currency_symbol` = ?');
    updateValues.push(currency_symbol ? currency_symbol.trim() : '₹');
  }
  if (academic_year !== undefined) {
    updateFields.push('`academic_year` = ?');
    updateValues.push(academic_year ? academic_year.trim() : null);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update.' });
  }

  try {
    updateValues.push(1);
    await db.query(`UPDATE \`school_settings\` SET ${updateFields.join(', ')} WHERE \`id\` = ?`, updateValues);

    const school = await db.queryOne('SELECT * FROM `school_settings` WHERE `id` = 1 LIMIT 1');
    return res.json({
      success: true,
      message: 'School settings updated successfully.',
      school: {
        ...school,
        logo_url: school.logo_path || '',
      },
    });
  } catch (err) {
    console.error('[settingsController.updateSchool]', err);
    return res.status(500).json({ success: false, message: 'Failed to update school settings.' });
  }
}

/**
 * CLASSES
 */

// GET /api/settings/classes
async function getClasses(req, res) {
  try {
    const classes = await db.query(
      `SELECT c.*, COUNT(s.id) as section_count
       FROM \`classes\` c
       LEFT JOIN \`sections\` s ON s.\`class_id\` = c.\`id\`
       GROUP BY c.\`id\`
       ORDER BY c.\`order_index\` ASC, c.\`name\` ASC`
    );
    return res.json({ success: true, classes });
  } catch (err) {
    console.error('[settingsController.getClasses]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch classes.' });
  }
}

// POST /api/settings/classes
async function createClass(req, res) {
  const { name, order_index, is_active } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Class name is required.' });
  }
  try {
    const result = await db.query(
      `INSERT INTO \`classes\` (\`name\`, \`order_index\`, \`is_active\`) VALUES (?, ?, ?)`,
      [name.trim(), order_index ?? 0, is_active !== false ? 1 : 0]
    );
    const newClass = await db.queryOne('SELECT * FROM `classes` WHERE `id` = ?', [result.insertId]);
    return res.status(201).json({ success: true, message: 'Class created.', class: newClass });
  } catch (err) {
    console.error('[settingsController.createClass]', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Class name already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create class.' });
  }
}

// DELETE /api/settings/classes/:id
async function deleteClass(req, res) {
  const { id } = req.params;
  try {
    // Check if class has students
    const studentCount = await db.queryOne(
      'SELECT COUNT(*) as cnt FROM `students` WHERE `class_id` = ?',
      [id]
    );
    if (studentCount.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete class with enrolled students. Reassign students first.',
      });
    }
    // Check if class has sections
    const sectionCount = await db.queryOne(
      'SELECT COUNT(*) as cnt FROM `sections` WHERE `class_id` = ?',
      [id]
    );
    if (sectionCount.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete class with sections. Delete sections first.',
      });
    }
    const result = await db.query('DELETE FROM `classes` WHERE `id` = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }
    return res.json({ success: true, message: 'Class deleted.' });
  } catch (err) {
    console.error('[settingsController.deleteClass]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete class.' });
  }
}

/**
 * SECTIONS
 */

// GET /api/settings/sections
async function getSections(req, res) {
  try {
    const sections = await db.query(
      `SELECT s.*, c.name as class_name
       FROM \`sections\` s
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       ORDER BY c.\`order_index\` ASC, s.\`name\` ASC`
    );
    return res.json({ success: true, sections });
  } catch (err) {
    console.error('[settingsController.getSections]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch sections.' });
  }
}

// POST /api/settings/sections
async function createSection(req, res) {
  const { name, class_id, is_active } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Section name is required.' });
  }
  if (!class_id) {
    return res.status(400).json({ success: false, message: 'Class ID is required.' });
  }
  try {
    const result = await db.query(
      `INSERT INTO \`sections\` (\`name\`, \`class_id\`, \`is_active\`) VALUES (?, ?, ?)`,
      [name.trim(), class_id, is_active !== false ? 1 : 0]
    );
    const newSection = await db.queryOne(
      `SELECT s.*, c.name as class_name FROM \`sections\` s LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\` WHERE s.\`id\` = ?`,
      [result.insertId]
    );
    return res.status(201).json({ success: true, message: 'Section created.', section: newSection });
  } catch (err) {
    console.error('[settingsController.createSection]', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Section already exists in this class.' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: 'Invalid class ID.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create section.' });
  }
}

// DELETE /api/settings/sections/:id
async function deleteSection(req, res) {
  const { id } = req.params;
  try {
    const studentCount = await db.queryOne(
      'SELECT COUNT(*) as cnt FROM `students` WHERE `section_id` = ?',
      [id]
    );
    if (studentCount.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete section with enrolled students. Reassign students first.',
      });
    }
    const result = await db.query('DELETE FROM `sections` WHERE `id` = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }
    return res.json({ success: true, message: 'Section deleted.' });
  } catch (err) {
    console.error('[settingsController.deleteSection]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete section.' });
  }
}

/**
 * FEE STRUCTURES (Day Scholar / Hosteller monthly rates)
 */

// GET /api/settings/fee-structures
async function getFeeStructures(req, res) {
  try {
    const structures = await db.query(
      'SELECT * FROM `fee_structures` ORDER BY `category` ASC'
    );
    return res.json({ success: true, fee_structures: structures });
  } catch (err) {
    console.error('[settingsController.getFeeStructures]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch fee structures.' });
  }
}

// POST /api/settings/fee-structures (UPSERT handler)
async function createFeeStructure(req, res) {
  const { category, amount, effective_from, is_active } = req.body || {};
  if (!category || !['day_scholar', 'hosteller'].includes(category)) {
    return res.status(400).json({ success: false, message: 'Category must be "day_scholar" or "hosteller".' });
  }
  if (amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Valid amount is required.' });
  }
  try {
    // Check if fee structure for category already exists
    const existing = await db.queryOne('SELECT `id` FROM `fee_structures` WHERE `category` = ? LIMIT 1', [category]);
    if (existing) {
      await db.query(
        'UPDATE `fee_structures` SET `amount` = ?, `effective_from` = ?, `is_active` = ? WHERE `id` = ?',
        [Number(amount), effective_from || new Date().toISOString().slice(0, 10), is_active !== false ? 1 : 0, existing.id]
      );
      const fs = await db.queryOne('SELECT * FROM `fee_structures` WHERE `id` = ?', [existing.id]);
      return res.json({ success: true, message: 'Fee structure updated.', fee_structure: fs });
    }

    const result = await db.query(
      `INSERT INTO \`fee_structures\` (\`category\`, \`amount\`, \`effective_from\`, \`is_active\`)
       VALUES (?, ?, ?, ?)`,
      [category, Number(amount), effective_from || new Date().toISOString().slice(0, 10), is_active !== false ? 1 : 0]
    );
    const newFs = await db.queryOne('SELECT * FROM `fee_structures` WHERE `id` = ?', [result.insertId]);
    return res.status(201).json({ success: true, message: 'Fee structure created.', fee_structure: newFs });
  } catch (err) {
    console.error('[settingsController.createFeeStructure]', err);
    return res.status(500).json({ success: false, message: 'Failed to save fee structure.' });
  }
}

// PUT /api/settings/fee-structures/:id
async function updateFeeStructure(req, res) {
  const { id } = req.params;
  const allowed = ['amount', 'effective_from', 'is_active'];
  const update = buildUpdateSql('fee_structures', allowed, req.body, id);
  if (!update) {
    return res.status(400).json({ success: false, message: 'No valid fields to update.' });
  }
  try {
    await db.query(update.sql, update.values);
    const fs = await db.queryOne('SELECT * FROM `fee_structures` WHERE `id` = ?', [id]);
    return res.json({ success: true, message: 'Fee structure updated.', fee_structure: fs });
  } catch (err) {
    console.error('[settingsController.updateFeeStructure]', err);
    return res.status(500).json({ success: false, message: 'Failed to update fee structure.' });
  }
}

// DELETE /api/settings/fee-structures/:id
async function deleteFeeStructure(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM `fee_structures` WHERE `id` = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Fee structure not found.' });
    }
    return res.json({ success: true, message: 'Fee structure deleted.' });
  } catch (err) {
    console.error('[settingsController.deleteFeeStructure]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete fee structure.' });
  }
}

/**
 * FEE TYPES (custom charges: Admission, Exam, Transport, etc.)
 */

// GET /api/settings/fee-types
async function getFeeTypes(req, res) {
  try {
    const types = await db.query(
      'SELECT * FROM `fee_types` ORDER BY `name` ASC'
    );
    return res.json({ success: true, fee_types: types });
  } catch (err) {
    console.error('[settingsController.getFeeTypes]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch fee types.' });
  }
}

// POST /api/settings/fee-types
async function createFeeType(req, res) {
  const { name, description, is_recurring, is_active } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Fee type name is required.' });
  }
  try {
    const result = await db.query(
      `INSERT INTO \`fee_types\` (\`name\`, \`description\`, \`is_recurring\`, \`is_active\`)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), description || '', is_recurring ? 1 : 0, is_active !== false ? 1 : 0]
    );
    const newFt = await db.queryOne('SELECT * FROM `fee_types` WHERE `id` = ?', [result.insertId]);
    return res.status(201).json({ success: true, message: 'Fee type created.', fee_type: newFt });
  } catch (err) {
    console.error('[settingsController.createFeeType]', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Fee type name already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create fee type.' });
  }
}

// PUT /api/settings/fee-types/:id
async function updateFeeType(req, res) {
  const { id } = req.params;
  const allowed = ['name', 'description', 'is_recurring', 'is_active'];
  const update = buildUpdateSql('fee_types', allowed, req.body, id);
  if (!update) {
    return res.status(400).json({ success: false, message: 'No valid fields to update.' });
  }
  try {
    await db.query(update.sql, update.values);
    const ft = await db.queryOne('SELECT * FROM `fee_types` WHERE `id` = ?', [id]);
    return res.json({ success: true, message: 'Fee type updated.', fee_type: ft });
  } catch (err) {
    console.error('[settingsController.updateFeeType]', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Fee type name already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to update fee type.' });
  }
}

// DELETE /api/settings/fee-types/:id
async function deleteFeeType(req, res) {
  const { id } = req.params;
  try {
    // Check if fee type is in use
    const usageCount = await db.queryOne(
      'SELECT COUNT(*) as cnt FROM `student_additional_fees` WHERE `fee_type_id` = ?',
      [id]
    );
    if (usageCount.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete fee type that is assigned to students. Unassign first.',
      });
    }
    const result = await db.query('DELETE FROM `fee_types` WHERE `id` = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Fee type not found.' });
    }
    return res.json({ success: true, message: 'Fee type deleted.' });
  } catch (err) {
    console.error('[settingsController.deleteFeeType]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete fee type.' });
  }
}

module.exports = {
  getSchool,
  updateSchool,
  getClasses,
  createClass,
  deleteClass,
  getSections,
  createSection,
  deleteSection,
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getFeeTypes,
  createFeeType,
  updateFeeType,
  deleteFeeType,
};