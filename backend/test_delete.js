const db = require('./src/config/db');
const { deleteStudent } = require('./src/controllers/studentController');

async function test() {
  try {
    await db.ensureDatabase();

    const dummy = await db.query(
      `INSERT INTO students (admission_no, full_name, class_id, category, monthly_fee_rate, status)
       VALUES ('TEST9998', 'Dummy Test Student 2', 1, 'day_scholar', 3000, 'active')`
    );
    const dummyId = dummy.insertId;

    await db.query(
      `INSERT INTO message_logs (student_id, channel, recipient, message, status)
       VALUES (?, 'sms', '9999999999', 'Test message', 'mock')`,
      [dummyId]
    );

    const req = { params: { id: dummyId }, query: { mode: 'permanent' } };
    const res = {
      status(code) {
        console.log('Status code:', code);
        return this;
      },
      json(data) {
        console.log('Response JSON:', data);
        return this;
      }
    };

    await deleteStudent(req, res);
  } catch (err) {
    console.error('Caught error during delete test:', err);
  } finally {
    await db.closePool();
  }
}

test();
