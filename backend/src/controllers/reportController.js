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
 * List active students/families with outstanding dues breakdown & aging tier (Unified Sibling Aggregation)
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
        s.family_id,
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
    `;

    const rawStudents = await db.query(dataSql, values);

    // Group siblings by family_id
    const familyMap = new Map();
    const individualList = [];

    rawStudents.forEach((r) => {
      const mDue = Number(r.monthly_dues || 0);
      const aDue = Number(r.additional_dues || 0);
      const tot = isMonthlyOnly ? mDue : mDue + aDue;
      const months = Number(r.overdue_months || 0);
      const classLabel = `${r.class_name || ''}${r.section_name ? ` (${r.section_name})` : ''}`.trim() || '—';

      const formatted = {
        ...r,
        monthly_dues: mDue,
        additional_dues: aDue,
        total_dues: tot,
        overdue_months: months,
        class_label: classLabel,
      };

      if (r.family_id) {
        if (!familyMap.has(r.family_id)) {
          familyMap.set(r.family_id, []);
        }
        familyMap.get(r.family_id).push(formatted);
      } else {
        individualList.push(formatted);
      }
    });

    const aggregatedList = [];

    // Process families
    for (const [famId, siblings] of familyMap.entries()) {
      if (siblings.length === 1) {
        const s = siblings[0];
        let tier = 'mild';
        if (s.overdue_months >= 3 || s.total_dues >= 5000) tier = 'critical';
        else if (s.overdue_months === 2 || s.total_dues >= 2000) tier = 'moderate';

        aggregatedList.push({
          ...s,
          is_family: false,
          sibling_count: 1,
          sibling_ids: [s.id],
          tier,
        });
      } else {
        const primary = siblings[0];
        const combinedNames = siblings.map((s) => `${s.full_name} (${s.class_label})`).join(' & ');
        const rawNames = siblings.map((s) => s.full_name).join(' & ');
        const combinedAdmNos = siblings.map((s) => s.admission_no).join(', ');
        const combinedClasses = siblings.map((s) => s.class_label).join(', ');
        const totalMonthly = siblings.reduce((sum, s) => sum + s.monthly_dues, 0);
        const totalAdditional = siblings.reduce((sum, s) => sum + s.additional_dues, 0);
        const totalOverall = totalMonthly + totalAdditional;
        const maxMonths = Math.max(...siblings.map((s) => s.overdue_months));

        let tier = 'mild';
        if (maxMonths >= 3 || totalOverall >= 5000) tier = 'critical';
        else if (maxMonths === 2 || totalOverall >= 2000) tier = 'moderate';

        aggregatedList.push({
          ...primary,
          id: primary.id,
          is_family: true,
          family_id: famId,
          sibling_count: siblings.length,
          sibling_ids: siblings.map((s) => s.id),
          full_name: combinedNames,
          raw_names: rawNames,
          admission_no: combinedAdmNos,
          class_name: combinedClasses,
          monthly_dues: totalMonthly,
          additional_dues: totalAdditional,
          total_dues: totalOverall,
          overdue_months: maxMonths,
          tier,
          siblings_detail: siblings,
        });
      }
    }

    // Add individual students
    individualList.forEach((s) => {
      let tier = 'mild';
      if (s.overdue_months >= 3 || s.total_dues >= 5000) tier = 'critical';
      else if (s.overdue_months === 2 || s.total_dues >= 2000) tier = 'moderate';

      aggregatedList.push({
        ...s,
        is_family: false,
        sibling_count: 1,
        sibling_ids: [s.id],
        tier,
      });
    });

    // Sort by total_dues DESC
    aggregatedList.sort((a, b) => b.total_dues - a.total_dues);

    // Calculate pagination slice
    const totalItems = aggregatedList.length;
    const paginatedStudents = aggregatedList.slice(numOffset, numOffset + numLimit);

    const totalMonthlyDues = aggregatedList.reduce((sum, s) => sum + s.monthly_dues, 0);
    const totalAdditionalDues = aggregatedList.reduce((sum, s) => sum + s.additional_dues, 0);
    const totalOutstanding = totalMonthlyDues + totalAdditionalDues;

    return res.json({
      success: true,
      students: paginatedStudents,
      summary: {
        total_students_with_dues: totalItems,
        total_monthly_dues: totalMonthlyDues,
        total_additional_dues: totalAdditionalDues,
        total_outstanding: totalOutstanding,
      },
      pagination: {
        page: numPage,
        limit: numLimit,
        total: totalItems,
        totalPages: Math.ceil(totalItems / numLimit),
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

/**
 * GET /api/reports/export-collections-excel
 * Generate Custom Filtered Excel Sheet of Collections (Day-Book, Weekly, Monthly, Session, Custom Date)
 */
const ExcelJS = require('exceljs');

/**
 * GET /api/reports/export-collections-excel
 * Generate Clean, Compact, High-Contrast B&W Monochrome Collections Excel with Student Details
 */
async function exportCollectionsExcel(req, res) {
  try {
    const { preset = 'today', from_date, to_date, class_id, payment_mode } = req.query || {};

    const conditions = [];
    const values = [];

    let dateDesc = '';
    const todayStr = new Date().toISOString().slice(0, 10);

    if (preset === 'today') {
      conditions.push('DATE(p.payment_date) = CURDATE()');
      dateDesc = `Today's Day-Book (${todayStr})`;
    } else if (preset === 'this_week') {
      conditions.push('YEARWEEK(p.payment_date, 1) = YEARWEEK(CURDATE(), 1)');
      dateDesc = `This Week's Collections`;
    } else if (preset === 'this_month') {
      conditions.push('YEAR(p.payment_date) = YEAR(CURDATE()) AND MONTH(p.payment_date) = MONTH(CURDATE())');
      dateDesc = `Month Collections (${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })})`;
    } else if (preset === 'session') {
      dateDesc = `Session 2025–2026 Full Collections`;
    } else if (preset === 'custom' && from_date && to_date) {
      conditions.push('DATE(p.payment_date) >= ? AND DATE(p.payment_date) <= ?');
      values.push(from_date, to_date);
      dateDesc = `Collections (${from_date} to ${to_date})`;
    }

    if (class_id) {
      conditions.push('s.class_id = ?');
      values.push(Number(class_id));
    }
    if (payment_mode) {
      conditions.push('p.payment_mode = ?');
      values.push(payment_mode);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await db.query(`
      SELECT
        p.id,
        p.payment_date,
        p.amount,
        p.payment_mode,
        p.notes,
        s.admission_no,
        s.full_name as student_name,
        COALESCE(NULLIF(s.father_name, ''), NULLIF(s.parent_name, ''), '—') as father_name,
        COALESCE(NULLIF(s.phone, ''), NULLIF(s.whatsapp_number, ''), '—') as contact_number,
        c.name as class_name,
        sec.name as section_name,
        s.category
      FROM payments p
      LEFT JOIN students s ON s.id = p.student_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      ${whereClause}
      ORDER BY p.payment_date DESC, p.id DESC
    `, values);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Aryavart (P.S.G) Shikshan Sansthan';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Collection Register', {
      views: [{ showGridLines: true }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    const endColLetter = 'K';

    // 1. School Header Banner (High-Contrast B&W)
    sheet.mergeCells(`A1:${endColLetter}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'ARYAVART (P.S.G) SHIKSHAN SANSTHAN';
    titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 24;

    // 2. Subtitle Banner
    sheet.mergeCells(`A2:${endColLetter}2`);
    const subCell = sheet.getCell('A2');
    subCell.value = `FEE COLLECTION REGISTER • ${dateDesc.toUpperCase()} • PRINTED ON ${new Date().toLocaleString('en-IN')}`;
    subCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF333333' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 18;

    sheet.addRow([]);
    sheet.getRow(3).height = 6;

    // 3. Clean Table Headers
    const headers = [
      'S.No',
      'Date',
      'Adm No',
      'Student Name',
      "Father's Name",
      'Contact No',
      'Class & Sec',
      'Category',
      'Payment Received (Rs.)',
      'Mode (Cash/Bank)',
      'Remarks',
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; // Light gray 10%
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
    });

    let totalAmount = 0;
    rows.forEach((r, idx) => {
      const amt = Number(r.amount || 0);
      totalAmount += amt;
      const dataRow = sheet.addRow([
        idx + 1,
        r.payment_date ? new Date(r.payment_date).toLocaleDateString('en-IN') : '—',
        r.admission_no || 'N/A',
        r.student_name || '—',
        r.father_name || '—',
        r.contact_number || '—',
        `${r.class_name || ''} ${r.section_name ? `(${r.section_name})` : ''}`.trim() || '—',
        r.category === 'hosteller' ? 'Hostel' : 'Day Scholar',
        amt,
        r.payment_mode === 'IN_ACCOUNT' ? 'Bank / UPI' : 'Cash',
        r.notes || '—',
      ]);

      dataRow.height = 20;
      const isEven = idx % 2 === 1;
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };

        if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 10) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 9) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00';
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // 4. Grand Total Row
    const totalRow = sheet.addRow([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'TOTAL RECEIVED:',
      totalAmount,
      `${rows.length} Txns`,
      '',
    ]);
    totalRow.height = 24;
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      if (colNumber === 8) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 9) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
    });

    // Exact Column Widths with generous padding to prevent ANY text clipping
    const widths = [7, 14, 16, 24, 22, 16, 15, 14, 25, 18, 42];
    sheet.columns.forEach((col, idx) => {
      col.width = widths[idx] || 16;
    });

    const filename = `Collections_${preset}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[reportController.exportCollectionsExcel]', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate collections Excel: ' + err.message });
    }
  }
}

