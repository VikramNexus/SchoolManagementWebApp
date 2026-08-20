/**
 * Migration: Add Admission & Family Sibling Support
 */

const db = require('../config/db');

async function migrate() {
  try {
    console.log('🚀 Starting migration for Admission Desk & Family Sibling Accounts...');

    // 1. Add family_id to students table
    const studentCols = await db.query('SHOW COLUMNS FROM students');
    const hasFamilyId = studentCols.some(c => c.Field === 'family_id');
    if (!hasFamilyId) {
      await db.query('ALTER TABLE `students` ADD COLUMN `family_id` VARCHAR(64) NULL AFTER `parent_name`, ADD INDEX `idx_students_family_id` (`family_id`)');
      console.log('✅ Added family_id column to students table');
    } else {
      console.log('ℹ️ family_id already exists in students table');
    }

    // 2. Add payment_category & family_id to payments table
    const paymentCols = await db.query('SHOW COLUMNS FROM payments');
    const hasPaymentCat = paymentCols.some(c => c.Field === 'payment_category');
    if (!hasPaymentCat) {
      await db.query(`
        ALTER TABLE \`payments\`
        ADD COLUMN \`payment_category\` ENUM('MONTHLY_FEE', 'ADMISSION_CHARGE', 'FAMILY_FEE', 'CUSTOM_FEE') NOT NULL DEFAULT 'MONTHLY_FEE' AFTER \`payment_mode\`,
        ADD COLUMN \`family_id\` VARCHAR(64) NULL AFTER \`student_id\`,
        ADD INDEX \`idx_payments_family_id\` (\`family_id\`)
      `);
      console.log('✅ Added payment_category and family_id to payments table');
    } else {
      console.log('ℹ️ payment_category already exists in payments table');
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

migrate();
