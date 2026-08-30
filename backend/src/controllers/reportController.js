/**
 * Report Controller — School Management System
 * Executive Intelligence, Financial Day-Book, Defaulter Tracking & Auditing
 */

const db = require('../config/db');

/**
 * GET /api/reports/executive-overview
 * Complete 4-Pillar Executive Intelligence Dashboard in 1 High-Speed Query
 */
async function getExecutiveOverview(req, res) {
  try {
    // 1. Today's Day-Book Reconciliation
    const todaySummary = await db.queryOne(`
      SELECT
        COALESCE(SUM(amount), 0) as today_total,
        COALESCE(SUM(CASE WHEN payment_mode = 'CASH' THEN amount ELSE 0 END), 0) as today_cash,
        COALESCE(SUM(CASE WHEN payment_mode = 'IN_ACCOUNT' THEN amount ELSE 0 END), 0) as today_bank,
        COUNT(id) as today_transactions
      FROM payments
      WHERE DATE(payment_date) = CURDATE()
    `);

    // Today's Recent Receipts
    const todayReceipts = await db.query(`
      SELECT
        p.id,
        p.amount,
        p.payment_mode,
        p.payment_date,
        p.receipt_number,
        s.id as student_id,
        s.full_name as student_name,
        s.admission_no,
        s.phone,
        s.whatsapp_number,
        c.name as class_name
      FROM payments p
      LEFT JOIN students s ON s.id = p.student_id
      LEFT JOIN classes c ON c.id = s.class_id
      WHERE DATE(p.payment_date) = CURDATE()
      ORDER BY p.id DESC
      LIMIT 10
    `);

    // 2. Overall Financial Snapshot
    const overallFinancials = await db.queryOne(`
      SELECT
        (SELECT COALESCE(SUM(fee_amount), 0) FROM monthly_fees) + (SELECT COALESCE(SUM(amount), 0) FROM student_additional_fees) as total_assessed,
        (SELECT COALESCE(SUM(amount), 0) FROM payments) as total_collected,
        (SELECT COALESCE(SUM(due_amount), 0) FROM monthly_fees WHERE status IN ('DUE', 'PARTIAL')) + (SELECT COALESCE(SUM(GREATEST(0, amount - paid_amount - discount_amount)), 0) FROM student_additional_fees WHERE status IN ('DUE', 'PARTIAL')) as total_outstanding
    `);

    const assessed = Number(overallFinancials?.total_assessed || 0);
    const collected = Number(overallFinancials?.total_collected || 0);
    const outstanding = Number(overallFinancials?.total_outstanding || 0);
    const recoveryRate = assessed > 0 ? ((collected / assessed) * 100).toFixed(1) : 0;

    // 3. Class-Wise Performance & Recovery Matrix
    const classMatrix = await db.query(`
      SELECT
        c.id as class_id,
        c.name as class_name,
        COUNT(DISTINCT s.id) as student_count,
        COALESCE((SELECT SUM(mf.fee_amount) FROM monthly_fees mf JOIN students s2 ON s2.id = mf.student_id WHERE s2.class_id = c.id AND s2.status = 'active'), 0) +
        COALESCE((SELECT SUM(saf.amount) FROM student_additional_fees saf JOIN students s2 ON s2.id = saf.student_id WHERE s2.class_id = c.id AND s2.status = 'active'), 0) as assessed_fee,
        COALESCE((SELECT SUM(p.amount) FROM payments p JOIN students s2 ON s2.id = p.student_id WHERE s2.class_id = c.id AND s2.status = 'active'), 0) as collected_fee,
        COALESCE((SELECT SUM(mf.due_amount) FROM monthly_fees mf JOIN students s2 ON s2.id = mf.student_id WHERE s2.class_id = c.id AND s2.status = 'active' AND mf.status IN ('DUE', 'PARTIAL')), 0) +
        COALESCE((SELECT SUM(GREATEST(0, saf.amount - saf.paid_amount - saf.discount_amount)) FROM student_additional_fees saf JOIN students s2 ON s2.id = saf.student_id WHERE s2.class_id = c.id AND s2.status = 'active' AND saf.status IN ('DUE', 'PARTIAL')), 0) as due_fee
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
      GROUP BY c.id, c.name, c.order_index
      ORDER BY c.order_index ASC
    `);

    const formattedClassMatrix = classMatrix.map((cm) => {
      const a = Number(cm.assessed_fee || 0);
      const col = Number(cm.collected_fee || 0);
      const d = Number(cm.due_fee || 0);
      const rate = a > 0 ? ((col / a) * 100).toFixed(1) : 0;
      return {
        ...cm,
        student_count: Number(cm.student_count || 0),
        assessed_fee: a,
        collected_fee: col,
        due_fee: d,
        recovery_rate: Number(rate),
      };
    });

    // 4. Payment Mode Breakdown
    const modeSplit = await db.query(`
      SELECT
        payment_mode,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(id) as transaction_count
      FROM payments
      GROUP BY payment_mode
    `);

    // 5. Fee Heads Split (Tuition vs Admission)
    const feeHeads = await db.queryOne(`
      SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_category != 'ADMISSION_CHARGE' AND (notes IS NULL OR notes NOT LIKE '%Admission%')) as tuition_collected,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_category = 'ADMISSION_CHARGE' OR notes LIKE '%Admission%' OR notes LIKE '%Enrollment%') as admission_collected
    `);

    // 6. Demographics & Capacity
    const demographics = await db.queryOne(`
      SELECT
        (SELECT COUNT(id) FROM students WHERE status = 'active') as total_active_students,
        (SELECT COUNT(id) FROM students WHERE status = 'active' AND category = 'hosteller') as hosteller_count,
        (SELECT COUNT(id) FROM students WHERE status = 'active' AND (category != 'hosteller' OR category IS NULL)) as day_scholar_count,
        (SELECT COUNT(DISTINCT family_id) FROM students WHERE status = 'active' AND family_id IS NOT NULL) as total_families
    `);

    // 7. Monthly Trend (Last 6 Months)
    const monthlyTrends = await db.query(`
      SELECT
        DATE_FORMAT(payment_date, '%b %Y') as month_label,
        DATE_FORMAT(payment_date, '%Y-%m') as month_key,
        COALESCE(SUM(amount), 0) as total_collected,
        COUNT(id) as transaction_count
      FROM payments
      WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(payment_date, '%Y-%m'), DATE_FORMAT(payment_date, '%b %Y')
      ORDER BY month_key ASC
    `);

    return res.json({
      success: true,
      data: {
        today: {
          total: Number(todaySummary?.today_total || 0),
          cash: Number(todaySummary?.today_cash || 0),
          bank: Number(todaySummary?.today_bank || 0),
          transactions: Number(todaySummary?.today_transactions || 0),
          recent_receipts: todayReceipts,
        },
        financials: {
          assessed,
          collected,
          outstanding,
          recovery_rate: Number(recoveryRate),
        },
        classes: formattedClassMatrix,
        modes: modeSplit.map((m) => ({
          mode: m.payment_mode,
          amount: Number(m.total_amount || 0),
          count: Number(m.transaction_count || 0),
        })),
        fee_heads: {
          tuition: Number(feeHeads?.tuition_collected || 0),
          admission: Number(feeHeads?.admission_collected || 0),
        },
        demographics: {
          total_students: Number(demographics?.total_active_students || 0),
          hostellers: Number(demographics?.hosteller_count || 0),
          day_scholars: Number(demographics?.day_scholar_count || 0),
          families: Number(demographics?.total_families || 0),
        },
        trends: monthlyTrends.map((t) => ({
          month: t.month_label,
          collected: Number(t.total_collected || 0),
          count: Number(t.transaction_count || 0),
        })),
      },
    });
  } catch (err) {
    console.error('[reportController.getExecutiveOverview]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch executive overview: ' + err.message });
  }
}

