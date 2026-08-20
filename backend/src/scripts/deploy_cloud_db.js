/**
 * Cloud Database Auto-Deployer & Initializer — Aryavart Portal
 * Executes schema.sql and all migrations against the target database.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function deployDatabase() {
  console.log('====================================================');
  console.log('🚀 Initializing / Migrating Aryavart Cloud Database');
  console.log('====================================================');

  const connectionUri = process.env.DATABASE_URL;
  const isCloud = !!connectionUri || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1');

  const connConfig = connectionUri
    ? {
        uri: connectionUri,
        multipleStatements: true,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'school_management_db',
        multipleStatements: true,
        ssl: isCloud ? { rejectUnauthorized: false } : undefined,
      };

  console.log(`Connecting to: ${connectionUri ? 'Cloud DATABASE_URL' : (process.env.DB_HOST || 'localhost')}`);
  const conn = await mysql.createConnection(connConfig);

  try {
    console.log('✅ Connected to MySQL successfully!');

    // Read schema.sql
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📄 Loading database/schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      // Execute schema statements
      await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
      await conn.query(schemaSql);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
      console.log('✅ Schema tables created successfully!');
    }

    // Ensure default admin exists
    const [existingUsers] = await conn.query("SELECT id FROM users WHERE username = 'admin'");
    if (existingUsers.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await conn.query(
        "INSERT INTO users (username, email, password_hash, role, full_name) VALUES ('admin', 'admin@aryavart.edu', ?, 'admin', 'System Administrator')",
        [passwordHash]
      );
      console.log('✅ Default Admin User created: username "admin", password "admin123"');
    }

    // Ensure admission & family fields migration
    console.log('🔄 Verifying student columns for admission & family receipts...');
    const [cols] = await conn.query("SHOW COLUMNS FROM students");
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('admission_receipt_no')) {
      await conn.query("ALTER TABLE students ADD COLUMN admission_receipt_no VARCHAR(50) DEFAULT NULL");
    }
    if (!colNames.includes('family_id')) {
      await conn.query("ALTER TABLE students ADD COLUMN family_id VARCHAR(50) DEFAULT NULL");
    }
    if (!colNames.includes('whatsapp_number')) {
      await conn.query("ALTER TABLE students ADD COLUMN whatsapp_number VARCHAR(20) DEFAULT NULL");
    }
    console.log('✅ Student columns verified!');

    // Verify tables
    const [tables] = await conn.query('SHOW TABLES');
    console.log(`\n🎉 Database is 100% Ready! Total tables verified: ${tables.length}`);
  } catch (err) {
    console.error('❌ Database migration error:', err);
    throw err;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  deployDatabase()
    .then(() => {
      console.log('Database deployment complete!');
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { deployDatabase };
