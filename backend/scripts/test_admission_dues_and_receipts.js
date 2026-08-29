const db = require('../src/config/db');

async function testAdmissionDuesAndReceipts() {
  console.log('--- Testing Admission Dues Collection & Receipts Flow ---');

  // 1. Admin Login
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  }).then(r => r.json());

  const token = loginRes.token;

  // 2. Fetch Admission Dues list
  const duesRes = await fetch('http://localhost:5000/api/reports/admission-dues-list', {
    headers: { Authorization: 'Bearer ' + token },
  }).then(r => r.json());

  console.log(`Admission Dues endpoint returned ${duesRes.students?.length} students with pending dues.`);
  if (!duesRes.students || duesRes.students.length === 0) {
    console.log('No pending admission dues found currently, creating a test student with partial admission payment...');
  }

  // Find a student with admission dues or create one
  let targetStudent = duesRes.students?.[0];
  if (!targetStudent) {
    const cls = await db.queryOne('SELECT id FROM classes LIMIT 1');
    const enrollRes = await fetch('http://localhost:5000/api/admissions/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        full_name: 'Ananya Sharma',
        father_name: 'Rajesh Sharma',
        class_id: cls.id,
        phone: '9876543211',
        monthly_fee_rate: 1500,
        admission_fee_amount: 5000,
        collect_payment: true,
        paid_amount: 3000, // Short by 2000
        payment_mode: 'CASH',
      }),
    }).then(r => r.json());

    const refreshDues = await fetch('http://localhost:5000/api/reports/admission-dues-list', {
      headers: { Authorization: 'Bearer ' + token },
    }).then(r => r.json());
    targetStudent = refreshDues.students?.[0];
  }

  console.log(`Target student with pending admission dues: ${targetStudent.full_name}, Dues: ₹${targetStudent.admission_dues}`);

  // 3. Collect & Settle the admission due
  const payAmt = Number(targetStudent.admission_dues);
  const payRes = await fetch('http://localhost:5000/api/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({
      student_id: targetStudent.id,
      amount: payAmt,
      payment_mode: 'CASH',
      payment_category: 'ADMISSION_CHARGE',
      notes: `[Admission Collection] Dues cleared in full for ${targetStudent.full_name}`,
    }),
  }).then(r => r.json());

  console.log('Payment Recording Result:', payRes);
  if (!payRes.success) throw new Error('Payment collection failed: ' + payRes.message);

  const paymentId = payRes.payment.id;
  const receiptNum = payRes.payment.receipt_number;
  console.log(`Payment ID: ${paymentId}, Receipt Number: ${receiptNum}`);

  // 4. Verify Receipt exists in DB and is retrieved in /api/receipts?tab=admissions
  const receiptInDb = await db.queryOne('SELECT * FROM receipts WHERE payment_id = ?', [paymentId]);
  console.log('Receipt row in database:', receiptInDb);
  if (!receiptInDb) throw new Error('Receipt was not stored in receipts table!');

  const admReceiptsRes = await fetch('http://localhost:5000/api/receipts?tab=admissions', {
    headers: { Authorization: 'Bearer ' + token },
  }).then(r => r.json());

  const foundReceiptInList = admReceiptsRes.receipts?.find(r => r.payment_id === paymentId || r.id === receiptInDb.id);
  console.log('Found receipt in Admission Receipts list:', foundReceiptInList?.receipt_number);
  if (!foundReceiptInList) throw new Error('Receipt not listed in Admission Receipts endpoint');

  // 5. Verify Admission Collection in /api/payments/admissions
  const admCollectionsRes = await fetch('http://localhost:5000/api/payments/admissions', {
    headers: { Authorization: 'Bearer ' + token },
  }).then(r => r.json());

  const foundPaymentInList = admCollectionsRes.payments?.find(p => p.id === paymentId);
  console.log('Found payment in Admission Collections list:', foundPaymentInList?.id, 'Remaining dues:', foundPaymentInList?.remaining_dues);
  if (!foundPaymentInList) throw new Error('Payment not found in Admission Collections list');

  // 6. Verify dues for student are now cleared
  const duesAfterPay = await fetch(`http://localhost:5000/api/reports/admission-dues-list?search=${targetStudent.admission_no}`, {
    headers: { Authorization: 'Bearer ' + token },
  }).then(r => r.json());

  console.log(`Admission dues count for ${targetStudent.full_name} after payment: ${duesAfterPay.students?.length}`);
  if (duesAfterPay.students && duesAfterPay.students.length > 0) {
    throw new Error('Dues should be 0 and student removed from pending admission dues list');
  }

  console.log('✓ ALL ADMISSION DUES COLLECTION & RECEIPT GENERATION TESTS PASSED 100%!');
  process.exit(0);
}

testAdmissionDuesAndReceipts().catch((err) => {
  console.error('Test Error:', err);
  process.exit(1);
});
