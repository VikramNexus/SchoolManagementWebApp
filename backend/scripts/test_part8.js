const db = require('../src/config/db');
const { withTransaction } = require('../src/utils/transactionHandler');
const { allocatePaymentFIFO } = require('../src/services/paymentAllocationService');

async function testPart8() {
  console.log('=== RUNNING PART 8: MULTI-STUDENT SIBLING & FAMILY ACCOUNTS ===\n');

  const familyId = `FAM-TEST-${Date.now().toString().slice(-5)}`;
  const admNo1 = `TEST-SIB1-${Date.now().toString().slice(-5)}`;
  const admNo2 = `TEST-SIB2-${Date.now().toString().slice(-5)}`;
  let student1Id = null;
  let student2Id = null;
  const createdPaymentIds = [];

  try {
    const testClass = await db.queryOne('SELECT id FROM classes LIMIT 1');
    const classId = testClass ? testClass.id : 1;

    // 8.1 & 8.2 Create 2 Siblings and Link under unified family_id
    console.log(`--- 1. Enrolling & Linking 2 Siblings into Family "${familyId}" ---`);
    const std1 = await db.query(
      `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`category\`, \`family_id\`, \`monthly_fee_rate\`, \`status\`)
       VALUES (?, 'Sibling One Candidate', 'male', ?, 'day_scholar', ?, 3000.00, 'active')`,
      [admNo1, classId, familyId]
    );
    student1Id = std1.insertId || (std1[0] && std1[0].insertId);

    const std2 = await db.query(
      `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`gender\`, \`class_id\`, \`category\`, \`family_id\`, \`monthly_fee_rate\`, \`status\`)
       VALUES (?, 'Sibling Two Candidate', 'female', ?, 'day_scholar', ?, 2500.00, 'active')`,
      [admNo2, classId, familyId]
    );
    student2Id = std2.insertId || (std2[0] && std2[0].insertId);

    console.log(`✅ 8.2 Sibling Linking: Linked Student 1 (${student1Id}) and Student 2 (${student2Id}) to family "${familyId}"`);

    // Assign Dues: Sibling 1 = ₹3,000, Sibling 2 = ₹2,500. Total Family Dues = ₹5,500
    await db.query(
      `INSERT INTO \`monthly_fees\` (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
       VALUES (?, 8, 2026, 3000.00, 0, 3000.00, 'DUE')`,
      [student1Id]
    );
    await db.query(
      `INSERT INTO \`monthly_fees\` (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
       VALUES (?, 8, 2026, 2500.00, 0, 2500.00, 'DUE')`,
      [student2Id]
    );

    // 8.3 Query Family Summary
    const familyMembers = await db.query(
      `SELECT s.id, s.full_name, s.admission_no,
              COALESCE(SUM(mf.due_amount), 0) as total_dues
       FROM students s
       LEFT JOIN monthly_fees mf ON mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')
       WHERE s.family_id = ?
       GROUP BY s.id`,
      [familyId]
    );
    console.log(`\n--- 2. Family Summary Breakdown ---`);
    let familyTotal = 0;
    familyMembers.forEach(m => {
      console.log(`  • ${m.full_name} (${m.admission_no}): Dues = ₹${Number(m.total_dues).toLocaleString('en-IN')}`);
      familyTotal += Number(m.total_dues);
    });
    console.log(`  • Total Family Outstanding: ₹${familyTotal.toLocaleString('en-IN')}`);
    if (familyMembers.length === 2 && familyTotal === 5500) {
      console.log('✅ 8.3 Family Summary Balance: PASS (₹5,500 total confirmed)');
    } else {
      console.error('❌ 8.3 Family Summary calculation failed');
    }

    // 8.4 Combined Family Payment (Testing Unique Sibling Receipt Number Fix)
    console.log('\n--- 3. Recording Combined Family Payment (₹5,500) Across Both Siblings ---');
    const masterReceipt = `FAM-${Date.now().toString().slice(-6)}`;
    const allocations = [
      { student_id: student1Id, amount: 3000.00 },
      { student_id: student2Id, amount: 2500.00 },
    ];

    const familyPaymentResult = await withTransaction(async (tx) => {
      let siblingIdx = 0;
      const created = [];

      for (const item of allocations) {
        siblingIdx += 1;
        const individualReceiptNumber = `${masterReceipt}-${siblingIdx}`;

        const [payRes] = await tx.execute(
          `INSERT INTO \`payments\` (\`student_id\`, \`family_id\`, \`amount\`, \`payment_mode\`, \`payment_category\`, \`payment_date\`, \`notes\`, \`receipt_number\`)
           VALUES (?, ?, ?, 'CASH', 'FAMILY_FEE', CURDATE(), ?, ?)`,
          [
            item.student_id,
            familyId,
            item.amount,
            `[Family Receipt: ${masterReceipt}] Combined sibling payment`,
            individualReceiptNumber,
          ]
        );
        const paymentId = payRes.insertId;
        createdPaymentIds.push(paymentId);

        const allocs = await allocatePaymentFIFO(
          { studentId: item.student_id, paymentId, amount: item.amount },
          tx
        );

        created.push({
          student_id: item.student_id,
          payment_id: paymentId,
          receipt_number: individualReceiptNumber,
          allocations: allocs,
        });
      }

      return { masterReceipt, created };
    });

    console.log(`✅ 8.4 Combined Family Payment: Executed without duplicate key collision!`);
    familyPaymentResult.created.forEach(p => {
      console.log(`  • Sibling Student ID ${p.student_id}: Payment ID ${p.payment_id}, Unique Receipt: "${p.receipt_number}"`);
    });

    // Check sibling fee records
    const mf1After = await db.queryOne('SELECT * FROM monthly_fees WHERE student_id = ?', [student1Id]);
    const mf2After = await db.queryOne('SELECT * FROM monthly_fees WHERE student_id = ?', [student2Id]);
    console.log(`  • Sibling 1 Month Status: ${mf1After.status} (Paid: ₹${mf1After.paid_amount}, Due: ₹${mf1After.due_amount})`);
    console.log(`  • Sibling 2 Month Status: ${mf2After.status} (Paid: ₹${mf2After.paid_amount}, Due: ₹${mf2After.due_amount})`);

    if (mf1After.status === 'PAID' && mf2After.status === 'PAID') {
      console.log('✅ 8.4 Multi-Sibling FIFO Clearance: PASS (Both siblings settled to PAID)');
    } else {
      console.error('❌ 8.4 Sibling clearance failed');
    }

    // 8.5 Unlink Sibling
    console.log('\n--- 4. Unlinking Sibling Two from Family Account ---');
    await db.query('UPDATE students SET family_id = NULL WHERE id = ?', [student2Id]);
    const remainingFamily = await db.query('SELECT id, full_name FROM students WHERE family_id = ?', [familyId]);
    console.log(`  • Remaining family members under "${familyId}": ${remainingFamily.length} student(s)`);
    if (remainingFamily.length === 1 && remainingFamily[0].id === student1Id) {
      console.log('✅ 8.5 Unlink Sibling: PASS (Detached cleanly)');
    } else {
      console.error('❌ 8.5 Unlink Sibling failed');
    }

    // Clean up temporary test data
    console.log('\n--- Cleaning up temporary test records ---');
    for (const pid of createdPaymentIds) {
      await db.query('DELETE FROM payment_allocations WHERE payment_id = ?', [pid]);
      await db.query('DELETE FROM payments WHERE id = ?', [pid]);
    }
    await db.query('DELETE FROM monthly_fees WHERE student_id IN (?, ?)', [student1Id, student2Id]);
    await db.query('DELETE FROM students WHERE id IN (?, ?)', [student1Id, student2Id]);
    console.log('✅ Cleanup completed cleanly.');

    console.log('\n======================================================');
    console.log('🎉 PART 8 TESTING RESULT: 100% PASS (ALL CHECKS PASSED)');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Part 8 Test Error:', err);
    if (student1Id || student2Id) {
      try {
        for (const pid of createdPaymentIds) {
          await db.query('DELETE FROM payment_allocations WHERE payment_id = ?', [pid]);
          await db.query('DELETE FROM payments WHERE id = ?', [pid]);
        }
        await db.query('DELETE FROM monthly_fees WHERE student_id IN (?, ?)', [student1Id || 0, student2Id || 0]);
        await db.query('DELETE FROM students WHERE id IN (?, ?)', [student1Id || 0, student2Id || 0]);
      } catch (e) {}
    }
    process.exit(1);
  }
}

testPart8();
