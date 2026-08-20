const db = require('../src/config/db');

async function migrateExtraFeesMonthYear() {
  try {
    await db.ensureDatabase();
    console.log('Migrating student_additional_fees table to add fee_month and fee_year columns...');

    const cols = await db.query(`SHOW COLUMNS FROM student_additional_fees LIKE 'fee_month'`);
    if (cols.length === 0) {
      await db.query(`ALTER TABLE student_additional_fees ADD COLUMN fee_month INT UNSIGNED DEFAULT NULL AFTER fee_type_id`);
      console.log('✅ Added fee_month column');
    } else {
      console.log('ℹ️ fee_month column already exists');
    }

    const colsYear = await db.query(`SHOW COLUMNS FROM student_additional_fees LIKE 'fee_year'`);
    if (colsYear.length === 0) {
      await db.query(`ALTER TABLE student_additional_fees ADD COLUMN fee_year INT UNSIGNED DEFAULT NULL AFTER fee_month`);
      console.log('✅ Added fee_year column');
    } else {
      console.log('ℹ️ fee_year column already exists');
    }

    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await db.closePool();
  }
}

migrateExtraFeesMonthYear();
