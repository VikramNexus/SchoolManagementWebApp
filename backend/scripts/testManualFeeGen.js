const db = require('../src/config/db');
const { generateMonthlyFeesForAllStudents } = require('../src/services/feeGeneratorService');

async function testManualFeeGen() {
  console.log('===========================================================');
  console.log('🚀 Testing Manual Fee Generation Flow');
  console.log('===========================================================');

  let s1Id, s2Id;

  try {
    await db.ensureDatabase();

    // 1. Create Student A with rate = 2000
    const s1 = await db.query(
      `INSERT INTO students (admission_no, full_name, class_id, category, monthly_fee_rate, status)
       VALUES ('FEE_TEST_01', 'Student A (Rs 2000)', 1, 'day_scholar', 2000.00, 'active')`
    );
    s1Id = s1.insertId;

    // 2. Create Student B with rate = 2500
    const s2 = await db.query(
      `INSERT INTO students (admission_no, full_name, class_id, category, monthly_fee_rate, status)
       VALUES ('FEE_TEST_02', 'Student B (Rs 2500)', 1, 'hosteller', 2500.00, 'active')`
    );
    s2Id = s2.insertId;

    // Verify 0 automatic fees generated on creation
    const s1FeesCount = await db.queryOne('SELECT COUNT(*) as cnt FROM monthly_fees WHERE student_id = ?', [s1Id]);
    console.log(`[Check 1] Auto fees for Student A on creation: ${s1FeesCount.cnt} (Expected: 0)`);

    // 3. Run Fee Generation for September 2026 (Month 9)
    console.log('[Check 2] Running Fee Generation for Target Month: September 2026...');
    const result = await generateMonthlyFeesForAllStudents(9, 2026);
    console.log('Generation Result:', result);

    // 4. Inspect generated fees for Student A & B
    const s1Fee = await db.queryOne('SELECT * FROM monthly_fees WHERE student_id = ? AND fee_month = 9 AND fee_year = 2026', [s1Id]);
    const s2Fee = await db.queryOne('SELECT * FROM monthly_fees WHERE student_id = ? AND fee_month = 9 AND fee_year = 2026', [s2Id]);

    console.log('Student A September Fee Ledger:', s1Fee);
    console.log('Student B September Fee Ledger:', s2Fee);

    if (Number(s1Fee.fee_amount) !== 2000 || Number(s1Fee.due_amount) !== 2000) {
      throw new Error(`Student A fee amount incorrect. Expected 2000, got ${s1Fee.fee_amount}`);
    }
    if (Number(s2Fee.fee_amount) !== 2500 || Number(s2Fee.due_amount) !== 2500) {
      throw new Error(`Student B fee amount incorrect. Expected 2500, got ${s2Fee.fee_amount}`);
    }

    console.log('===========================================================');
    console.log('✅ MANUAL FEE GENERATION VERIFIED 100% SUCCESS!');
    console.log('===========================================================');
  } catch (err) {
    console.error('❌ Test Failed:', err);
  } finally {
    if (s1Id) {
      await db.query('DELETE FROM monthly_fees WHERE student_id = ?', [s1Id]);
      await db.query('DELETE FROM students WHERE id = ?', [s1Id]);
    }
    if (s2Id) {
      await db.query('DELETE FROM monthly_fees WHERE student_id = ?', [s2Id]);
      await db.query('DELETE FROM students WHERE id = ?', [s2Id]);
    }
    await db.closePool();
  }
}

testManualFeeGen();
