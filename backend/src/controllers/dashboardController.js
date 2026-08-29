/**
 * Dashboard Controller — School Management System
 *
 * Day 4: Settings, Fees & Application Shell.
 *
 * Provides KPI data for the admin dashboard.
 */

const db = require('../config/db');

/**
 * GET /api/dashboard/kpis
 * Returns aggregate statistics for the dashboard.
 */
async function getKpis(req, res) {
  try {
    // Run all queries in parallel
    const [
      totalStudents,
      hostellers,
      dayScholars,
      expectedFees,
      collectedFees,
      monthlyCollected,
      admissionCollected,
      outstandingFees,
    ] = await Promise.all([
      // Total active students
      db.queryOne('SELECT COUNT(*) as cnt FROM `students` WHERE `status` = "active"'),

      // Hostellers
      db.queryOne('SELECT COUNT(*) as cnt FROM `students` WHERE `status` = "active" AND `category` = "hosteller"'),

      // Day Scholars
      db.queryOne('SELECT COUNT(*) as cnt FROM `students` WHERE `status` = "active" AND `category` = "day_scholar"'),

      // Expected fees (total sum of assessed monthly fee rates & additional fees for active students)
      db.queryOne(`
        SELECT (
          COALESCE((SELECT SUM(mf.\`fee_amount\`) FROM \`monthly_fees\` mf JOIN \`students\` s ON s.\`id\` = mf.\`student_id\` WHERE s.\`status\` = 'active'), 0) +
          COALESCE((SELECT SUM(saf.\`amount\`) FROM \`student_additional_fees\` saf JOIN \`students\` s ON s.\`id\` = saf.\`student_id\` WHERE s.\`status\` = 'active'), 0)
        ) as total
      `),

      // Collected fees (total sum of payments for active students)
      db.queryOne(`
        SELECT COALESCE(SUM(p.\`amount\`), 0) as total
        FROM \`payments\` p
        JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
        WHERE s.\`status\` = 'active'
      `),

      // Monthly fees collected
      db.queryOne(`
        SELECT COALESCE(SUM(p.\`amount\`), 0) as total
        FROM \`payments\` p
        JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
        WHERE s.\`status\` = 'active' AND p.\`payment_category\` IN ('MONTHLY_FEE', 'FAMILY_FEE')
      `),

      // Admission desk fees collected
      db.queryOne(`
        SELECT COALESCE(SUM(p.\`amount\`), 0) as total
        FROM \`payments\` p
        JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
        WHERE s.\`status\` = 'active' AND p.\`payment_category\` = 'ADMISSION_CHARGE'
      `),

      // Outstanding fees (sum of due_amount)
      db.queryOne(`
        SELECT (
          COALESCE((SELECT SUM(mf.\`due_amount\`) FROM \`monthly_fees\` mf JOIN \`students\` s ON s.\`id\` = mf.\`student_id\` WHERE s.\`status\` = 'active' AND mf.\`status\` IN ('DUE', 'PARTIAL')), 0) +
          COALESCE((SELECT SUM(saf.\`amount\`) FROM \`student_additional_fees\` saf JOIN \`students\` s ON s.\`id\` = saf.\`student_id\` WHERE s.\`status\` = 'active' AND saf.\`status\` IN ('DUE', 'PARTIAL')), 0)
        ) as total
      `),
    ]);

    return res.json({
      success: true,
      kpis: {
        total_students: totalStudents.cnt,
        hostellers: hostellers.cnt,
        day_scholars: dayScholars.cnt,
        expected_fees: Number(expectedFees.total),
        collected_fees: Number(collectedFees.total),
        monthly_fees_collected: Number(monthlyCollected.total),
        admission_fees_collected: Number(admissionCollected.total),
        outstanding_fees: Number(outstandingFees.total),
      },
    });
  } catch (err) {
    console.error('[dashboardController.getKpis]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard KPIs.' });
  }
}

module.exports = { getKpis };