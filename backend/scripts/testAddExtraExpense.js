const db = require('../src/config/db');

async function testAddExtraExpense() {
  try {
    await db.ensureDatabase();
    console.log('Testing student_additional_fees insertion...');

    // Get a student id
    const student = await db.queryOne('SELECT id FROM students LIMIT 1');
    if (!student) {
      console.log('No student found');
      return;
    }

    const studentId = student.id;
    console.log('Testing for student ID:', studentId);

    // Test insert
    const descText = 'Hostel medical expenses';
    const amount = 500;
    const month = 9;
    const year = 2026;

    // Check columns of student_additional_fees
    const cols = await db.query('SHOW COLUMNS FROM student_additional_fees');
    console.log('Columns in student_additional_fees:', cols.map(c => c.Field));

    const result = await db.query(
      `INSERT INTO \`student_additional_fees\`
       (\`student_id\`, \`fee_type_id\`, \`fee_month\`, \`fee_year\`, \`amount\`, \`paid_amount\`, \`due_amount\`, \`description\`, \`status\`)
       VALUES (?, 1, ?, ?, ?, 0.00, ?, ?, 'DUE')`,
      [studentId, month, year, amount, amount, descText]
    );

    console.log('✅ Inserted extra expense successfully, ID:', result.insertId);

  } catch (err) {
    console.error('❌ Insert Error:', err.message, err.stack);
  } finally {
    await db.closePool();
  }
}

testAddExtraExpense();
