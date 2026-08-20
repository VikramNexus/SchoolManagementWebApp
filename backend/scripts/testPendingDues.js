const db = require('../src/config/db');
const { getPendingDuesList } = require('../src/controllers/reportController');

async function testPendingDues() {
  try {
    await db.ensureDatabase();
    console.log('Testing getPendingDuesList controller...');

    const req = { query: {} };
    const res = {
      json: (data) => console.log('Pending Dues API Result:', JSON.stringify(data, null, 2)),
      status: (code) => {
        console.log('Status:', code);
        return res;
      }
    };

    await getPendingDuesList(req, res);
    console.log('✅ Pending Dues List Controller Test Success!');
  } catch (err) {
    console.error('❌ Test Failed:', err);
  } finally {
    await db.closePool();
  }
}

testPendingDues();
