const db = require('./src/config/db');

async function test() {
  try {
    await db.ensureDatabase();
    const fks = await db.query(
      `SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'students'`
    );
    console.log('FKs referencing students:', fks);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.closePool();
  }
}

test();
