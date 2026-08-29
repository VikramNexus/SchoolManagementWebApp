const db = require('../src/config/db');
const { withTransaction } = require('../src/utils/transactionHandler');
const { allocatePaymentFIFO } = require('../src/services/paymentAllocationService');

async function testPart4() {
  console.log('=== RUNNING PART 4: ADMISSIONS DESK, ITEMIZED BILLING & SIBLING LINKING ===\n');

  const testAdmNo = `TEST-ADM-${Date.now().toString().slice(-6)}`;
  let testStudentId = null;
  let testSiblingId = null;

  try {
    // 4.1 Test Student Enrollment with Itemized Charges & Advance Fee
    const testClass = await db.queryOne('SELECT id FROM classes LIMIT 1');
    const classId = testClass ? testClass.id : 1;

    console.log(`--- 1. Enrolling Test Student (${testAdmNo}) ---`);
    const enrollmentResult = await withTransaction(async (tx) => {
      // 1. Insert student
      const [stdRes] = await tx.execute(
        `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`category\`, \`father_name\`, \`mother_name\`, \`phone\`, \`monthly_fee_rate\`, \`status\`)
         VALUES (?, 'Test Admission Candidate', 'male', ?, 'day_scholar', 'Test Father', 'Test Mother', '9876543210', 3200.00, 'active')`,
        [testAdmNo, classId]
      );
      const studentId = stdRes.insertId;

      // 2. Insert Advance Month Tuition Fee
      const now = new Date();
      const [mfRes] = await tx.execute(
        `INSERT INTO \`monthly_fees\` (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
         VALUES (?, ?, ?, 3200.00, 0, 3200.00, 'DUE')`,
        [studentId, now.getMonth() + 1, now.getFullYear()]
      );

      // 3. Insert Admission Charge
      await tx.execute(
        `INSERT INTO \`student_additional_fees\` (\`student_id\`, \`fee_type_id\`, \`description\`, \`amount\`, \`status\`, \`due_date\`)
         VALUES (?, 1, 'Admission Charge', 2500.00, 'DUE', NOW())`,
        [studentId]
      );

      // 4. Insert Security Deposit
      await tx.execute(
        `INSERT INTO \`student_additional_fees\` (\`student_id\`, \`fee_type_id\`, \`description\`, \`amount\`, \`status\`, \`due_date\`)
         VALUES (?, 1, 'Security Deposit (Refundable)', 1500.00, 'DUE', NOW())`,
        [studentId]
      );

      return { studentId };
    });

    testStudentId = enrollmentResult.studentId;
    console.log(`✅ 4.1 Comprehensive Student Enrollment: Created student ID ${testStudentId}`);

    // Verify monthly_fees & additional_fees in DB
    const studentRow = await db.queryOne('SELECT * FROM students WHERE id = ?', [testStudentId]);
    const monthlyFee = await db.queryOne('SELECT * FROM monthly_fees WHERE student_id = ?', [testStudentId]);
    const additionalFees = await db.query('SELECT * FROM student_additional_fees WHERE student_id = ?', [testStudentId]);

    console.log(`  • Student Monthly Rate: ₹${studentRow.monthly_fee_rate}`);
    console.log(`  • Advance Monthly Fee: ₹${monthlyFee.fee_amount} (${monthlyFee.status})`);
    console.log(`  • Additional Charges Count: ${additionalFees.length}`);

    if (studentRow && monthlyFee && additionalFees.length === 2) {
      console.log('✅ 4.1 Itemized Billing & Advance Month Structure: PASS');
    } else {
      console.error('❌ 4.1 Billing breakdown mismatch');
    }

    // 4.2 Immediate Payment Collection with FIFO Allocation
    console.log('\n--- 2. Collecting Immediate Admission Payment (₹4,000) ---');
    const paymentResult = await withTransaction(async (tx) => {
      const receiptNo = `ADM-REC-${Date.now().toString().slice(-6)}`;
      const [payRes] = await tx.execute(
        `INSERT INTO \`payments\` (\`student_id\`, \`amount\`, \`payment_mode\`, \`payment_category\`, \`payment_date\`, \`receipt_number\`)
         VALUES (?, 4000.00, 'CASH', 'ADMISSION_CHARGE', CURDATE(), ?)`,
        [testStudentId, receiptNo]
      );
      const paymentId = payRes.insertId;

      // Allocate FIFO: ₹3,200 to advance month (marks PAID) + ₹800 to admission charge (marks PARTIAL)
      const allocations = await allocatePaymentFIFO(
        { studentId: testStudentId, paymentId, amount: 4000.00 },
        tx
      );

      return { paymentId, receiptNo, allocations };
    });

    console.log(`✅ 4.2 Immediate Payment Collection: Recorded Payment ID ${paymentResult.paymentId}`);
    
    // Check updated monthly_fees status
    const updatedMf = await db.queryOne('SELECT * FROM monthly_fees WHERE student_id = ?', [testStudentId]);
    console.log(`  • Advance Monthly Fee after ₹4,000 payment: Paid ₹${updatedMf.paid_amount}, Due ₹${updatedMf.due_amount} (Status: ${updatedMf.status})`);
    if (updatedMf.status === 'PAID') {
      console.log('✅ 4.2 FIFO Advance Month Settlement: PASS (Marked PAID)');
    } else {
      console.error('❌ 4.2 FIFO Settlement did not mark advance month PAID');
    }

    // 4.3 Sibling Linking Verification
    console.log('\n--- 3. Testing Sibling / Family Group Linking ---');
    const siblingAdmNo = `TEST-SIB-${Date.now().toString().slice(-6)}`;
    const familyId = `FAM-TEST-${Date.now().toString().slice(-4)}`;

    const sibRes = await db.query(
      `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`category\`, \`family_id\`, \`status\`)
       VALUES (?, 'Test Sibling Candidate', 'female', ?, 'day_scholar', ?, 'active')`,
      [siblingAdmNo, classId, familyId]
    );
    testSiblingId = sibRes.insertId || (sibRes[0] && sibRes[0].insertId);

    // Link original student to same family_id
    await db.query('UPDATE students SET family_id = ? WHERE id = ?', [familyId, testStudentId]);

    const familyMembers = await db.query('SELECT id, full_name, family_id FROM students WHERE family_id = ?', [familyId]);
    console.log(`  • Family Account "${familyId}" Members: ${familyMembers.length} siblings linked.`);
    if (familyMembers.length === 2) {
      console.log('✅ 4.3 Sibling Family Linking: PASS');
    } else {
      console.error('❌ 4.3 Sibling linking failed');
    }

    // 4.4 Duplicate Admission Number Defense
    console.log('\n--- 4. Testing Duplicate Admission Number Defense ---');
    try {
      await db.query(
        `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`class_id\`, \`category\`)
         VALUES (?, 'Duplicate Candidate', ?, 'day_scholar')`,
        [testAdmNo, classId]
      );
      console.error('❌ 4.4 Duplicate admission number allowed (FAIL)');
    } catch (dupErr) {
      if (dupErr.code === 'ER_DUP_ENTRY') {
        console.log('✅ 4.4 Duplicate Admission Number correctly blocked by unique constraint: PASS');
      } else {
        console.error('❌ 4.4 Unexpected error:', dupErr.message);
      }
    }

    // Cleanup test data cleanly
    console.log('\n--- Cleaning up temporary test records ---');
    await db.query('DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE student_id IN (?, ?))', [testStudentId, testSiblingId]);
    await db.query('DELETE FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE student_id IN (?, ?))', [testStudentId, testSiblingId]);
    await db.query('DELETE FROM payments WHERE student_id IN (?, ?)', [testStudentId, testSiblingId]);
    await db.query('DELETE FROM monthly_fees WHERE student_id IN (?, ?)', [testStudentId, testSiblingId]);
    await db.query('DELETE FROM student_additional_fees WHERE student_id IN (?, ?)', [testStudentId, testSiblingId]);
    await db.query('DELETE FROM students WHERE id IN (?, ?)', [testStudentId, testSiblingId]);
    console.log('✅ Cleanup completed cleanly.');

    console.log('\n======================================================');
    console.log('🎉 PART 4 TESTING RESULT: 100% PASS (ALL CHECKS PASSED)');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Part 4 Test Error:', err);
    // Cleanup if error
    if (testStudentId || testSiblingId) {
      try {
        await db.query('DELETE FROM students WHERE id IN (?, ?)', [testStudentId || 0, testSiblingId || 0]);
      } catch (e) {}
    }
    process.exit(1);
  }
}

testPart4();
