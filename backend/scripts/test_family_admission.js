const db = require('../src/config/db');

async function testFamilyAdmission() {
  console.log('--- Testing Multi-Sibling Simultaneous Bulk Admission ---');

  // Fetch classes
  const classes = await db.query('SELECT id, name FROM classes LIMIT 3');
  if (classes.length === 0) {
    console.error('No classes found in database.');
    process.exit(1);
  }

  const classId1 = classes[0].id;
  const classId2 = classes[1] ? classes[1].id : classes[0].id;
  const classId3 = classes[2] ? classes[2].id : classes[0].id;

  const testPayload = {
    father_name: 'Sharma Ji Test Father',
    mother_name: 'Sharma Ji Test Mother',
    phone: '9876543210',
    whatsapp_number: '9876543210',
    address: 'Near Knowledge Park, Colony Test',
    admission_date: new Date().toISOString().slice(0, 10),

    students: [
      {
        full_name: 'Aarav Sharma',
        gender: 'male',
        class_id: classId1,
        category: 'day_scholar',
        monthly_fee_rate: 3000,
        admission_fee_amount: 1500,
        security_deposit_amount: 1000,
        include_advance_month: true,
      },
      {
        full_name: 'Ananya Sharma',
        gender: 'female',
        class_id: classId2,
        category: 'day_scholar',
        monthly_fee_rate: 3500,
        admission_fee_amount: 1500,
        security_deposit_amount: 1000,
        include_advance_month: true,
      },
      {
        full_name: 'Aditya Sharma',
        gender: 'male',
        class_id: classId3,
        category: 'hosteller',
        monthly_fee_rate: 5500,
        admission_fee_amount: 2000,
        security_deposit_amount: 2000,
        include_advance_month: true,
      }
    ],

    collect_payment: true,
    paid_amount: 10000, // Partial payment for the family
    payment_mode: 'CASH',
    payment_notes: 'Initial combined family payment for 3 siblings',
  };

  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  }).then(r => r.json());

  const token = loginRes.token;

  const enrollRes = await fetch('http://localhost:5000/api/admissions/enroll-family', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(testPayload),
  }).then(r => r.json());

  console.log('Enroll Family Response:', JSON.stringify(enrollRes, null, 2));

  if (enrollRes.success) {
    console.log('\n✅ Verification checks:');
    console.log('  1. Family ID generated:', enrollRes.family_id);
    console.log('  2. Total Siblings Enrolled:', enrollRes.students.length);
    console.log('  3. Total Assessed Fees:', enrollRes.total_assessed);
    console.log('  4. Total Paid Amount:', enrollRes.total_paid);
    console.log('  5. Payment Records count:', enrollRes.payments.length);

    // Verify all students have identical family_id in DB
    const studentIds = enrollRes.students.map(s => s.student_id);
    const dbStudents = await db.query('SELECT id, admission_no, full_name, family_id FROM students WHERE id IN (?)', [studentIds]);
    console.log('\n  DB Verification of Enrolled Siblings:', dbStudents);
    const allSameFamily = dbStudents.every(s => s.family_id === enrollRes.family_id);
    console.log('  All students have exact same family_id:', allSameFamily ? '✅ YES' : '❌ NO');
  }

  process.exit(0);
}

testFamilyAdmission().catch(console.error);
