/**
 * Day 8 Audit & Test Runner — Receipts & Messaging Foundation
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const { generateAndSaveReceipt, getNextReceiptNumber } = require('../src/services/pdfReceiptService');
const { sendSMS } = require('../src/services/smsService');
const { sendWhatsApp } = require('../src/services/whatsappService');

async function main() {
  console.log('===========================================================');
  console.log('🚀 Running Day 8 Receipts & Messaging Foundation Tests');
  console.log('===========================================================');

  let studentId, paymentId;

  try {
    await db.ensureDatabase();

    // Clean up any stale test records from previous runs in cascade order
    const staleStudents = await db.query(`SELECT id FROM students WHERE admission_no LIKE 'DAY8TEST%'`);
    for (const s of staleStudents) {
      await db.query(`DELETE FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE student_id = ?)`, [s.id]);
      await db.query(`DELETE FROM payments WHERE student_id = ?`, [s.id]);
      await db.query(`DELETE FROM message_logs WHERE student_id = ?`, [s.id]);
      await db.query(`DELETE FROM students WHERE id = ?`, [s.id]);
    }

    // Test 1: Get next receipt sequence number
    const nextReceiptNo = await getNextReceiptNumber(2026);
    console.log(`[Test 1] Next Receipt Sequence Number: ${nextReceiptNo}`);
    if (!nextReceiptNo.startsWith('REC-2026-')) {
      throw new Error('Invalid receipt number format: ' + nextReceiptNo);
    }

    // Test 2: Test SMS & WhatsApp Mock Mode
    console.log('[Test 2] Testing SMS Mock Mode...');
    const smsRes = await sendSMS('9876543210', 'Test SMS reminder for student', { student_id: 1 });
    console.log('SMS Mock Result:', smsRes);
    if (!smsRes || !smsRes.success) throw new Error('SMS Mock mode failed');

    console.log('[Test 2] Testing WhatsApp Mock Mode...');
    const waRes = await sendWhatsApp('9876543210', 'Test WhatsApp reminder for student', { student_id: 1 });
    console.log('WhatsApp Mock Result:', waRes);
    if (!waRes || !waRes.success) throw new Error('WhatsApp Mock mode failed');

    // Test 3: Test PDF Receipt Generation
    console.log('[Test 3] Testing PDF Receipt Generation...');
    const admissionNo = `DAY8TEST_${Date.now()}`;
    const dummyStudent = await db.query(
      `INSERT INTO students (admission_no, full_name, class_id, category, monthly_fee_rate, status)
       VALUES (?, 'Day 8 Audit Student', 1, 'day_scholar', 3000, 'active')`,
      [admissionNo]
    );
    studentId = dummyStudent.insertId;

    const dummyPayment = await db.query(
      `INSERT INTO payments (receipt_number, student_id, amount, payment_mode, payment_date, notes)
       VALUES (?, ?, 3000.00, 'CASH', CURRENT_DATE(), 'Day 8 Test Payment')`,
      [nextReceiptNo, studentId]
    );
    paymentId = dummyPayment.insertId;

    // Create receipt DB record first
    await db.query(
      `INSERT INTO receipts (receipt_number, payment_id)
       VALUES (?, ?)`,
      [nextReceiptNo, paymentId]
    );

    const receiptRes = await generateAndSaveReceipt(paymentId);
    console.log('PDF Receipt Generation Result:', receiptRes);
    if (!receiptRes || !receiptRes.filePath) {
      throw new Error('PDF Receipt Generation failed');
    }

    if (fs.existsSync(receiptRes.filePath)) {
      console.log(`✅ PDF Receipt created successfully at: ${receiptRes.filePath}`);
    } else {
      throw new Error('PDF file was not created on disk: ' + receiptRes.filePath);
    }

    console.log('===========================================================');
    console.log('✅ ALL DAY 8 RECEIPTS & MESSAGING TESTS PASSED 100%!');
    console.log('===========================================================');
  } catch (err) {
    console.error('❌ Day 8 Verification Failed:', err);
    process.exit(1);
  } finally {
    if (paymentId) {
      await db.query('DELETE FROM receipts WHERE payment_id = ?', [paymentId]);
      await db.query('DELETE FROM payments WHERE id = ?', [paymentId]);
    }
    if (studentId) {
      await db.query('DELETE FROM students WHERE id = ?', [studentId]);
      await db.query('DELETE FROM message_logs WHERE student_id = ?', [studentId]);
    }
    await db.closePool();
  }
}

main();

