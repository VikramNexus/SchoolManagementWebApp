/**
 * Payment History Controller — School Management System
 *
 * Day 7: Payment History & Financial Validation.
 *
 * Handles:
 *   - Payment history list with search & filters (date-range, class, student category, tab: monthly vs admissions)
 *   - Cash collection summaries (daily, weekly, monthly totals)
 *   - Allocation breakdown for individual payments
 */

const db = require('../config/db');

/**
 * GET /api/payments/history or /api/payments
 * Fetch payments list with filters and pagination.
 */
async function getPaymentHistory(req, res) {
  try {
    const {
      tab,
      type,
      search,
      class_id,
      category,
      start_date,
      end_date,
      sort_by = 'payment_date',
      sort_order = 'desc',
      page = 1,
      limit = 20,
    } = req.query;

    const conditions = [];
    const values = [];

    // Tab filter (Monthly vs Admissions)
    const activeTab = tab || type || '';
    if (activeTab === 'monthly') {
      conditions.push("(p.`payment_category` != 'ADMISSION_CHARGE' AND (p.`notes` IS NULL OR (p.`notes` NOT LIKE '%Admission%' AND p.`notes` NOT LIKE '%Enrollment%')))");
    } else if (activeTab === 'admissions') {
      conditions.push("(p.`payment_category` = 'ADMISSION_CHARGE' OR p.`notes` LIKE '%Admission%' OR p.`notes` LIKE '%Enrollment%')");
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(s.`full_name` LIKE ? OR s.`admission_no` LIKE ? OR r.`receipt_number` LIKE ? OR p.`receipt_number` LIKE ? OR p.`notes` LIKE ?)');
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

    if (start_date) {
      conditions.push('DATE(p.`payment_date`) >= ?');
      values.push(start_date);
    }

    if (end_date) {
      conditions.push('DATE(p.`payment_date`) <= ?');
      values.push(end_date);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const numLimit = Math.max(1, Number(limit) || 20);
    const numPage = Math.max(1, Number(page) || 1);
    const numOffset = (numPage - 1) * numLimit;

    // Sorting column mapping
    const orderDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    let orderByClause = `p.\`payment_date\` ${orderDirection}, p.\`created_at\` ${orderDirection}`;
    if (sort_by === 'amount') {
      orderByClause = `p.\`amount\` ${orderDirection}`;
    } else if (sort_by === 'student_name' || sort_by === 'full_name') {
      orderByClause = `s.\`full_name\` ${orderDirection}`;
    } else if (sort_by === 'receipt_number') {
      orderByClause = `COALESCE(r.\`receipt_number\`, p.\`receipt_number\`) ${orderDirection}`;
    } else if (sort_by === 'payment_date') {
      orderByClause = `p.\`payment_date\` ${orderDirection}`;
    }

    const countSql = `
      SELECT COUNT(*) as total, COALESCE(SUM(p.\`amount\`), 0) as total_amount
      FROM \`payments\` p
      JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
      LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
      ${whereClause}
    `;

    const dataSql = `
      SELECT
        p.*,
        COALESCE(r.\`receipt_number\`, p.\`receipt_number\`, CONCAT('RCP-', LPAD(p.\`id\`, 6, '0'))) as receipt_number,
        COALESCE(r.\`receipt_number\`, p.\`receipt_number\`, CONCAT('RCP-', LPAD(p.\`id\`, 6, '0'))) as receipt_no,
        s.\`full_name\`,
        s.\`full_name\` as student_name,
        s.\`admission_no\`,
        s.\`admission_no\` as student_admission_no,
        s.\`family_id\`,
        s.\`father_name\`,
        s.\`mother_name\`,
        s.\`parent_name\`,
        s.\`phone\`,
        s.\`whatsapp_number\`,
        s.\`address\`,
        s.\`category\`,
        s.\`category\` as student_category,
        c.\`name\` as class_name,
        sec.\`name\` as section_name,
        u.\`full_name\` as recorder_name,
        u.\`username\` as recorder_username
      FROM \`payments\` p
      JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
      LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
      LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
      LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
      LEFT JOIN \`users\` u ON u.\`id\` = p.\`recorded_by\`
      ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const [summaryResult, payments] = await Promise.all([
      db.queryOne(countSql, values),
      db.query(dataSql, [...values, numLimit, numOffset]),
    ]);

    return res.json({
      success: true,
      payments: (payments || []).map(p => ({
        ...p,
        amount: Number(p.amount || 0),
        full_name: p.full_name || p.student_name || '—',
        student_name: p.full_name || p.student_name || '—',
        admission_no: p.admission_no || p.student_admission_no || '—',
        father_name: p.father_name || p.parent_name || '—',
        parent_name: p.parent_name || p.father_name || '—',
        receipt_number: p.receipt_number || p.receipt_no || `RCP-${p.id}`,
      })),
      summary: {
        total_records: summaryResult ? summaryResult.total : 0,
        total_amount: summaryResult ? Number(summaryResult.total_amount) : 0,
      },
      pagination: {
        page: numPage,
        limit: numLimit,
        total: summaryResult ? summaryResult.total : 0,
        totalPages: summaryResult ? Math.ceil(summaryResult.total / numLimit) : 1,
      },
    });
  } catch (err) {
    console.error('[paymentHistoryController.getPaymentHistory]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment history.' });
  }
}

/**
 * GET /api/payments/collection-summary
 * Get aggregated cash collection stats (daily, weekly, monthly).
 */
async function getCollectionSummary(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const conditions = [];
    const values = [];

    if (start_date) {
      conditions.push('DATE(`payment_date`) >= ?');
      values.push(start_date);
    }
    if (end_date) {
      conditions.push('DATE(`payment_date`) <= ?');
      values.push(end_date);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthStr = new Date().toISOString().slice(0, 7);
    const firstDayOfMonth = todayStr.substring(0, 8) + '01';

    const [todayStats, monthStats, overall, channelStats, daily, monthly] = await Promise.all([
      db.queryOne(
        `SELECT 
           COALESCE(SUM(\`amount\`), 0) as total, 
           COUNT(*) as count,
           COALESCE(SUM(CASE WHEN \`payment_mode\` = 'CASH' THEN \`amount\` ELSE 0 END), 0) as cash_total,
           COALESCE(SUM(CASE WHEN \`payment_mode\` != 'CASH' THEN \`amount\` ELSE 0 END), 0) as bank_total
         FROM \`payments\`
         WHERE (DATE(\`payment_date\`) = CURDATE() OR DATE(\`payment_date\`) = ?)`,
        [todayStr]
      ),
      db.queryOne(
        `SELECT 
           COALESCE(SUM(\`amount\`), 0) as total, 
           COUNT(*) as count,
           COALESCE(SUM(CASE WHEN \`payment_mode\` = 'CASH' THEN \`amount\` ELSE 0 END), 0) as cash_total,
           COALESCE(SUM(CASE WHEN \`payment_mode\` != 'CASH' THEN \`amount\` ELSE 0 END), 0) as bank_total
         FROM \`payments\`
         WHERE DATE(\`payment_date\`) >= ? OR DATE_FORMAT(\`payment_date\`, '%Y-%m') = ?`,
        [firstDayOfMonth, thisMonthStr]
      ),
      db.queryOne(
        `SELECT COALESCE(SUM(\`amount\`), 0) as grand_total, COUNT(*) as total_count
         FROM \`payments\`
         ${whereClause}`,
        values
      ),
      db.queryOne(
        `SELECT 
           COALESCE(SUM(CASE WHEN \`payment_mode\` = 'CASH' THEN \`amount\` ELSE 0 END), 0) as cash_total,
           COALESCE(SUM(CASE WHEN \`payment_mode\` != 'CASH' THEN \`amount\` ELSE 0 END), 0) as bank_total
         FROM \`payments\`
         ${whereClause}`,
        values
      ),
      db.query(
        `SELECT DATE_FORMAT(\`payment_date\`, '%Y-%m-%d') as date, DATE_FORMAT(\`payment_date\`, '%Y-%m-%d') as date_str, SUM(\`amount\`) as total_amount, SUM(\`amount\`) as total, COUNT(*) as count
         FROM \`payments\`
         ${whereClause}
         GROUP BY DATE_FORMAT(\`payment_date\`, '%Y-%m-%d')
         ORDER BY date DESC
         LIMIT 14`,
        values
      ),
      db.query(
        `SELECT DATE_FORMAT(\`payment_date\`, '%Y-%m') as month, DATE_FORMAT(\`payment_date\`, '%Y-%m') as month_str, SUM(\`amount\`) as total_amount, SUM(\`amount\`) as total, COUNT(*) as count
         FROM \`payments\`
         ${whereClause}
         GROUP BY DATE_FORMAT(\`payment_date\`, '%Y-%m')
         ORDER BY month DESC
         LIMIT 12`,
        values
      ),
    ]);

    const grandTotal = Number(overall?.grand_total || 0);
    const totalCount = Number(overall?.total_count || 0);
    const todayTotalVal = Number(todayStats?.total || 0);
    const todayCountVal = Number(todayStats?.count || 0);
    const monthTotalVal = Number(monthStats?.total || 0);
    const monthCountVal = Number(monthStats?.count || 0);
    const cashTotalVal = Number(channelStats?.cash_total || 0);
    const bankTotalVal = Number(channelStats?.bank_total || 0);
    const todayCashVal = Number(todayStats?.cash_total || 0);
    const todayBankVal = Number(todayStats?.bank_total || 0);

    const summaryObj = {
      // Direct & legacy keys
      today: todayTotalVal,
      today_amount: todayTotalVal,
      today_total: todayTotalVal,
      today_count: todayCountVal,
      today_cash: todayCashVal,
      today_bank: todayBankVal,
      this_month: monthTotalVal,
      month_amount: monthTotalVal,
      month_total: monthTotalVal,
      month_count: monthCountVal,
      total_collected: grandTotal,
      grand_total: grandTotal,
      total_amount: grandTotal,
      total_count: totalCount,
      total_records: totalCount,
      cash_total: cashTotalVal,
      cash_amount: cashTotalVal,
      bank_total: bankTotalVal,
      bank_amount: bankTotalVal,
      daily: daily || [],
      daily_trend: daily || [],
      monthly: monthly || [],
      monthly_trend: monthly || [],
    };

    return res.json({
      success: true,
      summary: summaryObj,
      daily,
      monthly,
      total: {
        count: totalCount,
        amount: grandTotal,
      },
    });
  } catch (err) {
    console.error('[paymentHistoryController.getCollectionSummary]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch collection summary.' });
  }
}