/**
 * GET /api/reports/pending-dues-list
 * List active students/families with outstanding dues breakdown & aging tier
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
        s.family_id,
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
    `;

    const rawStudents = await db.query(dataSql, values);

    // Group siblings by family_id
    const familyMap = new Map();
    const individualList = [];

    rawStudents.forEach((r) => {
      const mDue = Number(r.monthly_dues || 0);
      const aDue = Number(r.additional_dues || 0);
      const tot = isMonthlyOnly ? mDue : mDue + aDue;
      const months = Number(r.overdue_months || 0);
      const classLabel = `${r.class_name || ''}${r.section_name ? ` (${r.section_name})` : ''}`.trim() || '—';

      const formatted = {
        ...r,
        monthly_dues: mDue,
        additional_dues: aDue,
        total_dues: tot,
        overdue_months: months,
        class_label: classLabel,
      };

      if (r.family_id) {
        if (!familyMap.has(r.family_id)) {
          familyMap.set(r.family_id, []);
        }
        familyMap.get(r.family_id).push(formatted);
      } else {
        individualList.push(formatted);
      }
    });

    const aggregatedList = [];

    // Process families
    for (const [famId, siblings] of familyMap.entries()) {
      if (siblings.length === 1) {
        const s = siblings[0];
        let tier = 'mild';
        if (s.overdue_months >= 3 || s.total_dues >= 5000) tier = 'critical';
        else if (s.overdue_months === 2 || s.total_dues >= 2000) tier = 'moderate';

        aggregatedList.push({
          ...s,
          is_family: false,
          sibling_count: 1,
          sibling_ids: [s.id],
          tier,
        });
      } else {
        const primary = siblings[0];
        const combinedNames = siblings.map((s) => `${s.full_name} (${s.class_label})`).join(' & ');
        const rawNames = siblings.map((s) => s.full_name).join(' & ');
        const combinedAdmNos = siblings.map((s) => s.admission_no).join(', ');
        const combinedClasses = siblings.map((s) => s.class_label).join(', ');
        const totalMonthly = siblings.reduce((sum, s) => sum + s.monthly_dues, 0);
        const totalAdditional = siblings.reduce((sum, s) => sum + s.additional_dues, 0);
        const totalOverall = totalMonthly + totalAdditional;
        const maxMonths = Math.max(...siblings.map((s) => s.overdue_months));

        let tier = 'mild';
        if (maxMonths >= 3 || totalOverall >= 5000) tier = 'critical';
        else if (maxMonths === 2 || totalOverall >= 2000) tier = 'moderate';

        aggregatedList.push({
          ...primary,
          id: primary.id,
          is_family: true,
          family_id: famId,
          sibling_count: siblings.length,
          sibling_ids: siblings.map((s) => s.id),
          full_name: combinedNames,
          raw_names: rawNames,
          admission_no: combinedAdmNos,
          class_name: combinedClasses,
          monthly_dues: totalMonthly,
          additional_dues: totalAdditional,
          total_dues: totalOverall,
          overdue_months: maxMonths,
          tier,
          siblings_detail: siblings,
        });
      }
    }

    // Add individual students
    individualList.forEach((s) => {
      let tier = 'mild';
      if (s.overdue_months >= 3 || s.total_dues >= 5000) tier = 'critical';
      else if (s.overdue_months === 2 || s.total_dues >= 2000) tier = 'moderate';

      aggregatedList.push({
        ...s,
        is_family: false,
        sibling_count: 1,
        sibling_ids: [s.id],
        tier,
      });
    });

    // Sort by total_dues DESC
    aggregatedList.sort((a, b) => b.total_dues - a.total_dues);

    // Calculate pagination slice
    const totalItems = aggregatedList.length;
    const paginatedStudents = aggregatedList.slice(numOffset, numOffset + numLimit);

    const totalMonthlyDues = aggregatedList.reduce((sum, s) => sum + s.monthly_dues, 0);
    const totalAdditionalDues = aggregatedList.reduce((sum, s) => sum + s.additional_dues, 0);
    const totalOutstanding = totalMonthlyDues + totalAdditionalDues;

    return res.json({
      success: true,
      students: paginatedStudents,
      summary: {
        total_students_with_dues: totalItems,
        total_monthly_dues: totalMonthlyDues,
        total_additional_dues: totalAdditionalDues,
        total_outstanding: totalOutstanding,
      },
      pagination: {
        page: numPage,
        limit: numLimit,
        total: totalItems,
        totalPages: Math.ceil(totalItems / numLimit),
      },
    });
  } catch (err) {
    console.error('[reportController.getPendingDuesList]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending dues list.' });
  }
}

/**
 * GET /api/reports/export-dues-excel
 * Generate Clean, Compact, High-Contrast B&W Monochrome Outstanding Dues Excel with Sibling Unification
 */
