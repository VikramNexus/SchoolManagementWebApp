const db = require('../src/config/db');

async function migrate() {
  try {
    await db.query("ALTER TABLE `payments` MODIFY COLUMN `payment_mode` VARCHAR(30) NOT NULL DEFAULT 'CASH'");
    console.log('✅ payments.payment_mode altered to VARCHAR(30) successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await db.closePool();
  }
}

migrate();