/**
 * GET /api/payments/:id or /api/payments/:id/details
 * Fetch a single payment with its FIFO allocation breakdown.
 */
async function getPaymentDetails(req, res) {
  const { id } = req.params;

  try {
    const payment = await db.queryOne(
      `SELECT
        p.*,
        COALESCE(r.\`receipt_number\`, p.\`receipt_number\`, CONCAT('RCP-', LPAD(p.\`id\`, 6, '0'))) as receipt_number,
        COALESCE(r.\`receipt_number\`, p.\`receipt_number\`, CONCAT('RCP-', LPAD(p.\`id\`, 6, '0'))) as receipt_no,
        s.\`full_name\`,
        s.\`full_name\` as student_name,
        s.\`admission_no\`,
        s.\`admission_no\` as student_admission_no,
        s.\`father_name\`,
        s.\`mother_name\`,
        s.\`parent_name\`,
        s.\`phone\`,
        s.\`whatsapp_number\`,
        s.\`address\`,
        s.\`category\`,
        s.\`category\` as student_category,
        c.\`name\` as class_name,
        sec.\`name\` as section_name,
        u.\`full_name\` as recorder_name
       FROM \`payments\` p
       JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
       LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
       LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
       LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
       LEFT JOIN \`users\` u ON u.\`id\` = p.\`recorded_by\`
       WHERE p.\`id\` = ?`,
      [id]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    const allocations = await db.query(
      `SELECT
        pa.*,
        mf.\`fee_month\`,
        mf.\`fee_year\`,
        mf.\`fee_amount\`,
        mf.\`paid_amount\` as total_fee_paid,
        mf.\`due_amount\` as current_due,
        mf.\`status\` as fee_status,
        saf.\`description\` as additional_fee_description,
        saf.\`amount\` as additional_fee_amount,
        ft.\`name\` as fee_type_name
       FROM \`payment_allocations\` pa
       LEFT JOIN \`monthly_fees\` mf ON mf.\`id\` = pa.\`monthly_fee_id\`
       LEFT JOIN \`student_additional_fees\` saf ON saf.\`id\` = pa.\`additional_fee_id\`
       LEFT JOIN \`fee_types\` ft ON ft.\`id\` = saf.\`fee_type_id\`
       WHERE pa.\`payment_id\` = ?
       ORDER BY pa.\`id\` ASC`,
      [id]
    );

    return res.json({
      success: true,
      payment: {
        ...payment,
        amount: Number(payment.amount || 0),
        full_name: payment.full_name || payment.student_name || '—',
        student_name: payment.full_name || payment.student_name || '—',
        admission_no: payment.admission_no || payment.student_admission_no || '—',
        father_name: payment.father_name || payment.parent_name || '—',
        parent_name: payment.parent_name || payment.father_name || '—',
      },
      allocations: allocations.map(a => {
        let description = 'Fee Payment';
        let period = '—';
        if (a.fee_month) {
          description = `Monthly Tuition Fee (${a.fee_month}/${a.fee_year})`;
          period = `${a.fee_month}/${a.fee_year}`;
        } else if (a.additional_fee_description || a.fee_type_name) {
          description = a.additional_fee_description || a.fee_type_name || 'Admission / Custom Fee';
          period = 'One-Time';
        }
        return {
          ...a,
          allocated_amount: Number(a.allocated_amount || 0),
          fee_amount: Number(a.fee_amount || a.additional_fee_amount || a.allocated_amount || 0),
          description,
          period,
        };
      }),
    });
  } catch (err) {
    console.error('[paymentHistoryController.getPaymentDetails]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment details.' });
  }
}

module.exports = {
  getPaymentHistory,
  getCollectionSummary,
  getPaymentDetails,
};
