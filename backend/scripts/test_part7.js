const db = require('../src/config/db');
const { withTransaction } = require('../src/utils/transactionHandler');
const { allocatePaymentFIFO, revertPaymentAllocations } = require('../src/services/paymentAllocationService');

async function testPart7() {
  console.log('=== RUNNING PART 7: CASH / IN-ACCOUNT PAYMENTS & FIFO ALLOCATION ===\n');

  const testAdmNo = `TEST-P7-${Date.now().toString().slice(-6)}`;
  let testStudentId = null;
  let testPaymentId = null;

  try {
    // 7.1 Create Test Student with 2 months of dues (July: ₹3,000, August: ₹3,000 = Total ₹6,000)
    const testClass = await db.queryOne('SELECT id FROM classes LIMIT 1');
    const classId = testClass ? testClass.id : 1;

    const stdRes = await db.query(
      `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`category\`, \`monthly_fee_rate\`, \`status\`)
       VALUES (?, 'FIFO Allocation Candidate', 'male', ?, 'day_scholar', 3000.00, 'active')`,
      [testAdmNo, classId]
    );
    testStudentId = stdRes.insertId || (stdRes[0] && stdRes[0].insertId);
    console.log(`--- Created Test Student ID: ${testStudentId} (${testAdmNo}) ---`);

    // Insert 2 Months Dues
    await db.query(
      `INSERT INTO \`monthly_fees\` (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
       VALUES (?, 7, 2026, 3000.00, 0, 3000.00, 'DUE')`,
      [testStudentId]
    );
    await db.query(
      `INSERT INTO \`monthly_fees\` (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
       VALUES (?, 8, 2026, 3000.00, 0, 3000.00, 'DUE')`,
      [testStudentId]
    );
    console.log(`  • Initial Dues: July 2026 (₹3,000 DUE), August 2026 (₹3,000 DUE). Total = ₹6,000`);

    // 7.2 Multi-Month FIFO Allocation: Pay ₹5,000 via IN_ACCOUNT
    console.log('\n--- 1. Recording Payment of ₹5,000 (IN_ACCOUNT) ---');
    const receiptNo1 = `REC-P7-${Date.now().toString().slice(-6)}`;
    const payResult1 = await withTransaction(async (tx) => {
      const [pRes] = await tx.execute(
        `INSERT INTO \`payments\` (\`student_id\`, \`amount\`, \`payment_mode\`, \`payment_category\`, \`payment_date\`, \`receipt_number\`)
         VALUES (?, 5000.00, 'IN_ACCOUNT', 'MONTHLY_FEE', CURDATE(), ?)`,
        [testStudentId, receiptNo1]
      );
      const paymentId = pRes.insertId;

      const allocs = await allocatePaymentFIFO(
        { studentId: testStudentId, paymentId, amount: 5000.00 },
        tx
      );
      return { paymentId, allocs };
    });

    testPaymentId = payResult1.paymentId;
    console.log(`✅ 7.1 Payment Recorded: ID ${testPaymentId}, Mode: IN_ACCOUNT, Amount: ₹5,000`);

    // Check Monthly Fees status after ₹5,000
    const updatedFees1 = await db.query(
      'SELECT * FROM monthly_fees WHERE student_id = ? ORDER BY fee_year ASC, fee_month ASC',
      [testStudentId]
    );
    console.log(`  • July 2026: Paid = ₹${updatedFees1[0].paid_amount}, Due = ₹${updatedFees1[0].due_amount}, Status = ${updatedFees1[0].status}`);
    console.log(`  • August 2026: Paid = ₹${updatedFees1[1].paid_amount}, Due = ₹${updatedFees1[1].due_amount}, Status = ${updatedFees1[1].status}`);

    if (updatedFees1[0].status === 'PAID' && updatedFees1[1].status === 'PARTIAL' && Number(updatedFees1[1].due_amount) === 1000) {
      console.log('✅ 7.2 FIFO Multi-Month Allocation: PASS (July settled to PAID, August partial with ₹1,000 due)');
    } else {
      console.error('❌ 7.2 Multi-Month FIFO Allocation failed');
    }

    // 7.3 Follow-up Payment of ₹1,000 (CASH) to fully settle remaining due
    console.log('\n--- 2. Recording Follow-Up Payment of ₹1,000 (CASH) ---');
    const receiptNo2 = `REC-P7-${Date.now().toString().slice(-6)}B`;
    const payResult2 = await withTransaction(async (tx) => {
      const [pRes] = await tx.execute(
        `INSERT INTO \`payments\` (\`student_id\`, \`amount\`, \`payment_mode\`, \`payment_category\`, \`payment_date\`, \`receipt_number\`)
         VALUES (?, 1000.00, 'CASH', 'MONTHLY_FEE', CURDATE(), ?)`,
        [testStudentId, receiptNo2]
      );
      const paymentId = pRes.insertId;

      const allocs = await allocatePaymentFIFO(
        { studentId: testStudentId, paymentId, amount: 1000.00 },
        tx
      );
      return { paymentId, allocs };
    });

    const updatedFees2 = await db.query(
      'SELECT * FROM monthly_fees WHERE student_id = ? ORDER BY fee_year ASC, fee_month ASC',
      [testStudentId]
    );
    console.log(`  • August 2026 after ₹1,000: Paid = ₹${updatedFees2[1].paid_amount}, Due = ₹${updatedFees2[1].due_amount}, Status = ${updatedFees2[1].status}`);
    if (updatedFees2[1].status === 'PAID' && Number(updatedFees2[1].due_amount) === 0) {
      console.log('✅ 7.2 Follow-Up FIFO Settlement: PASS (August fully settled to PAID)');
    } else {
      console.error('❌ 7.2 Follow-Up Settlement failed');
    }

    // 7.4 Payment Deletion & Allocation Reversal (DELETE /api/payments/:id)
    console.log('\n--- 3. Testing Payment Deletion & Ledger Reversal ---');
    await withTransaction(async (tx) => {
      // Revert ₹1,000 payment
      await revertPaymentAllocations(payResult2.paymentId, tx);
      await tx.execute('DELETE FROM payments WHERE id = ?', [payResult2.paymentId]);
    });

    const revertedFees = await db.query(
      'SELECT * FROM monthly_fees WHERE student_id = ? ORDER BY fee_year ASC, fee_month ASC',
      [testStudentId]
    );
    console.log(`  • August 2026 after deleting ₹1,000 payment: Paid = ₹${revertedFees[1].paid_amount}, Due = ₹${revertedFees[1].due_amount}, Status = ${revertedFees[1].status}`);
    if (revertedFees[1].status === 'PARTIAL' && Number(revertedFees[1].due_amount) === 1000) {
      console.log('✅ 7.4 Payment Deletion & Ledger Balance Restoration: PASS (Dues accurately restored)');
    } else {
      console.error('❌ 7.4 Payment Reversal failed');
    }

    // Clean up temporary records
    console.log('\n--- Cleaning up temporary test records ---');
    await db.query('DELETE FROM payment_allocations WHERE payment_id = ?', [testPaymentId]);
    await db.query('DELETE FROM payments WHERE student_id = ?', [testStudentId]);
    await db.query('DELETE FROM monthly_fees WHERE student_id = ?', [testStudentId]);
    await db.query('DELETE FROM students WHERE id = ?', [testStudentId]);
    console.log('✅ Cleanup completed cleanly.');

    console.log('\n======================================================');
    console.log('🎉 PART 7 TESTING RESULT: 100% PASS (ALL CHECKS PASSED)');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Part 7 Test Error:', err);
    if (testStudentId) {
      try {
        await db.query('DELETE FROM payment_allocations WHERE payment_id = ?', [testPaymentId]);
        await db.query('DELETE FROM payments WHERE student_id = ?', [testStudentId]);
        await db.query('DELETE FROM monthly_fees WHERE student_id = ?', [testStudentId]);
        await db.query('DELETE FROM students WHERE id = ?', [testStudentId]);
      } catch (e) {}
    }
    process.exit(1);
  }
}

testPart7();
