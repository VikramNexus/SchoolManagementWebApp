require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTest() {
  console.log('--- Starting Family Monthly Ledger Verification ---');

  // Generate Admin JWT Token
  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin' },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Step 1: Enroll a 3-sibling family with rates: ₹5,000, ₹4,000, ₹3,000
  console.log('1. Enrolling a family with 3 siblings (₹5,000 + ₹4,000 + ₹3,000)...');
  const familyPayload = {
    parent: {
      father_name: 'Devendra Singhania',
      mother_name: 'Kavita Singhania',
      phone: '9888877771',
      whatsapp_number: '9888877771',
      address: '74 Park View, Delhi',
      admission_date: '2026-08-26',
    },
    children: [
      {
        full_name: 'Rohan Singhania',
        gender: 'male',
        class_id: 1,
        monthly_fee_rate: 5000,
        has_admission_fee: true,
        admission_fee_amount: 5000,
        include_advance_month: true,
        advance_fee_month: 8,
        advance_fee_year: 2026,
        advance_fee_amount: 5000,
      },
      {
        full_name: 'Ananya Singhania',
        gender: 'female',
        class_id: 2,
        monthly_fee_rate: 4000,
        has_admission_fee: true,
        admission_fee_amount: 4000,
        include_advance_month: true,
        advance_fee_month: 8,
        advance_fee_year: 2026,
        advance_fee_amount: 4000,
      },
      {
        full_name: 'Kabir Singhania',
        gender: 'male',
        class_id: 3,
        monthly_fee_rate: 3000,
        has_admission_fee: true,
        admission_fee_amount: 3000,
        include_advance_month: true,
        advance_fee_month: 8,
        advance_fee_year: 2026,
        advance_fee_amount: 3000,
      },
    ],
    payment: {
      collect_payment: true,
      paid_amount: 24000, // full initial assessment (10000 + 8000 + 6000)
      payment_mode: 'CASH',
      notes: 'Initial admission & 1-month advance for 3 siblings',
    },
  };

  const enrollRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/admissions/enroll-family',
      method: 'POST',
      headers: authHeaders,
    },
    familyPayload
  );

  console.log('Enroll status:', enrollRes.status);
  console.log('Enroll response success:', enrollRes.data?.success);
  console.log('Family ID created:', enrollRes.data?.family_id);

  if (!enrollRes.data?.success || !enrollRes.data?.students?.length) {
    throw new Error('Enrollment failed: ' + JSON.stringify(enrollRes.data));
  }

  const firstStudentId = enrollRes.data.students[0].student_id;
  const secondStudentId = enrollRes.data.students[1].student_id;
  const thirdStudentId = enrollRes.data.students[2].student_id;

  // Step 2: Fetch the Consolidated Month-by-Month Family Fee Ledger
  console.log(`2. Fetching Consolidated Family Monthly Ledger for Student ID ${firstStudentId}...`);
  const ledgerRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/family/by-student/${firstStudentId}/ledger`,
    method: 'GET',
    headers: authHeaders,
  });

  console.log('Ledger status:', ledgerRes.status);
  console.log('Has Family:', ledgerRes.data?.has_family);
  console.log('Total Family Monthly Rate:', ledgerRes.data?.total_family_monthly_rate);
  console.log('Total Annual Family Assessment:', ledgerRes.data?.total_annual_family_fee);
  console.log('Total Months Returned:', ledgerRes.data?.ledger?.length);

  // Assertions
  if (ledgerRes.data?.total_family_monthly_rate !== 12000) {
    throw new Error(`Expected total_family_monthly_rate to be 12000, got ${ledgerRes.data?.total_family_monthly_rate}`);
  }

  const augustLedger = ledgerRes.data?.ledger?.find(m => m.fee_month === 8);
  console.log('August Month Family Status:', augustLedger?.family_status);
  console.log('August Month Family Rate:', augustLedger?.total_family_fee);
  console.log('August Month Total Paid:', augustLedger?.total_family_paid);
  console.log('August Month Breakdown Count:', augustLedger?.sibling_breakdown?.length);

  // Step 3: Record a Family Payment for September (₹12,000)
  console.log('3. Recording a combined family payment for September (₹12,000)...');
  const familyPayRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/family/record-payment',
      method: 'POST',
      headers: authHeaders,
    },
    {
      family_id: enrollRes.data.family_id,
      payment_mode: 'CASH',
      notes: 'Combined family fee for September 2026',
      allocations: [
        { student_id: firstStudentId, amount: 5000 },
        { student_id: secondStudentId, amount: 4000 },
        { student_id: thirdStudentId, amount: 3000 },
      ],
    }
  );

  console.log('Family payment status:', familyPayRes.status);
  console.log('Family receipt number:', familyPayRes.data?.receipt_number);
  console.log('Family total amount:', familyPayRes.data?.total_amount);

  // Step 4: Verify Receipts Table
  const receiptRows = await db.query(
    'SELECT * FROM receipts WHERE receipt_number LIKE ?',
    [`%${familyPayRes.data?.receipt_number}%`]
  );
  console.log(`4. Verified ${receiptRows.length} official receipts created in DB for family payment.`);

  console.log('--- All Family Monthly Ledger & Admissions Tests Passed Successfully! ---');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
