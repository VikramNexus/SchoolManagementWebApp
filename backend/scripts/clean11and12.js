/**
 * Remove Class 11 and Class 12 Script — School Management System
 * Deletes Class 11 & 12, their sections, and any students assigned to them.
 */

const db = require('../src/config/db');

async function clean11And12() {
  console.log('🧹 Removing Class 11 and Class 12 data...');

  try {
    // Disable foreign key checks
    await db.query('SET FOREIGN_KEY_CHECKS = 0');

    // Find class IDs for Class 11 and Class 12 (or XI / XII)
    const targetClasses = await db.query(
      "SELECT `id`, `name` FROM `classes` WHERE `name` LIKE '%11%' OR `name` LIKE '%12%' OR `name` LIKE '%XI%' OR `name` LIKE '%XII%'"
    );

    console.log('Target classes found:', targetClasses);

    if (targetClasses && targetClasses.length > 0) {
      const classIds = targetClasses.map(c => c.id);

      // Delete payments for students in Class 11 & 12
      await db.query(
        "DELETE FROM `payments` WHERE `student_id` IN (SELECT `id` FROM `students` WHERE `class_id` IN (?))",
        [classIds]
      );

      // Delete monthly fees for students in Class 11 & 12
      await db.query(
        "DELETE FROM `monthly_fees` WHERE `student_id` IN (SELECT `id` FROM `students` WHERE `class_id` IN (?))",
        [classIds]
      );

      // Delete additional fees for students in Class 11 & 12
      await db.query(
        "DELETE FROM `student_additional_fees` WHERE `student_id` IN (SELECT `id` FROM `students` WHERE `class_id` IN (?))",
        [classIds]
      );

      // Delete students in Class 11 & 12
      const sRes = await db.query(
        "DELETE FROM `students` WHERE `class_id` IN (?)",
        [classIds]
      );
      console.log(`✅ Deleted students assigned to Class 11 & 12.`);

      // Delete sections for Class 11 & 12
      await db.query(
        "DELETE FROM `sections` WHERE `class_id` IN (?)",
        [classIds]
      );
      console.log(`✅ Deleted sections belonging to Class 11 & 12.`);

      // Delete classes 11 & 12
      await db.query(
        "DELETE FROM `classes` WHERE `id` IN (?)",
        [classIds]
      );
      console.log(`✅ Deleted Class 11 and Class 12 from classes table.`);
    }

    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('===========================================================');
    console.log('🎉 MAX CLASS IS NOW 10TH! CLASSES 11 & 12 SUCCESSFULLY REMOVED!');
    console.log('===========================================================');
  } catch (err) {
    console.error('❌ Error cleaning Class 11 & 12:', err);
  } finally {
    await db.closePool();
    process.exit(0);
  }
}

clean11And12();
