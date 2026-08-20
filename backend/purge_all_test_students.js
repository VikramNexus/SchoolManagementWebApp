const db = require('./src/config/db');

async function purgeAllStudents() {
  console.log('Purging all test/dummy students and associated ledgers/payments...');
  const conn = await db.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE `receipts`');
    await conn.query('TRUNCATE TABLE `payment_allocations`');
    await conn.query('TRUNCATE TABLE `payments`');
    await conn.query('TRUNCATE TABLE `monthly_fees`');
    await conn.query('TRUNCATE TABLE `student_additional_fees`');
    await conn.query('TRUNCATE TABLE `message_logs`');
    await conn.query('TRUNCATE TABLE `students`');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ ALL test/dummy students and financial records purged successfully. Database is now clean for fresh admissions!');
  } catch (err) {
    console.error('Purge error:', err);
  } finally {
    conn.release();
    await db.closePool();
  }
}

purgeAllStudents();
