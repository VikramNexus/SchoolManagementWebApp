const db = require('../src/config/db');

async function migrateSchema() {
  try {
    await db.ensureDatabase();
    console.log('Migrating student_additional_fees table schema...');

    // Add paid_amount if not exists
    try {
      await db.query(`ALTER TABLE student_additional_fees ADD COLUMN paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER amount`);
      console.log('✅ Added paid_amount column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ paid_amount column already exists');
      } else {
        console.error('Error adding paid_amount:', err.message);
      }
    }

    // Add due_amount if not exists
    try {
      await db.query(`ALTER TABLE student_additional_fees ADD COLUMN due_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER paid_amount`);
      console.log('✅ Added due_amount column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ due_amount column already exists');
      } else {
        console.error('Error adding due_amount:', err.message);
      }
    }

    // Sync due_amount = amount - paid_amount for all existing rows
    await db.query(`UPDATE student_additional_fees SET due_amount = (amount - paid_amount) WHERE due_amount = 0.00 AND status != 'PAID'`);
    console.log('✅ Synced due_amount values for existing student_additional_fees');

  } catch (err) {
    console.error('Migration Error:', err);
  } finally {
    await db.closePool();
  }
}

migrateSchema();
