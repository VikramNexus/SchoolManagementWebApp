const db = require('../src/config/db');

async function backfillReceipts() {
  console.log('--- Backfilling Missing Receipts in Database ---');

  const paymentsWithoutReceipts = await db.query(`
    SELECT p.id, p.payment_category, p.receipt_number, p.notes
    FROM payments p
    LEFT JOIN receipts r ON r.payment_id = p.id
    WHERE r.id IS NULL
  `);

  console.log(`Found ${paymentsWithoutReceipts.length} payments missing a row in receipts table.`);

  for (const p of paymentsWithoutReceipts) {
    const isAdmission = p.payment_category === 'ADMISSION_CHARGE' || (p.notes && p.notes.toLowerCase().includes('admission'));
    const prefix = isAdmission ? 'ADM' : 'RCP';
    const rNo = p.receipt_number || `${prefix}-${String(p.id).padStart(6, '0')}`;

    await db.query(
      `INSERT INTO receipts (payment_id, receipt_number, file_path, generated_at)
       VALUES (?, ?, NULL, NOW())`,
      [p.id, rNo]
    );
  }

  console.log('✓ Successfully backfilled all receipts in database!');
  process.exit(0);
}

backfillReceipts().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
