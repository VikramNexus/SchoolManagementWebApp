const db = require('../src/config/db');
const { recordPayment } = require('../src/controllers/paymentController');
const { generateDuesNotice } = require('../src/controllers/receiptController');

async function debug() {
  try {
    await db.ensureDatabase();
    console.log('===========================================================');
    console.log('🔍 Debugging Record Payment & Dues Notice PDF Generation');
    console.log('===========================================================');

    // Fetch active student with dues
    const student = await db.queryOne(
      `SELECT s.id, s.full_name, s.admission_no FROM students s WHERE s.status = 'active' LIMIT 1`
    );

    if (!student) {
      console.log('No active student found.');
      return;
    }

    console.log('Selected Student:', student);

    // Test 1: Record Payment
    console.log('\n--- [Test 1] Executing recordPayment Controller ---');
    const reqPayment = {
      body: {
        student_id: student.id,
        amount: 1000,
        payment_date: new Date().toISOString().slice(0, 10),
        notes: 'Debug test payment',
        recorded_by: 1,
      }
    };
    const resPayment = {
      status: (code) => {
        console.log('Payment Status Code:', code);
        return resPayment;
      },
      json: (data) => {
        console.log('Payment Response Data:', data);
      }
    };

    await recordPayment(reqPayment, resPayment);

    // Test 2: Generate Dues Notice
    console.log('\n--- [Test 2] Executing generateDuesNotice Controller ---');
    const reqDues = { params: { studentId: student.id } };
    const resDues = {
      status: (code) => {
        console.log('Dues Notice Status Code:', code);
        return resDues;
      },
      json: (data) => {
        console.log('Dues Notice Response Data:', data);
      },
      download: (filePath, fileName) => {
        console.log('✅ Dues Notice Download Success! File:', filePath, 'Name:', fileName);
      }
    };

    await generateDuesNotice(reqDues, resDues);

  } catch (err) {
    console.error('❌ Debug Script Error:', err);
  } finally {
    await db.closePool();
  }
}

debug();
