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

    // Ensure users table has security_question and security_answer_hash columns
    console.log('🔄 Verifying users table security columns...');
    const [uCols] = await conn.query("SHOW COLUMNS FROM users");
    const uColNames = uCols.map(c => c.Field);

    if (!uColNames.includes('security_question')) {
      await conn.query("ALTER TABLE users ADD COLUMN security_question VARCHAR(255) DEFAULT NULL AFTER full_name");
      console.log('  ✅ Added security_question to users');
    }
    if (!uColNames.includes('security_answer_hash')) {
      await conn.query("ALTER TABLE users ADD COLUMN security_answer_hash VARCHAR(255) DEFAULT NULL AFTER security_question");
      console.log('  ✅ Added security_answer_hash to users');
    }
    console.log('✅ Users security columns verified!');

    // Ensure admission & family fields migration on students
    console.log('🔄 Verifying student columns...');
    const [sCols] = await conn.query("SHOW COLUMNS FROM students");
    const sColNames = sCols.map(c => c.Field);

    if (!sColNames.includes('admission_receipt_no')) {
      await conn.query("ALTER TABLE students ADD COLUMN admission_receipt_no VARCHAR(50) DEFAULT NULL");
    }
    if (!sColNames.includes('family_id')) {
      await conn.query("ALTER TABLE students ADD COLUMN family_id VARCHAR(64) DEFAULT NULL");
    }
    if (!sColNames.includes('whatsapp_number')) {
      await conn.query("ALTER TABLE students ADD COLUMN whatsapp_number VARCHAR(20) DEFAULT NULL");
    }
    if (!sColNames.includes('opening_dues')) {
      await conn.query("ALTER TABLE students ADD COLUMN opening_dues DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER monthly_fee_rate");
      console.log('  ✅ Added opening_dues to students table');
    }
    if (!sColNames.includes('father_name')) {
      await conn.query("ALTER TABLE students ADD COLUMN father_name VARCHAR(160) DEFAULT NULL");
    }
    if (!sColNames.includes('mother_name')) {
      await conn.query("ALTER TABLE students ADD COLUMN mother_name VARCHAR(160) DEFAULT NULL");
    }
    if (!sColNames.includes('gender')) {
      await conn.query("ALTER TABLE students ADD COLUMN gender ENUM('male', 'female', 'other') DEFAULT 'male'");
    }
    if (!sColNames.includes('status') || !sColNames.some(c => c.Field === 'status' && c.Type.includes('deleted'))) {
      // Check if status enum has 'deleted' option
      const statusCol = sCols.find(c => c.Field === 'status');
      if (statusCol && !statusCol.Type.includes('deleted')) {
        await conn.query("ALTER TABLE students MODIFY COLUMN status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active'");
      }
    }
    console.log('✅ Student columns verified!');

    // Ensure payments table has payment_category & family_id
    console.log('🔄 Verifying payments columns...');
    const [pCols] = await conn.query("SHOW COLUMNS FROM payments");
    const pColNames = pCols.map(c => c.Field);

    if (!pColNames.includes('payment_category')) {
      await conn.query("ALTER TABLE payments ADD COLUMN payment_category VARCHAR(50) NOT NULL DEFAULT 'MONTHLY_FEE'");
    } else {
      await conn.query("ALTER TABLE payments MODIFY COLUMN payment_category VARCHAR(50) NOT NULL DEFAULT 'MONTHLY_FEE'");
    }
    await conn.query("ALTER TABLE payments MODIFY COLUMN payment_mode VARCHAR(40) NOT NULL DEFAULT 'CASH'");
    if (!pColNames.includes('family_id')) {
      await conn.query("ALTER TABLE payments ADD COLUMN family_id VARCHAR(50) DEFAULT NULL");
    }
    console.log('✅ Payments columns verified!');

    // Ensure student_additional_fees has paid_amount, discount_amount, discount_reason
    console.log('🔄 Verifying student_additional_fees columns...');
    const [safCols] = await conn.query("SHOW COLUMNS FROM student_additional_fees");
    const safColNames = safCols.map(c => c.Field);
    if (!safColNames.includes('paid_amount')) {
      await conn.query("ALTER TABLE student_additional_fees ADD COLUMN paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER amount");
    }
    if (!safColNames.includes('discount_amount')) {
      await conn.query("ALTER TABLE student_additional_fees ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER paid_amount");
    }
    if (!safColNames.includes('discount_reason')) {
      await conn.query("ALTER TABLE student_additional_fees ADD COLUMN discount_reason VARCHAR(255) DEFAULT NULL AFTER discount_amount");
    }
    try {
      await conn.query("ALTER TABLE student_additional_fees MODIFY COLUMN fee_type_id INT UNSIGNED DEFAULT NULL");
    } catch (e) {
      console.log('ℹ️ fee_type_id already modified or error:', e.message);
    }
    console.log('✅ student_additional_fees columns verified!');

    // Ensure payment_allocations has additional_fee_id & nullable monthly_fee_id
    console.log('🔄 Verifying payment_allocations columns...');
    const [paCols] = await conn.query("SHOW COLUMNS FROM payment_allocations");
    const paColNames = paCols.map(c => c.Field);
    if (!paColNames.includes('additional_fee_id')) {
      await conn.query("ALTER TABLE payment_allocations ADD COLUMN additional_fee_id INT UNSIGNED DEFAULT NULL AFTER monthly_fee_id");
    }
    try {
      await conn.query("ALTER TABLE payment_allocations MODIFY COLUMN monthly_fee_id INT UNSIGNED DEFAULT NULL");
    } catch (e) {
      console.log('ℹ️ monthly_fee_id already modified or error:', e.message);
    }
    console.log('✅ payment_allocations columns verified!');

    // Ensure seeders.sql runs if classes are empty
    const [classes] = await conn.query("SELECT COUNT(*) as cnt FROM classes");
    if (classes[0].cnt === 0) {
      const seederPath = path.join(__dirname, '../../../database/seeders.sql');
      if (fs.existsSync(seederPath)) {
        console.log('🌱 Seeding initial classes, sections, fee structures, and templates...');
        const seederSql = fs.readFileSync(seederPath, 'utf8');
        // Clean out USE statements for cloud databases
        const cleanSeederSql = seederSql.replace(/USE `[^`]+`;/gi, '');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
        await conn.query(cleanSeederSql);
        await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('✅ Default seed data inserted!');
      }
    }

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
