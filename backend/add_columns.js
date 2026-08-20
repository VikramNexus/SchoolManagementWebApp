/**
 * Add Columns Migration Script — School Management System
 * Dynamic schema migration for monthly_fee_rate column.
 */

const db = require('./src/config/db');

async function migrate() {
  console.log('Running schema migration for students.monthly_fee_rate...');
  try {
    await db.ensureDatabase();
    
    // Check if monthly_fee_rate column exists
    const cols = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'monthly_fee_rate'`
    );

    if (cols.length === 0) {
      console.log('Adding monthly_fee_rate column to students table...');
      await db.query(
        `ALTER TABLE \`students\` ADD COLUMN \`monthly_fee_rate\` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER \`admission_date\``
      );
      console.log('Column monthly_fee_rate added successfully.');

      // Update existing sample students based on default rates (Day Scholar: 3000, Hosteller: 5000)
      await db.query(`UPDATE \`students\` SET \`monthly_fee_rate\` = 3000.00 WHERE \`category\` = 'day_scholar' AND \`monthly_fee_rate\` = 0.00`);
      await db.query(`UPDATE \`students\` SET \`monthly_fee_rate\` = 5000.00 WHERE \`category\` = 'hosteller' AND \`monthly_fee_rate\` = 0.00`);
      console.log('Populated default monthly_fee_rate for existing students.');
    } else {
      console.log('Column monthly_fee_rate already exists.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await db.closePool();
  }
}

migrate();