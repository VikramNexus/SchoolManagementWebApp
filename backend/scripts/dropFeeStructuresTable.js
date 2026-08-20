const db = require('../src/config/db');

async function dropFeeStructures() {
  try {
    await db.ensureDatabase();
    console.log('Dropping pre-defined fee_structures table from database...');

    await db.query(`DROP TABLE IF EXISTS fee_structures`);
    console.log('✅ Successfully dropped fee_structures table');

  } catch (err) {
    console.error('Error dropping fee_structures table:', err);
  } finally {
    await db.closePool();
  }
}

dropFeeStructures();
