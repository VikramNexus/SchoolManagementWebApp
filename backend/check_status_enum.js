const db = require('./src/config/db');

async function test() {
  try {
    await db.ensureDatabase();
    const cols = await db.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'status'`
    );
    console.log('Current status column type:', cols[0]?.COLUMN_TYPE);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.closePool();
  }
}

test();
