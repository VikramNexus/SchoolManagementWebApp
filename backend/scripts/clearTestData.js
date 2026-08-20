/**
 * Clear All Test Data Script — School Management System
 * Wipes out test receipts, payments, additional fees, monthly fees, and students,
 * leaving the application fresh and clean for production use.
 */

const db = require('../src/config/db');

async function clearTestData() {
  console.log('🧹 Starting cleanup of test data...');

  try {
    // Disable foreign key checks for clean truncation/deletion
    await db.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Delete Receipts
    const rRes = await db.query('DELETE FROM `receipts`');
    await db.query('ALTER TABLE `receipts` AUTO_INCREMENT = 1');
    console.log(`✅ Deleted receipts records.`);

    // 2. Delete Payments
    const pRes = await db.query('DELETE FROM `payments`');
    await db.query('ALTER TABLE `payments` AUTO_INCREMENT = 1');
    console.log(`✅ Deleted payments records.`);

    // 3. Delete Student Additional Fees (Extra Expenses)
    const afRes = await db.query('DELETE FROM `student_additional_fees`');
    await db.query('ALTER TABLE `student_additional_fees` AUTO_INCREMENT = 1');
    console.log(`✅ Deleted student additional fees records.`);

    // 4. Delete Monthly Fees
    const mfRes = await db.query('DELETE FROM `monthly_fees`');
    await db.query('ALTER TABLE `monthly_fees` AUTO_INCREMENT = 1');
    console.log(`✅ Deleted monthly fees records.`);

    // 5. Delete Students
    const sRes = await db.query('DELETE FROM `students`');
    await db.query('ALTER TABLE `students` AUTO_INCREMENT = 1');
    console.log(`✅ Deleted test students records.`);

    // Re-enable foreign key checks
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('===========================================================');
    console.log('🎉 ALL TEST DATA REMOVED SUCCESSFULLY! SYSTEM IS FRESH & CLEAN!');
    console.log('===========================================================');
  } catch (err) {
    console.error('❌ Error clearing test data:', err);
  } finally {
    await db.closePool();
    process.exit(0);
  }
}

clearTestData();
