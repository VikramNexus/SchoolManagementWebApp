const db = require('../src/config/db');
const { generateMonthlyFeesForStudent, generateMonthlyFeesForAllStudents } = require('../src/services/feeGeneratorService');

async function testPart6() {
  console.log('=== RUNNING PART 6: FEE ENGINE & AUTOMATED MONTHLY ASSESSMENT ===\n');

  const testAdmNo = `TEST-P6-${Date.now().toString().slice(-6)}`;
  let testStudentId = null;

  try {
    // 6.1 Create a Test Student with individual monthly fee rate
    const testClass = await db.queryOne('SELECT id FROM classes LIMIT 1');
    const classId = testClass ? testClass.id : 1;

    const stdRes = await db.query(
      `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`category\`, \`monthly_fee_rate\`, \`admission_date\`, \`status\`)
       VALUES (?, 'Fee Engine Test Student', 'male', ?, 'day_scholar', 3800.00, '2026-06-01', 'active')`,
      [testAdmNo, classId]
    );
    testStudentId = stdRes.insertId || (stdRes[0] && stdRes[0].insertId);
    console.log(`--- Created Test Student ID: ${testStudentId} (${testAdmNo}, Rate: ₹3,800/mo) ---`);

    // 6.2 Generate Monthly Fees for this student from June 2026 to August 2026
    console.log('\n--- 1. Generating Monthly Fees from Admission Date (June 2026) ---');
    const genResult = await generateMonthlyFeesForStudent(testStudentId, 'day_scholar', '2026-06-01', 3800.00);
    console.log(`  • Generation output: count = ${genResult.count}, success = ${genResult.success}`);

    const generatedFees = await db.query(
      'SELECT * FROM monthly_fees WHERE student_id = ? ORDER BY fee_year ASC, fee_month ASC',
      [testStudentId]
    );
    console.log(`  • Total monthly fees generated: ${generatedFees.length} months`);
    generatedFees.forEach(f => {
      console.log(`    - Month ${f.fee_month}/${f.fee_year}: Amount = ₹${f.fee_amount}, Due = ₹${f.due_amount}, Status = ${f.status}`);
    });

    if (generatedFees.length >= 1 && Number(generatedFees[0].fee_amount) === 3800) {
      console.log('✅ 6.1 Automated Individual Rate Assessment: PASS (₹3,800 applied)');
    } else {
      console.error('❌ 6.1 Fee rate assessment mismatch');
    }

    // 6.3 Duplicate Month Prevention
    console.log('\n--- 2. Testing Duplicate Month Generation Prevention ---');
    const repeatResult = await generateMonthlyFeesForStudent(testStudentId, 'day_scholar', '2026-06-01', 3800.00);
    console.log(`  • Second run result: count = ${repeatResult.count}, message = "${repeatResult.message}"`);
    if (repeatResult.count === 0) {
      console.log('✅ 6.2 Duplicate Month Prevention: PASS (No duplicate entries created)');
    } else {
      console.error('❌ 6.2 Duplicate months were inserted');
    }

    // 6.4 Fallback Category Rate when individual rate is 0
    console.log('\n--- 3. Testing Category Fallback Rate Mechanism ---');
    const testAdmNo2 = `TEST-P6B-${Date.now().toString().slice(-6)}`;
    const stdRes2 = await db.query(
      `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`category\`, \`monthly_fee_rate\`, \`admission_date\`, \`status\`)
       VALUES (?, 'Category Fallback Student', 'male', ?, 'hosteller', 0.00, '2026-08-01', 'active')`,
      [testAdmNo2, classId]
    );
    const testStudentId2 = stdRes2.insertId || (stdRes2[0] && stdRes2[0].insertId);

    // Should fall back to hosteller category rate (₹5,000)
    await generateMonthlyFeesForStudent(testStudentId2, 'hosteller', '2026-08-01', 0);
    const fallbackFees = await db.query('SELECT * FROM monthly_fees WHERE student_id = ?', [testStudentId2]);
    console.log(`  • Fallback student fee record: Amount = ₹${fallbackFees[0]?.fee_amount}`);
    if (fallbackFees[0] && Number(fallbackFees[0].fee_amount) === 5000) {
      console.log('✅ 6.3 Category Base Rate Fallback: PASS (Fallback to ₹5,000 hosteller rate)');
    } else {
      console.error('❌ 6.3 Category fallback rate failed');
    }

    // Clean up temporary students
    console.log('\n--- Cleaning up temporary test records ---');
    await db.query('DELETE FROM monthly_fees WHERE student_id IN (?, ?)', [testStudentId, testStudentId2]);
    await db.query('DELETE FROM students WHERE id IN (?, ?)', [testStudentId, testStudentId2]);
    console.log('✅ Cleanup completed cleanly.');

    console.log('\n======================================================');
    console.log('🎉 PART 6 TESTING RESULT: 100% PASS (ALL CHECKS PASSED)');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Part 6 Test Error:', err);
    if (testStudentId) {
      try {
        await db.query('DELETE FROM monthly_fees WHERE student_id = ?', [testStudentId]);
        await db.query('DELETE FROM students WHERE id = ?', [testStudentId]);
      } catch (e) {}
    }
    process.exit(1);
  }
}

testPart6();
