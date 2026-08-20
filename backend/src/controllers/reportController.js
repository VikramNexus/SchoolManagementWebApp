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
  const { search, class_id, category, page = 1, limit = 50 } = req.query || {};

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
          (SELECT SUM(saf.amount)
           FROM student_additional_fees saf
           WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')), 0
        ) as additional_dues
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      ${whereClause}
      HAVING (monthly_dues + additional_dues) > 0
      ORDER BY (monthly_dues + additional_dues) DESC
      LIMIT ? OFFSET ?
    `;

    const students = await db.query(dataSql, [...values, numLimit, numOffset]);

    // Calculate totals matching the filtered criteria without cartesian product
    const totalsSql = `
      SELECT
        COUNT(DISTINCT student_id) as total_students,
        COALESCE(SUM(monthly_due), 0) as total_monthly_dues,
        COALESCE(SUM(add_due), 0) as total_additional_dues,
        COALESCE(SUM(total_due), 0) as total_outstanding
      FROM (
        SELECT
          s.id as student_id,
          COALESCE(
            (SELECT SUM(mf.due_amount)
             FROM monthly_fees mf
             WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0
          ) as monthly_due,
          COALESCE(
            (SELECT SUM(saf.amount)
             FROM student_additional_fees saf
             WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')), 0
          ) as add_due,
          (
            COALESCE((SELECT SUM(mf.due_amount) FROM monthly_fees mf WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0) +
            COALESCE((SELECT SUM(saf.amount) FROM student_additional_fees saf WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')), 0)
          ) as total_due
        FROM students s
        ${whereClause}
      ) sub
      WHERE total_due > 0
    `;
    const totals = await db.queryOne(totalsSql, values);

    const formattedStudents = students.map(s => ({
      ...s,
      monthly_dues: Number(s.monthly_dues),
      additional_dues: Number(s.additional_dues),
      total_dues: Number(s.monthly_dues) + Number(s.additional_dues),
    }));

    return res.json({
      success: true,
      students: formattedStudents,
      summary: {
        total_students_with_dues: totals ? Number(totals.total_students) : 0,
        total_outstanding: totals ? Number(totals.total_outstanding) : 0,
        total_monthly_dues: totals ? Number(totals.total_monthly_dues) : 0,
        total_additional_dues: totals ? Number(totals.total_additional_dues) : 0,
      },
    });
  } catch (err) {
    console.error('[reportController.getPendingDuesList]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending dues list.' });
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
       ORDER BY c.order_index ASC`
    );

    const byCategory = await db.query(
      `SELECT category, COUNT(*) as count
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
  getDemographicsReport,
  getCollectionsReport,
};
