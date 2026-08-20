/**
 * Payment History Controller — School Management System
 *
 * Day 7: Payment History & Financial Validation.
 *
 * Handles:
 *   - Payment history list with search & filters (date-range, class, student category)
 *   - Cash collection summaries (daily, weekly, monthly totals)
 *   - Allocation breakdown for individual payments
 */

const db = require('../config/db');

/**
 * GET /api/payments/history
 * Fetch payments list with filters and pagination.
 */
async function getPaymentHistory(req, res) {
  try {
    const {
      search,
      class_id,
      category,
      start_date,
      end_date,
      sort_by = 'payment_date',
      sort_order = 'desc',
      page = 1,
      limit = 25,
    } = req.query;

    const conditions = [];
    const values = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(s.`full_name` LIKE ? OR s.`admission_no` LIKE ? OR r.`receipt_number` LIKE ? OR p.`receipt_number` LIKE ?)');
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

    if (start_date) {
      conditions.push('DATE(p.`payment_date`) >= ?');
      values.push(start_date);
    }

    if (end_date) {
      conditions.push('DATE(p.`payment_date`) <= ?');
      values.push(end_date);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const numLimit = Math.max(1, Number(limit) || 25);
    const numPage = Math.max(1, Number(page) || 1);
    const numOffset = (numPage - 1) * numLimit;

    // Sorting column mapping
    const orderDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    let orderByClause = `p.\`payment_date\` ${orderDirection}, p.\`created_at\` ${orderDirection}`;
    if (sort_by === 'amount') {
      orderByClause = `p.\`amount\` ${orderDirection}`;
    } else if (sort_by === 'student_name') {
      orderByClause = `s.\`full_name\` ${orderDirection}`;
    } else if (sort_by === 'receipt_number') {
      orderByClause = `receipt_no ${orderDirection}`;
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
        COALESCE(r.\`receipt_number\`, p.\`receipt_number\`) as receipt_no,
        s.\`full_name\` as student_name,
        s.\`admission_no\` as student_admission_no,
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
      payments,
      summary: {
        total_records: summaryResult.total,
        total_amount: Number(summaryResult.total_amount),
      },
      pagination: {
        page: numPage,
        limit: numLimit,
        total: summaryResult.total,
        totalPages: Math.ceil(summaryResult.total / numLimit),
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

    // Daily collections (last 30 days or filtered)
    const dailySql = `
      SELECT
        DATE(\`payment_date\`) as date_str,
        COUNT(*) as transaction_count,
        COALESCE(SUM(\`amount\`), 0) as total_amount
      FROM \`payments\`
      ${whereClause}
      GROUP BY DATE(\`payment_date\`)
      ORDER BY DATE(\`payment_date\`) DESC
      LIMIT 30
    `;

    // Monthly collections
    const monthlySql = `
      SELECT
        DATE_FORMAT(\`payment_date\`, '%Y-%m') as month_str,
        COUNT(*) as transaction_count,
        COALESCE(SUM(\`amount\`), 0) as total_amount
      FROM \`payments\`
      ${whereClause}
      GROUP BY DATE_FORMAT(\`payment_date\`, '%Y-%m')
      ORDER BY month_str DESC
      LIMIT 12
    `;

    // Overall summary
    const overallSql = `
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(\`amount\`), 0) as grand_total
      FROM \`payments\`
      ${whereClause}
    `;

    const [daily, monthly, overall] = await Promise.all([
      db.query(dailySql, values),
      db.query(monthlySql, values),
      db.queryOne(overallSql, values),
    ]);

    return res.json({
      success: true,
      summary: {
        total_count: overall.total_count,
        grand_total: Number(overall.grand_total),
        daily: daily.map(d => ({ ...d, total_amount: Number(d.total_amount) })),
        monthly: monthly.map(m => ({ ...m, total_amount: Number(m.total_amount) })),
      },
    });
  } catch (err) {
    console.error('[paymentHistoryController.getCollectionSummary]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch collection summary.' });
  }
}

/**
 * GET /api/payments/:id/details
 * Fetch a single payment with its FIFO allocation breakdown.
 */
async function getPaymentDetails(req, res) {
  const { id } = req.params;

  try {
    const payment = await db.queryOne(
      `SELECT
        p.*,
        COALESCE(r.\`receipt_number\`, p.\`receipt_number\`) as receipt_no,
        s.\`full_name\` as student_name,
        s.\`admission_no\` as student_admission_no,
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
        mf.\`status\` as fee_status
       FROM \`payment_allocations\` pa
       JOIN \`monthly_fees\` mf ON mf.\`id\` = pa.\`monthly_fee_id\`
       WHERE pa.\`payment_id\` = ?
       ORDER BY mf.\`fee_year\` ASC, mf.\`fee_month\` ASC`,
      [id]
    );

    return res.json({
      success: true,
      payment,
      allocations: allocations.map(a => ({ ...a, allocated_amount: Number(a.allocated_amount) })),
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
