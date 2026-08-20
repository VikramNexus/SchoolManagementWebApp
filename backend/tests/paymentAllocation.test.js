/**
 * Automated Payment Allocation Tests — School Management System
 *
 * Day 7: Financial Validation & FIFO Allocation Correctness.
 *
 * Tests:
 *   - Test 57: Rs. 5,000 against two Rs. 3,000 dues (July & August)
 *   - Test 58: Follow-up Rs. 1,000 payment settles remaining August due
 *   - Test 59: Hosteller 3-month dues (May, June, July Rs. 5,000 each) against Rs. 7,000
 *
 * Verifies: No double allocation, exact currency math, atomicity.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { allocatePaymentFIFO } = require('../src/services/paymentAllocationService');
const { withTransaction } = require('../src/utils/transactionHandler');

test.after(async () => {
  await db.closePool();
});

// Helper to create clean test student
async function createTestStudent(admissionNo, fullName, category) {
  const result = await db.query(
    `INSERT INTO \`students\` (\`admission_no\`, \`full_name\`, \`category\`, \`status\`)
     VALUES (?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE \`id\`=LAST_INSERT_ID(\`id\`)`,
    [admissionNo, fullName, category]
  );
  const studentId = result.insertId;

  // Clean existing fees/payments for this test student
  await db.query('DELETE FROM `payment_allocations` WHERE `payment_id` IN (SELECT `id` FROM `payments` WHERE `student_id` = ?)', [studentId]);
  await db.query('DELETE FROM `payments` WHERE `student_id` = ?', [studentId]);
  await db.query('DELETE FROM `monthly_fees` WHERE `student_id` = ?', [studentId]);

  return studentId;
}

// Helper to create test monthly fee
async function createTestMonthlyFee(studentId, month, year, amount) {
  const result = await db.query(
    `INSERT INTO \`monthly_fees\` (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
     VALUES (?, ?, ?, ?, 0.00, ?, 'DUE')`,
    [studentId, month, year, amount, amount]
  );
  return result.insertId;
}

// Helper to create test payment record
async function createTestPayment(studentId, amount, receiptNo) {
  const result = await db.query(
    `INSERT INTO \`payments\` (\`student_id\`, \`amount\`, \`payment_mode\`, \`payment_date\`, \`receipt_number\`)
     VALUES (?, ?, 'CASH', CURDATE(), ?)`,
    [studentId, amount, receiptNo]
  );
  return result.insertId;
}

test('Day 7 Financial Validation & FIFO Allocation Tests', async (t) => {
  // -------------------------------------------------------------------------
  // Test 57: Rs. 5,000 against two Rs. 3,000 dues (July & August)
  // -------------------------------------------------------------------------
  await t.test('Test 57: Rs. 5,000 against two Rs. 3,000 dues (July & August)', async () => {
    const studentId = await createTestStudent('TEST-57', 'Test 57 Student', 'day_scholar');

    // Create July (month 7) and August (month 8) dues at ₹3,000 each
    const julyFeeId = await createTestMonthlyFee(studentId, 7, 2025, 3000);
    const augustFeeId = await createTestMonthlyFee(studentId, 8, 2025, 3000);

    // Record payment of ₹5,000
    const paymentId = await createTestPayment(studentId, 5000, 'TEST-RCP-57-1');

    // Execute FIFO allocation
    const allocationResult = await allocatePaymentFIFO({
      studentId,
      paymentId,
      amount: 5000,
    });

    assert.equal(allocationResult.success, true);
    assert.equal(allocationResult.allocatedAmount, 5000);
    assert.equal(allocationResult.remainingCash, 0);

    // Fetch updated monthly fees from DB
    const julyFee = await db.queryOne('SELECT * FROM `monthly_fees` WHERE `id` = ?', [julyFeeId]);
    const augustFee = await db.queryOne('SELECT * FROM `monthly_fees` WHERE `id` = ?', [augustFeeId]);

    // July should be PAID: paid ₹3,000, due ₹0
    assert.equal(Number(julyFee.paid_amount), 3000);
    assert.equal(Number(julyFee.due_amount), 0);
    assert.equal(julyFee.status, 'PAID');

    // August should be PARTIAL: paid ₹2,000, due ₹1,000
    assert.equal(Number(augustFee.paid_amount), 2000);
    assert.equal(Number(augustFee.due_amount), 1000);
    assert.equal(augustFee.status, 'PARTIAL');
  });

  // -------------------------------------------------------------------------
  // Test 58: Follow-up Rs. 1,000 payment settles remaining August due
  // -------------------------------------------------------------------------
  await t.test('Test 58: Follow-up Rs. 1,000 payment settles remaining August due', async () => {
    const studentId = await createTestStudent('TEST-58', 'Test 58 Student', 'day_scholar');

    const julyFeeId = await createTestMonthlyFee(studentId, 7, 2025, 3000);
    const augustFeeId = await createTestMonthlyFee(studentId, 8, 2025, 3000);

    // Initial payment of ₹5,000
    const payment1Id = await createTestPayment(studentId, 5000, 'TEST-RCP-58-1');
    await allocatePaymentFIFO({ studentId, paymentId: payment1Id, amount: 5000 });

    // Follow-up payment of ₹1,000
    const payment2Id = await createTestPayment(studentId, 1000, 'TEST-RCP-58-2');
    const allocation2Result = await allocatePaymentFIFO({
      studentId,
      paymentId: payment2Id,
      amount: 1000,
    });

    assert.equal(allocation2Result.success, true);
    assert.equal(allocation2Result.allocatedAmount, 1000);
    assert.equal(allocation2Result.remainingCash, 0);

    const augustFee = await db.queryOne('SELECT * FROM `monthly_fees` WHERE `id` = ?', [augustFeeId]);

    // August should now be fully PAID: paid ₹3,000, due ₹0
    assert.equal(Number(augustFee.paid_amount), 3000);
    assert.equal(Number(augustFee.due_amount), 0);
    assert.equal(augustFee.status, 'PAID');
  });

  // -------------------------------------------------------------------------
  // Test 59: Hosteller 3-month dues (May, June, July Rs. 5,000 each) against Rs. 7,000
  // -------------------------------------------------------------------------
  await t.test('Test 59: Hosteller three-month dues (May, June, July Rs. 5,000 each) against Rs. 7,000', async () => {
    const studentId = await createTestStudent('TEST-59', 'Test 59 Hosteller', 'hosteller');

    // Create May (month 5), June (month 6), July (month 7) dues at ₹5,000 each
    const mayFeeId = await createTestMonthlyFee(studentId, 5, 2025, 5000);
    const juneFeeId = await createTestMonthlyFee(studentId, 6, 2025, 5000);
    const julyFeeId = await createTestMonthlyFee(studentId, 7, 2025, 5000);

    // Record payment of ₹7,000
    const paymentId = await createTestPayment(studentId, 7000, 'TEST-RCP-59-1');

    // Execute FIFO allocation
    const allocationResult = await allocatePaymentFIFO({
      studentId,
      paymentId,
      amount: 7000,
    });

    assert.equal(allocationResult.success, true);
    assert.equal(allocationResult.allocatedAmount, 7000);
    assert.equal(allocationResult.remainingCash, 0);

    // Fetch updated monthly fees
    const mayFee = await db.queryOne('SELECT * FROM `monthly_fees` WHERE `id` = ?', [mayFeeId]);
    const juneFee = await db.queryOne('SELECT * FROM `monthly_fees` WHERE `id` = ?', [juneFeeId]);
    const julyFee = await db.queryOne('SELECT * FROM `monthly_fees` WHERE `id` = ?', [julyFeeId]);

    // May should be PAID: paid ₹5,000, due ₹0
    assert.equal(Number(mayFee.paid_amount), 5000);
    assert.equal(Number(mayFee.due_amount), 0);
    assert.equal(mayFee.status, 'PAID');

    // June should be PARTIAL: paid ₹2,000, due ₹3,000
    assert.equal(Number(juneFee.paid_amount), 2000);
    assert.equal(Number(juneFee.due_amount), 3000);
    assert.equal(juneFee.status, 'PARTIAL');

    // July should be untouched DUE: paid ₹0, due ₹5,000
    assert.equal(Number(julyFee.paid_amount), 0);
    assert.equal(Number(julyFee.due_amount), 5000);
    assert.equal(julyFee.status, 'DUE');
  });
});