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

    const [rows] = await pool.execute('SELECT * FROM fee_structures');
    console.log('Fee structures:', rows);

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

test();