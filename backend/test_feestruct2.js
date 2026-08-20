const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'school_management_db',
      connectionLimit: 5,
      charset: 'utf8mb4',
    });

    // Insert fee structures
    await pool.execute(
      `INSERT INTO \`fee_structures\` (\`category\`, \`amount\`, \`effective_from\`, \`is_active\`)
       VALUES (?, ?, ?, ?)`,
      ['day_scholar', 3000, '2025-04-01', 1]
    );
    await pool.execute(
      `INSERT INTO \`fee_structures\` (\`category\`, \`amount\`, \`effective_from\`, \`is_active\`)
       VALUES (?, ?, ?, ?)`,
      ['hosteller', 5000, '2025-04-01', 1]
    );

    const [rows] = await pool.execute('SELECT * FROM fee_structures');
    console.log('Fee structures after insert:', rows);

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

test();