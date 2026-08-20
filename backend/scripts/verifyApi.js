const http = require('http');

function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });

    req.on('error', reject);
    req.end();
  });
}

async function verify() {
  try {
    console.log('Testing GET /api/health ...');
    const health = await makeRequest('/health');
    console.log('Health Response:', health);

    // Login as admin / admin123
    console.log('Logging in as admin...');
    const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
    const loginRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData),
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });

    const token = loginRes.token;
    console.log('Login successful! Token:', token ? token.substring(0, 20) + '...' : 'NULL');

    console.log('Testing GET /api/students ...');
    const studentsRes = await makeRequest('/students', token);
    console.log('Students HTTP Status:', studentsRes.status, 'Total Students:', studentsRes.data.students?.length);

    console.log('Testing GET /api/payments ...');
    const paymentsRes = await makeRequest('/payments', token);
    console.log('Payments HTTP Status:', paymentsRes.status, 'Total Payments:', paymentsRes.data.payments?.length);

    if (studentsRes.status === 200 && paymentsRes.status === 200) {
      console.log('===========================================================');
      console.log('🎉 ALL APIs RESPONDING WITH HTTP 200 SUCCESS!');
      console.log('===========================================================');
    } else {
      console.error('❌ API failed:', { studentsRes, paymentsRes });
    }
  } catch (err) {
    console.error('Verification Error:', err);
  }
}

verify();
