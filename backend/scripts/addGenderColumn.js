/**
 * Add Gender Column Script — School Management System
 * Adds `gender` ENUM/VARCHAR column to `students` table if not already present.
 */

const db = require('../src/config/db');

async function addGenderColumn() {
  console.log('🛠️ Adding gender column to students table...');

  try {
    const columns = await db.query("SHOW COLUMNS FROM `students` LIKE 'gender'");
    if (columns.length === 0) {
      await db.query("ALTER TABLE `students` ADD COLUMN `gender` VARCHAR(20) DEFAULT 'male' AFTER `full_name`");
      console.log('✅ Added `gender` column to `students` table.');
    } else {
      console.log('ℹ️ `gender` column already exists in `students` table.');
    }

    // Update seeded students to have realistic gender if missing
    await db.query("UPDATE `students` SET `gender` = 'male' WHERE `gender` IS NULL OR `gender` = ''");

    console.log('===========================================================');
    console.log('🎉 GENDER COLUMN CONFIGURED SUCCESSFULLY IN DATABASE!');
    console.log('===========================================================');
  } catch (err) {
    console.error('❌ Error adding gender column:', err);
  } finally {
    await db.closePool();
    process.exit(0);
  }
}

addGenderColumn();