/**
 * GET /api/reports/pending-dues-list
 * List all active students with outstanding dues breakdown & aging tier
 */
async function getPendingDuesList(req, res) {
  const { tab, type, search, class_id, category, aging, page = 1, limit = 50 } = req.query || {};
  const isMonthlyOnly = (tab === 'monthly' || type === 'monthly');

  try {
    const conditions = ["s.`status` = 'active'"];
    const values = [];

    if (search) {
      conditions.push('(s.`admission_no` LIKE ? OR s.`full_name` LIKE ? OR s.`phone` LIKE ? OR s.`father_name` LIKE ? OR s.`parent_name` LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term, term, term);
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

    let havingCondition = isMonthlyOnly ? 'HAVING monthly_dues > 0' : 'HAVING (monthly_dues + additional_dues) > 0';

    if (aging === 'mild') {
      havingCondition += ' AND overdue_months <= 1';
    } else if (aging === 'moderate') {
      havingCondition += ' AND overdue_months = 2';
    } else if (aging === 'critical') {
      havingCondition += ' AND overdue_months >= 3';
    }

    const orderClause = isMonthlyOnly ? 'ORDER BY monthly_dues DESC' : 'ORDER BY (monthly_dues + additional_dues) DESC';

    const dataSql = `
      SELECT
        s.id,
        s.admission_no,
        s.full_name,
        COALESCE(NULLIF(s.father_name, ''), NULLIF(s.parent_name, ''), '—') as father_name,
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
          (SELECT COUNT(mf.id)
           FROM monthly_fees mf
           WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0
        ) as overdue_months,
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

    // Calculate totals
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
            (SELECT COUNT(mf.id)
             FROM monthly_fees mf
             WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0
          ) as overdue_months,
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
      ${aging === 'mild' ? 'AND overdue_months <= 1' : aging === 'moderate' ? 'AND overdue_months = 2' : aging === 'critical' ? 'AND overdue_months >= 3' : ''}
    `;
    const totals = await db.queryOne(totalsSql, values);

    const formattedStudents = students.map((s) => {
      const mDue = Number(s.monthly_dues);
      const aDue = Number(s.additional_dues);
      const tot = isMonthlyOnly ? mDue : mDue + aDue;
      const months = Number(s.overdue_months || 0);
      let tier = 'mild';
      if (months >= 3 || tot >= 5000) tier = 'critical';
      else if (months === 2 || tot >= 2000) tier = 'moderate';

      return {
        ...s,
        monthly_dues: mDue,
        additional_dues: aDue,
        total_dues: tot,
        overdue_months: months,
        tier,
      };
    });

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
        COALESCE(NULLIF(s.father_name, ''), NULLIF(s.parent_name, ''), '—') as father_name,
        s.parent_name,
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
      },
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
    const byClass = await db.query(`
      SELECT
        c.name as class_name,
        COUNT(s.id) as student_count,
        COUNT(CASE WHEN s.category = 'hosteller' THEN 1 END) as hosteller_count,
        COUNT(CASE WHEN s.category != 'hosteller' OR s.category IS NULL THEN 1 END) as day_scholar_count
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
      GROUP BY c.id, c.name, c.order_index
      ORDER BY c.order_index ASC
    `);

    const byCategory = await db.query(`
      SELECT category, COUNT(id) as count
      FROM students
      WHERE status = 'active'
      GROUP BY category
    `);

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
    const monthlyCollections = await db.query(`
      SELECT
        DATE_FORMAT(payment_date, '%Y-%m') as month,
        SUM(amount) as total_collected,
        COUNT(id) as transaction_count
      FROM payments
      GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `);

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
  getExecutiveOverview,
  getPendingDuesList,
  getAdmissionDuesList,
  getDemographicsReport,
  getCollectionsReport,
};