async function exportDuesExcel(req, res) {
  try {
    const { type = 'all', aging = 'all', class_id, category } = req.query || {};

    const conditions = ["s.status = 'active'"];
    const values = [];

    if (class_id) {
      conditions.push('s.class_id = ?');
      values.push(Number(class_id));
    }
    if (category) {
      conditions.push('s.category = ?');
      values.push(category);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const isMonthlyOnly = (type === 'monthly');
    const isAdmissionOnly = (type === 'admission');

    let havingCondition = 'HAVING total_due > 0';
    if (isMonthlyOnly) havingCondition = 'HAVING monthly_due > 0';
    if (isAdmissionOnly) havingCondition = 'HAVING add_due > 0';

    if (aging === 'mild') havingCondition += ' AND overdue_months <= 1';
    else if (aging === 'moderate') havingCondition += ' AND overdue_months = 2';
    else if (aging === 'critical') havingCondition += ' AND overdue_months >= 3';

    const sql = `
      SELECT
        s.id,
        s.admission_no,
        s.full_name as student_name,
        s.family_id,
        COALESCE(NULLIF(s.father_name, ''), NULLIF(s.parent_name, ''), '—') as father_name,
        COALESCE(NULLIF(s.phone, ''), NULLIF(s.whatsapp_number, ''), '—') as contact_number,
        c.name as class_name,
        sec.name as section_name,
        s.category,
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
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      ${whereClause}
      ${havingCondition}
      ORDER BY total_due DESC
    `;

    const rows = await db.query(sql, values);

    // Group by family_id
    const famMap = new Map();
    const singleList = [];

    rows.forEach((r) => {
      const classLabel = `${r.class_name || ''}${r.section_name ? ` (${r.section_name})` : ''}`.trim() || '—';
      const item = {
        ...r,
        monthly_due: Number(r.monthly_due || 0),
        add_due: Number(r.add_due || 0),
        total_due: Number(r.total_due || 0),
        overdue_months: Number(r.overdue_months || 0),
        class_label: classLabel,
      };

      if (r.family_id) {
        if (!famMap.has(r.family_id)) famMap.set(r.family_id, []);
        famMap.get(r.family_id).push(item);
      } else {
        singleList.push(item);
      }
    });

    const finalRows = [];
    for (const [fId, siblings] of famMap.entries()) {
      if (siblings.length === 1) {
        const s = siblings[0];
        let status = '1 Month Due';
        if (s.overdue_months >= 3 || s.total_due >= 5000) status = 'Critical (3+ Mo)';
        else if (s.overdue_months === 2 || s.total_due >= 2000) status = 'Moderate (2 Mo)';
        finalRows.push({ ...s, status, is_family: false });
      } else {
        const combinedNames = siblings.map((s) => `${s.student_name} (${s.class_label})`).join(', ');
        const combinedAdms = siblings.map((s) => s.admission_no).join(', ');
        const combinedClasses = siblings.map((s) => s.class_label).join(', ');
        const totM = siblings.reduce((sum, s) => sum + s.monthly_due, 0);
        const totA = siblings.reduce((sum, s) => sum + s.add_due, 0);
        const totO = totM + totA;
        const maxM = Math.max(...siblings.map((s) => s.overdue_months));

        let status = '1 Month Due';
        if (maxM >= 3 || totO >= 5000) status = 'Critical (3+ Mo)';
        else if (maxM === 2 || totO >= 2000) status = 'Moderate (2 Mo)';

        finalRows.push({
          ...siblings[0],
          student_name: combinedNames,
          admission_no: combinedAdms,
          class_label: combinedClasses,
          monthly_due: totM,
          add_due: totA,
          total_due: totO,
          overdue_months: maxM,
          status,
          is_family: true,
          sibling_count: siblings.length,
        });
      }
    }

    singleList.forEach((s) => {
      let status = '1 Month Due';
      if (s.overdue_months >= 3 || s.total_due >= 5000) status = 'Critical (3+ Mo)';
      else if (s.overdue_months === 2 || s.total_due >= 2000) status = 'Moderate (2 Mo)';
      finalRows.push({ ...s, status, is_family: false });
    });

    finalRows.sort((a, b) => b.total_due - a.total_due);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Aryavart (P.S.G) Shikshan Sansthan';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Outstanding Dues', {
      views: [{ showGridLines: true }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    const endColLetter = 'K';

    // 1. Title Banner (Clean B&W)
    sheet.mergeCells(`A1:${endColLetter}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'ARYAVART (P.S.G) SHIKSHAN SANSTHAN';
    titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 24;

    // 2. Subtitle Banner
    sheet.mergeCells(`A2:${endColLetter}2`);
    const subCell = sheet.getCell('A2');
    subCell.value = `STUDENT OUTSTANDING DUES REPORT • ${aging.toUpperCase()} DEFAULTERS • PRINTED ON ${new Date().toLocaleString('en-IN')}`;
    subCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF333333' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 18;

    sheet.addRow([]);
    sheet.getRow(3).height = 6;

    // 3. Clean Table Headers
    const headers = [
      'S.No',
      'Adm No',
      'Student Name',
      "Father's Name",
      'Contact No',
      'Class & Sec',
      'Category',
      'Monthly Due (Rs.)',
      'Term/Adm Due (Rs.)',
      'Total Outstanding (Rs.)',
      'Overdue Status',
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
    });

    let totalMonthly = 0;
    let totalAdd = 0;
    let totalOutstanding = 0;

    finalRows.forEach((r, idx) => {
      const mDue = Number(r.monthly_due || 0);
      const aDue = Number(r.add_due || 0);
      const tot = Number(r.total_due || 0);

      totalMonthly += mDue;
      totalAdd += aDue;
      totalOutstanding += tot;

      const dataRow = sheet.addRow([
        idx + 1,
        r.admission_no || 'N/A',
        r.student_name || '—',
        r.father_name || '—',
        r.contact_number || '—',
        r.class_label || '—',
        r.category === 'hosteller' ? 'Hostel' : 'Day Scholar',
        mDue,
        aDue,
        tot,
        r.status,
      ]);

      dataRow.height = 20;
      const isEven = idx % 2 === 1;
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };

        if (colNumber === 1 || colNumber === 2 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 11) {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        } else if (colNumber === 8 || colNumber === 9 || colNumber === 10) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00';
          if (colNumber === 10) cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }
      });
    });

    // 4. Grand Total Row
    const totalRow = sheet.addRow([
      '',
      '',
      '',
      '',
      '',
      '',
      'TOTAL OUTSTANDING:',
      totalMonthly,
      totalAdd,
      totalOutstanding,
      `${finalRows.length} Defaulters`,
    ]);
    totalRow.height = 24;
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      if (colNumber === 7) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber >= 8 && colNumber <= 10) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
    });

    // Dynamic Column Widths with padding and wrapping
    const defaultDuesWidths = [7, 16, 26, 22, 16, 18, 14, 22, 24, 26, 22];
    sheet.columns.forEach((col, idx) => {
      let maxLen = defaultDuesWidths[idx] || 16;
      col.eachCell({ includeEmpty: false }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = Math.min(len + 4, 55);
      });
      col.width = maxLen;
    });

    const filename = `Outstanding_Dues_${aging}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[reportController.exportDuesExcel]', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate dues Excel: ' + err.message });
    }
  }
}

module.exports = {
  getExecutiveOverview,
  getPendingDuesList,
  getAdmissionDuesList,
  getDemographicsReport,
  getCollectionsReport,
  exportCollectionsExcel,
  exportDuesExcel,
};
