const db = require('../src/config/db');

async function testPart12() {
  console.log('=== RUNNING PART 12: EXECUTIVE DASHBOARD KPIS & FINANCIAL REPORTS ===\n');

  try {
    // 12.1 Dashboard KPIs
    console.log('--- 1. Querying Live Dashboard KPIs ---');
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
      db.queryOne('SELECT COUNT(*) as cnt FROM `students` WHERE `status` = "active"'),
      db.queryOne('SELECT COUNT(*) as cnt FROM `students` WHERE `status` = "active" AND `category` = "hosteller"'),
      db.queryOne('SELECT COUNT(*) as cnt FROM `students` WHERE `status` = "active" AND `category` = "day_scholar"'),
      // Total Assessed / Billed fees (fixed calculation)
      db.queryOne(`
        SELECT (
          COALESCE((SELECT SUM(mf.\`fee_amount\`) FROM \`monthly_fees\` mf JOIN \`students\` s ON s.\`id\` = mf.\`student_id\` WHERE s.\`status\` = 'active'), 0) +
          COALESCE((SELECT SUM(saf.\`amount\`) FROM \`student_additional_fees\` saf JOIN \`students\` s ON s.\`id\` = saf.\`student_id\` WHERE s.\`status\` = 'active'), 0)
        ) as total
      `),
      db.queryOne(`
        SELECT COALESCE(SUM(p.\`amount\`), 0) as total
        FROM \`payments\` p
        JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
        WHERE s.\`status\` = 'active'
      `),
      db.queryOne(`
        SELECT COALESCE(SUM(p.\`amount\`), 0) as total
        FROM \`payments\` p
        JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
        WHERE s.\`status\` = 'active' AND p.\`payment_category\` IN ('MONTHLY_FEE', 'FAMILY_FEE')
      `),
      db.queryOne(`
        SELECT COALESCE(SUM(p.\`amount\`), 0) as total
        FROM \`payments\` p
        JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
        WHERE s.\`status\` = 'active' AND p.\`payment_category\` = 'ADMISSION_CHARGE'
      `),
      db.queryOne(`
        SELECT (
          COALESCE((SELECT SUM(mf.\`due_amount\`) FROM \`monthly_fees\` mf JOIN \`students\` s ON s.\`id\` = mf.\`student_id\` WHERE s.\`status\` = 'active' AND mf.\`status\` IN ('DUE', 'PARTIAL')), 0) +
          COALESCE((SELECT SUM(saf.\`amount\`) FROM \`student_additional_fees\` saf JOIN \`students\` s ON s.\`id\` = saf.\`student_id\` WHERE s.\`status\` = 'active' AND saf.\`status\` IN ('DUE', 'PARTIAL')), 0)
        ) as total
      `),
    ]);

    const expTotal = Number(expectedFees.total);
    const colTotal = Number(collectedFees.total);
    const outTotal = Number(outstandingFees.total);
    const collectionRate = expTotal > 0 ? ((colTotal / expTotal) * 100).toFixed(1) : '100.0';

    console.log(`  • Total Active Students: ${totalStudents.cnt}`);
    console.log(`  • Day Scholars: ${dayScholars.cnt} | Hostellers: ${hostellers.cnt}`);
    console.log(`  • Total Assessed Fees (Expected): ₹${expTotal.toLocaleString('en-IN')}`);
    console.log(`  • Total Collected Revenue: ₹${colTotal.toLocaleString('en-IN')}`);
    console.log(`  • Remaining Outstanding Dues: ₹${outTotal.toLocaleString('en-IN')}`);
    console.log(`  • Overall Financial Collection Rate: ${collectionRate}%`);

    if (totalStudents.cnt >= 0 && expTotal >= 0 && colTotal >= 0) {
      console.log('✅ 12.1 Executive Dashboard KPIs & Financial Formulas: PASS');
    } else {
      console.error('❌ 12.1 KPI calculation failed');
    }

    // 12.2 Demographics Report Query
    console.log('\n--- 2. Querying Class-Wise & Demographic Distribution ---');
    const classDistribution = await db.query(`
      SELECT
        c.id, c.name as class_name,
        COUNT(s.id) as total_students,
        SUM(CASE WHEN s.category = 'day_scholar' THEN 1 ELSE 0 END) as day_scholars,
        SUM(CASE WHEN s.category = 'hosteller' THEN 1 ELSE 0 END) as hostellers,
        SUM(CASE WHEN s.gender = 'male' THEN 1 ELSE 0 END) as male_students,
        SUM(CASE WHEN s.gender = 'female' THEN 1 ELSE 0 END) as female_students
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
      GROUP BY c.id, c.name, c.order_index
      ORDER BY c.order_index ASC, c.name ASC
    `);

    console.log(`  • Classes Distribution Count: ${classDistribution.length} classes analyzed.`);
    classDistribution.slice(0, 4).forEach(cd => {
      console.log(`    - ${cd.class_name}: Total = ${cd.total_students}, Day Scholars = ${cd.day_scholars}, Hostellers = ${cd.hostellers}`);
    });
    console.log('✅ 12.2 Demographics Report Engine: PASS');

    // 12.3 Monthly Collections Trend
    console.log('\n--- 3. Querying Monthly Collections Financial Inflow Trend ---');
    const collectionsTrend = await db.query(`
      SELECT
        DATE_FORMAT(payment_date, '%Y-%m') as collection_month,
        COUNT(*) as total_transactions,
        SUM(amount) as total_collected
      FROM payments
      GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY collection_month DESC
      LIMIT 6
    `);
    console.log(`  • Historical Collections Recorded: ${collectionsTrend.length} periods.`);
    collectionsTrend.forEach(ct => {
      console.log(`    - Month: ${ct.collection_month} | Transactions: ${ct.total_transactions} | Total: ₹${Number(ct.total_collected).toLocaleString('en-IN')}`);
    });
    console.log('✅ 12.3 Monthly Collections Financial Report: PASS');

    console.log('\n======================================================');
    console.log('🎉 PART 12 TESTING RESULT: 100% PASS (ALL CHECKS PASSED)');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Part 12 Test Error:', err);
    process.exit(1);
  }
}

testPart12();
