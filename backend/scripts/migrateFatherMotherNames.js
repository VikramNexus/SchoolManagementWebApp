const db = require('../src/config/db');

async function migrateFatherMother() {
  try {
    await db.ensureDatabase();
    console.log('Migrating students table for father_name and mother_name...');

    // Add father_name
    try {
      await db.query(`ALTER TABLE students ADD COLUMN father_name VARCHAR(100) DEFAULT NULL AFTER parent_name`);
      console.log('✅ Added father_name column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ father_name column already exists');
      } else {
        console.error('Error adding father_name:', err.message);
      }
    }

    // Add mother_name
    try {
      await db.query(`ALTER TABLE students ADD COLUMN mother_name VARCHAR(100) DEFAULT NULL AFTER father_name`);
      console.log('✅ Added mother_name column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ mother_name column already exists');
      } else {
        console.error('Error adding mother_name:', err.message);
      }
    }

    // Backfill father_name from existing parent_name if null
    await db.query(`UPDATE students SET father_name = parent_name WHERE father_name IS NULL AND parent_name IS NOT NULL`);
    console.log('✅ Backfilled father_name from parent_name');

  } catch (err) {
    console.error('Migration Error:', err);
  } finally {
    await db.closePool();
  }
}

migrateFatherMother();
