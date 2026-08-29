/**
 * Migration: Add Admission & Family Sibling Support
 */

const db = require('../config/db');

async function migrate() {
  try {
    console.log('🚀 Starting migration for Admission Desk & Family Sibling Accounts...');

    // 1. Add family_id and opening_dues to students table
    const studentCols = await db.query('SHOW COLUMNS FROM students');
    const hasFamilyId = studentCols.some(c => c.Field === 'family_id');
    if (!hasFamilyId) {
      await db.query('ALTER TABLE `students` ADD COLUMN `family_id` VARCHAR(64) NULL AFTER `parent_name`, ADD INDEX `idx_students_family_id` (`family_id`)');
      console.log('✅ Added family_id column to students table');
    } else {
      console.log('ℹ️ family_id already exists in students table');
    }

    const hasOpeningDues = studentCols.some(c => c.Field === 'opening_dues');
    if (!hasOpeningDues) {
      await db.query('ALTER TABLE `students` ADD COLUMN `opening_dues` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `monthly_fee_rate`');
      console.log('✅ Added opening_dues column to students table');
    } else {
      console.log('ℹ️ opening_dues already exists in students table');
    }

    // 2. Add payment_category & family_id to payments table
    const paymentCols = await db.query('SHOW COLUMNS FROM payments');
    const hasPaymentCat = paymentCols.some(c => c.Field === 'payment_category');
    if (!hasPaymentCat) {
      await db.query(`
        ALTER TABLE \`payments\`
        ADD COLUMN \`payment_category\` VARCHAR(50) NOT NULL DEFAULT 'MONTHLY_FEE' AFTER \`payment_mode\`,
        ADD COLUMN \`family_id\` VARCHAR(64) NULL AFTER \`student_id\`,
        ADD INDEX \`idx_payments_family_id\` (\`family_id\`)
      `);
      console.log('✅ Added payment_category and family_id to payments table');
    } else {
      await db.query('ALTER TABLE `payments` MODIFY `payment_category` VARCHAR(50) NOT NULL DEFAULT \'MONTHLY_FEE\'');
      console.log('ℹ️ payment_category updated to VARCHAR(50)');
    }
    await db.query('ALTER TABLE `payments` MODIFY `payment_mode` VARCHAR(40) NOT NULL DEFAULT \'CASH\'');

    // 2b. Make users.email nullable
    try {
      await db.query('ALTER TABLE `users` MODIFY `email` VARCHAR(120) NULL DEFAULT NULL');
      console.log('✅ Updated users.email to allow NULL');
    } catch (e) {
      console.log('ℹ️ users.email already modified or error:', e.message);
    }

    // 2c. Update student_additional_fees columns
    try {
      const safCols = await db.query('SHOW COLUMNS FROM student_additional_fees');
      const safColNames = safCols.map(c => c.Field);
      if (!safColNames.includes('paid_amount')) {
        await db.query('ALTER TABLE student_additional_fees ADD COLUMN paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER amount');
      }
      if (!safColNames.includes('discount_amount')) {
        await db.query('ALTER TABLE student_additional_fees ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER paid_amount');
      }
      if (!safColNames.includes('discount_reason')) {
        await db.query('ALTER TABLE student_additional_fees ADD COLUMN discount_reason VARCHAR(255) DEFAULT NULL AFTER discount_amount');
      }
      await db.query('ALTER TABLE student_additional_fees MODIFY COLUMN fee_type_id INT UNSIGNED DEFAULT NULL');
      console.log('✅ student_additional_fees columns verified');
    } catch (e) {
      console.log('ℹ️ student_additional_fees update info:', e.message);
    }

    // 2d. Update payment_allocations columns
    try {
      const paCols = await db.query('SHOW COLUMNS FROM payment_allocations');
      const paColNames = paCols.map(c => c.Field);
      if (!paColNames.includes('additional_fee_id')) {
        await db.query('ALTER TABLE payment_allocations ADD COLUMN additional_fee_id INT UNSIGNED DEFAULT NULL AFTER monthly_fee_id');
      }
      await db.query('ALTER TABLE payment_allocations MODIFY COLUMN monthly_fee_id INT UNSIGNED DEFAULT NULL');
      console.log('✅ payment_allocations columns verified');
    } catch (e) {
      console.log('ℹ️ payment_allocations update info:', e.message);
    }

    // 3. Ensure standard fee types exist
    const standardFeeTypes = [
      { name: 'Admission Fee', description: 'One-time admission charge at enrollment', is_recurring: 0 },
      { name: 'Security Deposit', description: 'Caution / security deposit (refundable at leaving)', is_recurring: 0 },
      { name: 'Prospectus & Registration', description: 'Admission registration & prospectus fee', is_recurring: 0 },
      { name: 'Uniform Fee', description: 'School uniform kit', is_recurring: 0 },
      { name: 'Books & Stationery', description: 'Curriculum books & notebooks kit', is_recurring: 0 },
      { name: 'ID Card & Diary', description: 'Student identity card and school diary', is_recurring: 0 },
    ];

    for (const ft of standardFeeTypes) {
      const existing = await db.queryOne('SELECT id FROM fee_types WHERE name = ?', [ft.name]);
      if (!existing) {
        await db.query('INSERT INTO fee_types (name, description, is_recurring, is_active) VALUES (?, ?, ?, 1)', [
          ft.name,
          ft.description,
          ft.is_recurring,
        ]);
        console.log(`✅ Added fee type: ${ft.name}`);
      }
    }

    console.log('🎉 Migration finished successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await db.closePool();
  }
}

module.exports = { migrate };

// Allow running directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
