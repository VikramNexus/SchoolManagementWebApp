const db = require('./src/config/db');

async function listAllStudents() {
  try {
    await db.ensureDatabase();
    const students = await db.query('SELECT `id`, `admission_no`, `full_name`, `status` FROM `students` ORDER BY `id` ASC');
    console.log('Current students in DB (total ' + students.length + '):');
    students.forEach(s => console.log(`ID: ${s.id} | AdmNo: ${s.admission_no} | Name: ${s.full_name} | Status: ${s.status}`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.closePool();
  }
}

listAllStudents();
