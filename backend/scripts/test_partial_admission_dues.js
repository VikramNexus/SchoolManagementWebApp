const db = require('../src/config/db');

async function testPartialAdmissionDues() {
  console.log('--- Testing Partial Admission Dues, Concessions, & WhatsApp ---');

  // 1. Get class & section
  const cls = await db.queryOne('SELECT id FROM classes LIMIT 1');
  const sec = await db.queryOne('SELECT id FROM sections LIMIT 1');

  const testAdmNo = `TEST-ADM-${Date.now().toString().slice(-4)}`;
  const studentPayload = {
    full_name: 'Rohit Verma',
    father_name: 'Sanjay Verma',
    class_id: cls.id,
    section_id: sec ? sec.id : null,
    phone: '9876543210',
    whatsapp_number: '9876543210',
    monthly_fee_rate: 1500,
    include_advance_month: true,
    admission_fee_amount: 5000,
    security_deposit_amount: 3000,
    custom_expenses: [{ description: 'ID Card & Diary', amount: 570 }],
    collect_payment: true,
    paid_amount: 8000, // Total = 1500 + 5000 + 3000 + 570 = 10070. Paid = 8000. Dues = 2070.
    payment_mode: 'CASH',
  };

  // Login as admin
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  }).then(r => r.json());

  const token = loginRes.token;

  // 2. Enroll student
  const enrollRes = await fetch('http://localhost:5000/api/admissions/enroll', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(studentPayload),
  }).then(r => r.json());

  console.log('Enrollment Result:', JSON.stringify(enrollRes, null, 2));
  if (!enrollRes.success) throw new Error('Enrollment failed');

  const studentId = enrollRes.student_id;

  // 3. Fetch profile & check dues calculation
  const profileRes = await fetch(`http://localhost:5000/api/students/${studentId}/profile`, {
    headers: { Authorization: 'Bearer ' + token },
  }).then(r => r.json());

  console.log('Profile Student Name:', profileRes.student?.full_name);
  console.log('Additional Fees Breakdown:');
  profileRes.additional_fees?.forEach(f => {
    console.log(` - ${f.description}: Total ₹${f.amount}, Paid ₹${f.paid_amount || 0}, Status: ${f.status}`);
  });

  const { getTotalOutstanding } = require('../src/services/paymentAllocationService');
  const outstanding = await getTotalOutstanding(studentId);
  console.log(`Total Outstanding Dues calculated: ₹${outstanding} (Expected: ₹2070)`);

  if (outstanding !== 2070) {
    throw new Error(`Expected ₹2070 dues but got ₹${outstanding}`);
  }
  console.log('✓ Partial admission dues calculated with 100% precision!');

  // 4. Test Discount / Concession on an additional fee (e.g. ₹500 relief on Security Deposit)
  const secDepositFee = profileRes.additional_fees.find(f => f.description.includes('Security'));
  if (secDepositFee) {
    const discRes = await fetch(`http://localhost:5000/api/students/${studentId}/additional-fees/${secDepositFee.id}/discount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ discount_amount: 500, discount_reason: 'Principal Special Concession' }),
    }).then(r => r.json());

    console.log('Discount Applied Response:', discRes);
    const newOutstanding = await getTotalOutstanding(studentId);
    console.log(`New Outstanding Dues after ₹500 discount: ₹${newOutstanding} (Expected: ₹1570)`);
    if (newOutstanding !== 1570) {
      throw new Error(`Expected ₹1570 after discount but got ₹${newOutstanding}`);
    }
    console.log('✓ Fee discount relief applied and verified!');
  }

  // 5. Test Admission Collections endpoint
  const admPaymentsRes = await fetch('http://localhost:5000/api/payments/admissions', {
    headers: { Authorization: 'Bearer ' + token },
  }).then(r => r.json());

  console.log(`Admission Collections API returned ${admPaymentsRes.payments?.length} records`);
  console.log('Latest admission payment in list:', admPaymentsRes.payments?.[0]);

  // 6. Test WhatsApp dispatch with studentId
  const waRes = await fetch(`http://localhost:5000/api/admissions/send-whatsapp/${studentId}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
  }).then(r => r.json());
  console.log('WhatsApp Dispatch Result:', waRes);
  if (!waRes.success) throw new Error('WhatsApp dispatch failed');
  console.log('✓ WhatsApp confirmation sent successfully!');

  console.log('--- ALL PARTIAL ADMISSION & DUES TESTS PASSED! ---');
  process.exit(0);
}

testPartialAdmissionDues().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
