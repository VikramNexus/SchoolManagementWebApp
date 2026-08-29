const db = require('../src/config/db');

async function migrate() {
  console.log('--- Running Admission Allocations & Discount Migration ---');

  try {
    // 1. Modify payment_allocations to allow nullable monthly_fee_id
    try {
      await db.query('ALTER TABLE `payment_allocations` MODIFY `monthly_fee_id` INT UNSIGNED NULL');
      console.log('✓ Modified payment_allocations.monthly_fee_id to allow NULL');
    } catch (e) {
      console.log('payment_allocations.monthly_fee_id already nullable or error:', e.message);
    }

    // 2. Add additional_fee_id to payment_allocations
    try {
      await db.query('ALTER TABLE `payment_allocations` ADD COLUMN `additional_fee_id` INT UNSIGNED NULL AFTER `monthly_fee_id`');
      console.log('✓ Added additional_fee_id to payment_allocations');
    } catch (e) {
      console.log('payment_allocations.additional_fee_id column already exists or error:', e.message);
    }

    // 3. Add discount columns to student_additional_fees
    try {
      await db.query('ALTER TABLE `student_additional_fees` ADD COLUMN `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `amount`');
      console.log('✓ Added paid_amount to student_additional_fees');
    } catch (e) {
      console.log('student_additional_fees.paid_amount already exists or error:', e.message);
    }

    try {
      await db.query('ALTER TABLE `student_additional_fees` ADD COLUMN `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `paid_amount`');
      console.log('✓ Added discount_amount to student_additional_fees');
    } catch (e) {
      console.log('student_additional_fees.discount_amount already exists or error:', e.message);
    }

    try {
      await db.query('ALTER TABLE `student_additional_fees` ADD COLUMN `discount_reason` VARCHAR(255) NULL AFTER `discount_amount`');
      console.log('✓ Added discount_reason to student_additional_fees');
    } catch (e) {
      console.log('student_additional_fees.discount_reason already exists or error:', e.message);
    }

    console.log('--- Migration Finished Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
