const db = require('../src/config/db');

async function testQueries() {
  try {
    await db.ensureDatabase();

    console.log('Testing Students Query...');
    const students = await db.query(
      `SELECT s.*, c.name as class_name, sec.name as section_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.status != 'deleted'
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [25, 0]
    );
    console.log(`✅ Students Query Success! Rows fetched: ${students.length}`);

    console.log('Testing Payments Query...');
    const payments = await db.query(
      `SELECT
        p.*,
        COALESCE(r.receipt_number, p.receipt_number) as receipt_no,
        s.full_name as student_name,
        s.admission_no as student_admission_no,
        s.category as student_category,
        c.name as class_name,
        sec.name as section_name,
        u.full_name as recorder_name,
        u.username as recorder_username
      FROM payments p
      JOIN students s ON s.id = p.student_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      LEFT JOIN receipts r ON r.payment_id = p.id
      LEFT JOIN users u ON u.id = p.recorded_by
      ORDER BY p.payment_date DESC, p.created_at DESC
      LIMIT ? OFFSET ?`,
      [25, 0]
    );
    console.log(`✅ Payments Query Success! Rows fetched: ${payments.length}`);
  } catch (err) {
    console.error('❌ Query Test Failed:', err);
  } finally {
    await db.closePool();
  }
}

testQueries();
