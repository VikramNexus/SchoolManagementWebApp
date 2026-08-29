/**
 * Report Controller — School Management System
 *
 * Day 9: Reminders, Messages & Financial Reports.
 */

const db = require('../config/db');

/**
 * GET /api/reports/pending-dues-list
 * List all active students with outstanding dues breakdown
 */
async function getPendingDuesList(req, res) {
  const { tab, type, search, class_id, category, page = 1, limit = 50 } = req.query || {};
  const isMonthlyOnly = (tab === 'monthly' || type === 'monthly');

  try {
    const conditions = ["s.`status` = 'active'"];
    const values = [];

    if (search) {
      conditions.push('(s.`admission_no` LIKE ? OR s.`full_name` LIKE ? OR s.`phone` LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term);
    }
    if (class_id) {
      conditions.push('s.`class_id` = ?');
      values.push(Number(class_id));
    }
    if (category) {
      conditions.push('s.`category` = ?');
      values.push(category);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const numLimit = Math.max(1, Number(limit) || 50);
    const numPage = Math.max(1, Number(page) || 1);
    const numOffset = (numPage - 1) * numLimit;

    const havingCondition = isMonthlyOnly ? 'HAVING monthly_dues > 0' : 'HAVING (monthly_dues + additional_dues) > 0';
    const orderClause = isMonthlyOnly ? 'ORDER BY monthly_dues DESC' : 'ORDER BY (monthly_dues + additional_dues) DESC';

    // Fetch students with monthly and additional dues aggregate
    const dataSql = `
      SELECT
        s.id,
        s.admission_no,
        s.full_name,
        s.parent_name,
        s.phone,
        s.whatsapp_number,
        s.category,
        c.name as class_name,
        sec.name as section_name,
        COALESCE(
          (SELECT SUM(mf.due_amount)
           FROM monthly_fees mf
           WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0
        ) as monthly_dues,
        COALESCE(
          (SELECT SUM(GREATEST(0, saf.amount - saf.paid_amount - saf.discount_amount))
           FROM student_additional_fees saf
           WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')), 0
        ) as additional_dues
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      ${whereClause}
      ${havingCondition}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const students = await db.query(dataSql, [...values, numLimit, numOffset]);

    // Calculate totals matching the filtered criteria without cartesian product
    const totalsSql = `
      SELECT
        COUNT(DISTINCT CASE WHEN ${isMonthlyOnly ? 'monthly_due > 0' : 'total_due > 0'} THEN student_id END) as total_students,
        COALESCE(SUM(monthly_due), 0) as total_monthly_dues,
        COALESCE(SUM(add_due), 0) as total_additional_dues,
        COALESCE(SUM(${isMonthlyOnly ? 'monthly_due' : 'total_due'}), 0) as total_outstanding
      FROM (
        SELECT
          s.id as student_id,
          COALESCE(
            (SELECT SUM(mf.due_amount)
             FROM monthly_fees mf
             WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0
          ) as monthly_due,
          COALESCE(
            (SELECT SUM(GREATEST(0, saf.amount - saf.paid_amount - saf.discount_amount))
             FROM student_additional_fees saf
             WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')), 0
          ) as add_due,
          (
            COALESCE((SELECT SUM(mf.due_amount) FROM monthly_fees mf WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0) +
            COALESCE((SELECT SUM(GREATEST(0, saf.amount - saf.paid_amount - saf.discount_amount)) FROM student_additional_fees saf WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')), 0)
          ) as total_due
        FROM students s
        ${whereClause}
      ) sub
      WHERE ${isMonthlyOnly ? 'monthly_due > 0' : 'total_due > 0'}
    `;
    const totals = await db.queryOne(totalsSql, values);

    const formattedStudents = students.map(s => ({
      ...s,
      monthly_dues: Number(s.monthly_dues),
      additional_dues: Number(s.additional_dues),
      total_dues: isMonthlyOnly ? Number(s.monthly_dues) : Number(s.monthly_dues) + Number(s.additional_dues),
    }));

    return res.json({
      success: true,
      students: formattedStudents,
      summary: {
        total_students_with_dues: totals?.total_students || 0,
        total_monthly_dues: Number(totals?.total_monthly_dues || 0),
        total_additional_dues: Number(totals?.total_additional_dues || 0),
        total_outstanding: Number(totals?.total_outstanding || 0),
      },
      pagination: {
        page: numPage,
        limit: numLimit,
        total: totals?.total_students || 0,
        totalPages: Math.ceil((totals?.total_students || 0) / numLimit),
      },
    });
  } catch (err) {
    console.error('[reportController.getPendingDuesList]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending dues list.' });
  }
}

/**
 * GET /api/reports/admission-dues-list
 * List active students who have pending admission charges
 */
async function getAdmissionDuesList(req, res) {
  const { search, class_id, category, page = 1, limit = 50 } = req.query || {};

  try {
    const conditions = ["s.`status` = 'active'"];
    const values = [];

    if (search) {
      conditions.push('(s.`admission_no` LIKE ? OR s.`full_name` LIKE ? OR s.`phone` LIKE ? OR s.`whatsapp_number` LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term, term);
    }
    if (class_id) {
      conditions.push('s.`class_id` = ?');
      values.push(Number(class_id));
    }
    if (category) {
      conditions.push('s.`category` = ?');
      values.push(category);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const numLimit = Math.max(1, Number(limit) || 50);
    const numPage = Math.max(1, Number(page) || 1);
    const numOffset = (numPage - 1) * numLimit;

    const dataSql = `
      SELECT
        s.id,
        s.admission_no,
        s.full_name,
        s.parent_name,
        s.father_name,
        s.mother_name,
        s.phone,
        s.whatsapp_number,
        s.category,
        s.admission_date,
        c.name as class_name,
        sec.name as section_name,
        COALESCE((
          SELECT SUM(saf.amount) FROM student_additional_fees saf WHERE saf.student_id = s.id
        ), 0) as total_assessed_admission,
        COALESCE((
          SELECT SUM(saf.paid_amount) FROM student_additional_fees saf WHERE saf.student_id = s.id
        ), 0) as admission_paid,
        COALESCE((
          SELECT SUM(saf.discount_amount) FROM student_additional_fees saf WHERE saf.student_id = s.id
        ), 0) as admission_discount,
        COALESCE((
          SELECT SUM(GREATEST(0, saf.amount - saf.paid_amount - saf.discount_amount))
          FROM student_additional_fees saf
          WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')
        ), 0) as admission_dues
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      ${whereClause}
      HAVING admission_dues > 0
      ORDER BY admission_dues DESC
      LIMIT ? OFFSET ?
    `;

    const students = await db.query(dataSql, [...values, numLimit, numOffset]);

    const countSql = `
      SELECT COUNT(*) as total_students, COALESCE(SUM(admission_dues), 0) as total_admission_dues
      FROM (
        SELECT s.id,
               COALESCE((
                 SELECT SUM(GREATEST(0, saf.amount - saf.paid_amount - saf.discount_amount))
                 FROM student_additional_fees saf
                 WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')
               ), 0) as admission_dues
        FROM students s
        ${whereClause}
        HAVING admission_dues > 0
      ) sub
    `;

    const summaryResult = await db.queryOne(countSql, values);

    return res.json({
      success: true,
      students,
      summary: {
        total_students_with_dues: summaryResult?.total_students || 0,
        total_admission_dues: Number(summaryResult?.total_admission_dues || 0),
      },
      pagination: {
        page: numPage,
        limit: numLimit,
        total: summaryResult?.total_students || 0,
        totalPages: Math.ceil((summaryResult?.total_students || 0) / numLimit),
      }
    });
  } catch (err) {
    console.error('[reportController.getAdmissionDuesList]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch admission dues list: ' + err.message });
  }
}

/**
 * GET /api/reports/demographics
 */
async function getDemographicsReport(req, res) {
  try {
    const byClass = await db.query(
      `SELECT c.name as class_name, COUNT(s.id) as student_count
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
       GROUP BY c.id, c.name
       ORDER BY c.sort_order ASC`
    );

    const byCategory = await db.query(
      `SELECT category, COUNT(id) as count
       FROM students
       WHERE status = 'active'
       GROUP BY category`
    );

    return res.json({
      success: true,
      by_class: byClass,
      by_category: byCategory,
    });
  } catch (err) {
    console.error('[reportController.getDemographicsReport]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch demographics report.' });
  }
}

/**
 * GET /api/reports/collections
 */
async function getCollectionsReport(req, res) {
  try {
    const monthlyCollections = await db.query(
      `SELECT
        DATE_FORMAT(payment_date, '%Y-%m') as month,
        SUM(amount) as total_collected,
        COUNT(id) as transaction_count
       FROM payments
       GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
       ORDER BY month DESC
       LIMIT 12`
    );

    return res.json({
      success: true,
      collections: monthlyCollections,
    });
  } catch (err) {
    console.error('[reportController.getCollectionsReport]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch collections report.' });
  }
}

module.exports = {
  getPendingDuesList,
  getAdmissionDuesList,
  getDemographicsReport,
  getCollectionsReport,
};
