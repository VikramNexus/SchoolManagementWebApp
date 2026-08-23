const db = require('../src/config/db');

async function run() {
  try {
    await db.query("ALTER TABLE `payments` MODIFY COLUMN `payment_mode` VARCHAR(50) NOT NULL DEFAULT 'CASH'");
    console.log('✅ payments.payment_mode altered to VARCHAR(50) successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error altering table:', err);
    process.exit(1);
  }
}

run();
