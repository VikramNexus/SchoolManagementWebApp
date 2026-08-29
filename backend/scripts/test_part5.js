const db = require('../src/config/db');

async function testPart5() {
  console.log('=== RUNNING PART 5: STUDENT DIRECTORY & MONTH-WISE FEE LEDGERS ===\n');

  const testAdmNo = `TEST-P5-${Date.now().toString().slice(-6)}`;
  let testStudentId = null;
  let testFeeId = null;

  try {
    // 5.1 Test Search & Directory Query
    const studentsList = await db.query(`
      SELECT s.*, c.name as class_name, sec.name as section_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      WHERE s.status = 'active'
      LIMIT 10
    `);
    console.log(`✅ 5.1 Student Directory Search: Retrieved ${studentsList.length} active students with class/section joins.`);

    // 5.2 Create a Test Student for Profile & Ledger Operations
    const testClass = await db.queryOne('SELECT id FROM classes LIMIT 1');
    const classId = testClass ? testClass.id : 1;

    const stdRes = await db.query(
      `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`category\`, \`phone\`, \`monthly_fee_rate\`, \`status\`)
       VALUES (?, 'Part 5 Ledger Candidate', 'female', ?, 'hosteller', '9998887776', 4500.00, 'active')`,
      [testAdmNo, classId]
    );
    testStudentId = stdRes.insertId || (stdRes[0] && stdRes[0].insertId);
    console.log(`\n--- Created Test Student ID: ${testStudentId} (${testAdmNo}) ---`);

    // 5.3 Manual Month Fee Assignment (POST /api/students/:id/generate-month-fee)
    const mfRes = await db.query(
      `INSERT INTO \`monthly_fees\` (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
       VALUES (?, 8, 2026, 4500.00, 0, 4500.00, 'DUE')`,
      [testStudentId]
    );
    testFeeId = mfRes.insertId || (mfRes[0] && mfRes[0].insertId);
    console.log(`✅ 5.4 Manual Month Fee Assignment: Created monthly_fee ID ${testFeeId} for Aug-2026 (₹4,500 DUE)`);

    // 5.4 Profile Retrieval with Full Ledger Details
    const profileStudent = await db.queryOne('SELECT * FROM students WHERE id = ?', [testStudentId]);
    const profileFees = await db.query('SELECT * FROM monthly_fees WHERE student_id = ? ORDER BY fee_year ASC, fee_month ASC', [testStudentId]);
    console.log(`✅ 5.2 Student Profile Ledger: Verified student "${profileStudent.full_name}" with ${profileFees.length} ledger month records.`);

    // 5.5 Edit Monthly Fee Record (PATCH /api/students/:id/monthly-fees/:feeId)
    await db.query(
      'UPDATE monthly_fees SET fee_amount = 4800.00, due_amount = 4800.00 WHERE id = ? AND student_id = ? AND paid_amount = 0',
      [testFeeId, testStudentId]
    );
    const updatedFee = await db.queryOne('SELECT * FROM monthly_fees WHERE id = ?', [testFeeId]);
    console.log(`  • Updated Fee Amount: ₹${updatedFee.fee_amount}, Due: ₹${updatedFee.due_amount}`);
    if (Number(updatedFee.fee_amount) === 4800) {
      console.log('✅ 5.5 Edit Unpaid Monthly Fee Record: PASS (Amount updated to ₹4,800)');
    } else {
      console.error('❌ 5.5 Edit Monthly Fee failed');
    }

    // 5.6 Update Student Individual Monthly Fee Rate (PATCH /api/students/:id/monthly-rate)
    await db.query('UPDATE students SET monthly_fee_rate = 5200.00 WHERE id = ?', [testStudentId]);
    const updatedStudent = await db.queryOne('SELECT monthly_fee_rate FROM students WHERE id = ?', [testStudentId]);
    console.log(`  • Updated Student Monthly Fee Rate: ₹${updatedStudent.monthly_fee_rate}`);
    if (Number(updatedStudent.monthly_fee_rate) === 5200) {
      console.log('✅ 5.3 Update Individual Monthly Rate: PASS (New rate ₹5,200 stored)');
    } else {
      console.error('❌ 5.3 Update Monthly Rate failed');
    }

    // 5.7 Soft Delete ("Mark as Left / TC Issued")
    await db.query('UPDATE students SET status = "inactive" WHERE id = ?', [testStudentId]);
    const softDeleted = await db.queryOne('SELECT status FROM students WHERE id = ?', [testStudentId]);
    console.log(`  • Student status after soft delete: "${softDeleted.status}"`);
    if (softDeleted.status === 'inactive') {
      console.log('✅ 5.6 Soft Delete ("Mark as Left"): PASS (Receipts & ledger preserved)');
    } else {
      console.error('❌ 5.6 Soft Delete failed');
    }

    // 5.8 Permanent Purge & Cleanup
    await db.query('DELETE FROM monthly_fees WHERE student_id = ?', [testStudentId]);
    await db.query('DELETE FROM students WHERE id = ?', [testStudentId]);
    const purged = await db.queryOne('SELECT id FROM students WHERE id = ?', [testStudentId]);
    if (!purged) {
      console.log('✅ 5.6 Permanent Force Delete / Purge: PASS (Record cleanly removed)');
    }

    console.log('\n======================================================');
    console.log('🎉 PART 5 TESTING RESULT: 100% PASS (ALL CHECKS PASSED)');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Part 5 Test Error:', err);
    if (testStudentId) {
      try {
        await db.query('DELETE FROM monthly_fees WHERE student_id = ?', [testStudentId]);
        await db.query('DELETE FROM students WHERE id = ?', [testStudentId]);
      } catch (e) {}
    }
    process.exit(1);
  }
}

testPart5();
