const db = require('../src/config/db');
const { getPaymentAllocations, generateAndSaveReceipt } = require('../src/services/pdfReceiptService');

async function debugReceipt() {
  const payments = await db.query('SELECT id, student_id, amount, payment_mode, payment_date, receipt_number FROM payments ORDER BY id DESC LIMIT 10');
  console.log('Payments in database:', payments);

  for (const p of payments) {
    console.log(`\n=== Testing Receipt for Payment ID: ${p.id} (${p.receipt_number}) ===`);
    try {
      const paymentRow = await db.queryOne(
        `SELECT p.*, r.\`id\` as receipt_id, r.\`receipt_number\`, r.\`file_path\`, r.\`generated_at\` as receipt_created_at,
                s.\`full_name\`, s.\`admission_no\`, s.\`class_id\`, s.\`section_id\`, s.\`category\`, s.\`phone\`, s.\`whatsapp_number\`,
                c.\`name\` as class_name, sec.\`name\` as section_name
         FROM \`payments\` p
         LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
         LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
         LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
         LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
         WHERE p.\`id\` = ?`,
        [p.id]
      );
      console.log('  Payment row found: YES', '| Student:', paymentRow?.full_name, '| Receipt No:', paymentRow?.receipt_number);

      if (!paymentRow.receipt_id || !paymentRow.file_path) {
        console.log('  Receipt missing or pending, auto-generating...');
        const genRes = await generateAndSaveReceipt(p.id);
        console.log('  Generated PDF file path:', genRes.filePath);
      }

      const allocations = await getPaymentAllocations(p.id);
      console.log('  Allocations count:', allocations.length);
      console.log('  ✅ Status: SUCCESS');
    } catch (err) {
      console.error(`  ❌ ERROR for payment ${p.id}:`, err);
    }
  }
  process.exit(0);
}

debugReceipt();
