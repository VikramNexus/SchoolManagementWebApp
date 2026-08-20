const db = require('../src/config/db');

async function checkStudents() {
  try {
    await db.ensureDatabase();
    const rows = await db.query(
      `SELECT id, admission_no, full_name, category, monthly_fee_rate FROM students ORDER BY id ASC`
    );
    console.log('Students in Database:');
    console.table(rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.closePool();
  }
}

checkStudents();
