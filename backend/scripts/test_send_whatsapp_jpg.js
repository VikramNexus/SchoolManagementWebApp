const db = require('../src/config/db');

async function testSendWhatsAppJpg() {
  console.log('--- Testing Background WhatsApp JPEG Receipt Dispatch ---');

  // Fetch a valid payment
  const payment = await db.queryOne('SELECT id, student_id, amount FROM payments ORDER BY id DESC LIMIT 1');
  if (!payment) {
    console.error('No payments found in DB.');
    process.exit(1);
  }

  // 1x1 transparent JPEG base64 for testing
  const dummyJpgBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  }).then(r => r.json());

  const token = loginRes.token;

  const res = await fetch(`http://localhost:5000/api/receipts/send-whatsapp-jpg/${payment.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({
      imageBase64: dummyJpgBase64,
      phone: '9876543210',
    }),
  }).then(r => r.json());

  console.log('Response from send-whatsapp-jpg:', JSON.stringify(res, null, 2));
  process.exit(0);
}

testSendWhatsAppJpg().catch(console.error);
