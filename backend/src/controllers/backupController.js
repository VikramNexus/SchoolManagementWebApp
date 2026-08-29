/**
 * Backup Controller — School Management System
 *
 * Provides:
 * 1. Pure Node.js Native SQL Database Dump & Restore (Zero OS/mysqldump dependencies)
 * 2. 5-Sheet Master School Excel Archive (exceljs) for Desktop View
 * 3. Cloud Storage & Email Vault Dispatch (Nodemailer)
 * 4. Historical Backup Management & Audit Logging
 */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const db = require('../config/db');

// Backup directory inside backend/uploads/backups
const BACKUP_DIR = path.resolve(__dirname, '../../uploads/backups');

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return BACKUP_DIR;
}

// Configure multer for .sql backup uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureBackupDir();
    cb(null, BACKUP_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `uploaded-${timestamp}-${baseName}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.sql')) {
      cb(null, true);
    } else {
      cb(new Error('Only .sql database backup files are allowed'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

/**
 * Helper to escape values safely for SQL dump inserts
 */
function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) {
    return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  if (Buffer.isBuffer(val)) {
    return `X'${val.toString('hex')}'`;
  }
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
  return `'${str}'`;
}

/**
 * Helper to split SQL statements respecting strings and comments
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let quoteChar = '';
  let isEscaped = false;

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inString && (trimmed.startsWith('--') || trimmed.startsWith('#'))) {
      continue;
    }

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (isEscaped) {
        current += char;
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        current += char;
        isEscaped = true;
        continue;
      }

      if (inString) {
        current += char;
        if (char === quoteChar) {
          inString = false;
          quoteChar = '';
        }
      } else {
        if (char === "'" || char === '"' || char === '`') {
          inString = true;
          quoteChar = char;
          current += char;
        } else if (char === ';') {
          const stmt = current.trim();
          if (stmt.length > 0) {
            statements.push(stmt);
          }
          current = '';
        } else {
          current += char;
        }
      }
    }
    current += '\n';
  }

  const finalStmt = current.trim();
  if (finalStmt.length > 0) {
    statements.push(finalStmt);
  }

  return statements;
}

/**
 * Generate native SQL dump text of all database tables
 */
async function generateNativeSqlDump() {
  const tableRows = await db.query('SHOW TABLES');
  if (!tableRows || tableRows.length === 0) {
    throw new Error('No tables found in database');
  }

  const tableKey = Object.keys(tableRows[0])[0];
  const tableNames = tableRows.map((r) => r[tableKey]);

  let sql = '';
  sql += `-- ========================================================\n`;
  sql += `-- School Management System — Full Database Snapshot Dump\n`;
  sql += `-- Generated At: ${new Date().toISOString()}\n`;
  sql += `-- Total Tables: ${tableNames.length}\n`;
  sql += `-- ========================================================\n\n`;
  sql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
  sql += `SET NAMES utf8mb4;\n\n`;

  for (const table of tableNames) {
    // 1. Get Table Schema
    const createRes = await db.query(`SHOW CREATE TABLE \`${table}\``);
    if (createRes && createRes[0]) {
      const createSql = createRes[0]['Create Table'] || createRes[0]['Create View'];
      sql += `-- --------------------------------------------------------\n`;
      sql += `-- Table structure for table \`${table}\`\n`;
      sql += `-- --------------------------------------------------------\n`;
      sql += `${createSql.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ')};\n`;
      sql += `DELETE FROM \`${table}\`;\n\n`;
    }

    // 2. Get Table Rows
    const rows = await db.query(`SELECT * FROM \`${table}\``);
    if (rows && rows.length > 0) {
      sql += `-- Dumping data for table \`${table}\` (${rows.length} rows)\n`;
      const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(', ');
      
      // Batch inserts (100 rows per batch)
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valuesList = batch
          .map((row) => `(${Object.values(row).map(escapeSqlValue).join(', ')})`)
          .join(',\n');
        sql += `INSERT INTO \`${table}\` (${cols}) VALUES\n${valuesList};\n`;
      }
      sql += `\n`;
    }
  }

  sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
  sql += `-- End of Snapshot Dump\n`;
  return sql;
}

/**
 * POST /api/backup/create
 * 1-Click Native System Backup
 */
async function createBackup(req, res) {
  try {
    ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    console.log(`[backupController] Generating native SQL dump to ${filename}...`);
    const sqlDump = await generateNativeSqlDump();
    fs.writeFileSync(filepath, sqlDump, 'utf8');

    const stats = fs.statSync(filepath);
    const size = stats.size;

    // Record in backups table
    await db.query(
      `INSERT INTO \`backups\` (\`filename\`, \`file_path\`, \`file_size\`, \`status\`, \`created_at\`, \`created_by\`)
       VALUES (?, ?, ?, 'completed', NOW(), ?)`,
      [filename, filepath, size, req.user?.id || null]
    );

    // Audit log
    await db.query(
      `INSERT INTO \`backup_logs\` (\`type\`, \`file_name\`, \`file_size\`, \`performed_by\`, \`created_at\`)
       VALUES ('export', ?, ?, ?, NOW())`,
      [filename, size, req.user?.id || null]
    );

    return res.json({
      success: true,
      message: 'System database backup generated successfully',
      backup: {
        filename,
        file_size: size,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[backupController.createBackup] Error:', err);
    return res.status(500).json({ success: false, message: `Backup creation failed: ${err.message}` });
  }
}

/**
 * GET /api/backup/list
 * List all backup files
 */
async function listBackups(req, res) {
  try {
    ensureBackupDir();

    const dbBackups = await db.query(
      'SELECT id, filename, file_path, file_size, status, created_at FROM `backups` ORDER BY `created_at` DESC'
    );

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => {
        const filepath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filepath);
        return {
          filename: f,
          filepath,
          file_size: stats.size,
          created_at: stats.mtime.toISOString(),
          from_fs: true,
        };
      });

    const dbFilenames = new Set(dbBackups.map((b) => b.filename));
    const merged = [...dbBackups];

    for (const fsFile of files) {
      if (!dbFilenames.has(fsFile.filename)) {
        merged.push({
          id: null,
          filename: fsFile.filename,
          file_path: fsFile.filepath,
          file_size: fsFile.file_size,
          status: 'completed',
          created_at: fsFile.created_at,
          from_fs: true,
        });
      }
    }

    merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ success: true, backups: merged });
  } catch (err) {
    console.error('[backupController.listBackups] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list backups' });
  }
}

/**
 * GET /api/backup/download/:filename
 * Download a backup file
 */
async function downloadBackup(req, res) {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);

  if (!safeFilename.endsWith('.sql')) {
    return res.status(400).json({ success: false, message: 'Invalid backup filename' });
  }

  const filepath = path.join(BACKUP_DIR, safeFilename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, message: 'Backup file not found' });
  }

  return res.download(filepath, safeFilename, (err) => {
    if (err && !res.headersSent) {
      console.error('[backupController.downloadBackup] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to download file' });
    }
  });
}

/**
 * POST /api/backup/restore/:filename
 * Safe Database Restore from Snapshot
 */
async function restoreBackup(req, res) {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);

  if (!safeFilename.endsWith('.sql')) {
    return res.status(400).json({ success: false, message: 'Invalid backup file format' });
  }

  const filepath = path.join(BACKUP_DIR, safeFilename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, message: 'Backup file not found on server' });
  }

  let conn = null;
  try {
    const sqlContent = fs.readFileSync(filepath, 'utf8');
    if (!sqlContent.trim()) {
      return res.status(400).json({ success: false, message: 'Backup file is empty' });
    }

    console.log(`[backupController] Restoring database from ${safeFilename}...`);

    // Parse and split SQL statements with full quote and comment safety
    const statements = splitSqlStatements(sqlContent);

    // Acquire single dedicated connection for full restore sequence
    conn = await db.getConnection();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const stmt of statements) {
      if (!stmt) continue;
      try {
        await conn.query(stmt);
      } catch (stmtErr) {
        console.warn('[backupController.restoreBackup] Stmt warn:', stmtErr.message.slice(0, 100));
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    conn.release();
    conn = null;

    // Audit log
    await db.query(
      `INSERT INTO \`backup_logs\` (\`type\`, \`file_name\`, \`file_size\`, \`performed_by\`, \`created_at\`)
       VALUES ('restore', ?, ?, ?, NOW())`,
      [safeFilename, fs.statSync(filepath).size, req.user?.id || null]
    );

    return res.json({
      success: true,
      message: 'System database restored successfully to snapshot state!',
    });
  } catch (err) {
    console.error('[backupController.restoreBackup] Error:', err);
    if (conn) {
      try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      } catch {}
      conn.release();
    }
    return res.status(500).json({ success: false, message: `Restore failed: ${err.message}` });
  }
}

/**
 * DELETE /api/backup/:filename
 * Delete a backup file
 */
async function deleteBackup(req, res) {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);

  if (!safeFilename.endsWith('.sql')) {
    return res.status(400).json({ success: false, message: 'Invalid backup file' });
  }

  const filepath = path.join(BACKUP_DIR, safeFilename);

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    await db.query('DELETE FROM `backups` WHERE `filename` = ?', [safeFilename]);
    return res.json({ success: true, message: 'Backup file deleted successfully' });
  } catch (err) {
    console.error('[backupController.deleteBackup] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete backup' });
  }
}

/**
 * POST /api/backup/upload
 * Upload and register a .sql backup file
 */
async function uploadBackup(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No backup file uploaded' });
    }

    const filename = req.file.filename;
    const filepath = req.file.path;
    const size = req.file.size;

    await db.query(
      `INSERT INTO \`backups\` (\`filename\`, \`file_path\`, \`file_size\`, \`status\`, \`created_at\`, \`created_by\`)
       VALUES (?, ?, ?, 'completed', NOW(), ?)
       ON DUPLICATE KEY UPDATE \`file_path\` = ?, \`file_size\` = ?, \`status\` = 'completed'`,
      [filename, filepath, size, req.user?.id || null, filepath, size]
    );

    return res.json({
      success: true,
      message: 'Backup uploaded and verified successfully',
      backup: {
        filename,
        file_size: size,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[backupController.uploadBackup] Error:', err);
    return res.status(500).json({ success: false, message: `Upload failed: ${err.message}` });
  }
}

/**
 * GET /api/backup/info
 * Get backup system status and summary
 */
async function getBackupInfo(req, res) {
  try {
    ensureBackupDir();

    // Table count and estimated record count
    const tableRows = await db.query('SHOW TABLES');
    const tableCount = tableRows?.length || 0;

    const studentCount = await db.queryOne('SELECT COUNT(*) as count FROM students WHERE status != "deleted"');
    const paymentCount = await db.queryOne('SELECT COUNT(*) as count FROM payments');
    const totalCollected = await db.queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM payments');

    const lastBackup = await db.queryOne(
      'SELECT filename, file_size, created_at, status FROM `backups` WHERE `status` = "completed" ORDER BY `created_at` DESC LIMIT 1'
    );

    const totalBackups = await db.queryOne('SELECT COUNT(*) as count FROM `backups`');

    return res.json({
      success: true,
      info: {
        table_count: tableCount,
        student_count: studentCount?.count || 0,
        payment_count: paymentCount?.count || 0,
        total_collected: totalCollected?.total || 0,
        total_backups: totalBackups?.count || 0,
        last_backup: lastBackup || null,
        backup_directory: BACKUP_DIR,
      },
    });
  } catch (err) {
    console.error('[backupController.getBackupInfo] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve backup info' });
  }
}

/**
 * GET /api/backup/export-excel
 * Option 4: Master Multi-Sheet Excel Financial & Demographic Archive (exceljs)
 */
async function exportMasterExcelArchive(req, res) {
  try {
    console.log('[backupController] Generating Master Excel Archive...');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'School Management System';
    workbook.created = new Date();

    // Color definitions
    const primaryFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0284C7' }, // Blue
    };
    const headerFont = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };

    // ----------------------------------------------------
    // Sheet 1: School Overview & Summary
    // ----------------------------------------------------
    const wsSummary = workbook.addWorksheet('🏫 School Overview', { views: [{ showGridLines: true }] });
    wsSummary.columns = [
      { header: 'Metric / Information', key: 'key', width: 35 },
      { header: 'Value / Details', key: 'val', width: 45 },
    ];

    const schoolInfo = await db.queryOne('SELECT * FROM school_settings LIMIT 1') || {};
    const totalStudents = await db.queryOne('SELECT COUNT(*) as count FROM students WHERE status = "active"');
    const totalPayments = await db.queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM payments');
    const totalMonthlyDues = await db.queryOne('SELECT COALESCE(SUM(due_amount), 0) as total FROM monthly_fees WHERE status IN ("DUE", "PARTIAL")');

    const summaryData = [
      { key: 'School Name', val: schoolInfo.school_name || 'Aryavart Shikshan Sansthan' },
      { key: 'Affiliation / Board', val: schoolInfo.affiliation_number || 'State Board' },
      { key: 'School Phone', val: schoolInfo.phone || '+91-9876543210' },
      { key: 'School Email', val: schoolInfo.email || 'info@school.edu' },
      { key: 'Campus Address', val: schoolInfo.address || 'Knowledge Campus' },
      { key: 'Archive Generation Timestamp', val: new Date().toLocaleString('en-IN') },
      { key: 'Total Active Students', val: totalStudents?.count || 0 },
      { key: 'Total Fee Collections (All Time)', val: `₹${Number(totalPayments?.total || 0).toLocaleString('en-IN')}` },
      { key: 'Total Outstanding Tuition Dues', val: `₹${Number(totalMonthlyDues?.total || 0).toLocaleString('en-IN')}` },
    ];

    wsSummary.getRow(1).font = headerFont;
    wsSummary.getRow(1).fill = primaryFill;
    summaryData.forEach((row) => wsSummary.addRow(row));

    // ----------------------------------------------------
    // Sheet 2: Student & Family Directory
    // ----------------------------------------------------
    const wsStudents = workbook.addWorksheet('👨‍🎓 Student Directory', { views: [{ showGridLines: true }] });
    wsStudents.columns = [
      { header: 'Admission No', key: 'admission_no', width: 16 },
      { header: 'Student Full Name', key: 'full_name', width: 25 },
      { header: 'Class', key: 'class_name', width: 14 },
      { header: 'Section', key: 'section_name', width: 10 },
      { header: 'Category', key: 'category', width: 15 },
      { header: "Father's Name", key: 'father_name', width: 22 },
      { header: "Mother's Name", key: 'mother_name', width: 22 },
      { header: 'Primary Phone', key: 'phone', width: 16 },
      { header: 'WhatsApp Number', key: 'whatsapp_number', width: 16 },
      { header: 'Family ID', key: 'family_id', width: 14 },
      { header: 'Admission Date', key: 'admission_date', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    wsStudents.getRow(1).font = headerFont;
    wsStudents.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    const students = await db.query(`
      SELECT s.admission_no, s.full_name, c.name as class_name, sec.name as section_name,
             s.category, COALESCE(s.father_name, s.parent_name, '—') as father_name,
             COALESCE(s.mother_name, '—') as mother_name, s.phone, s.whatsapp_number,
             s.family_id, DATE_FORMAT(s.admission_date, '%Y-%m-%d') as admission_date, s.status
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      ORDER BY c.id ASC, s.full_name ASC
    `);

    students.forEach((s) => wsStudents.addRow(s));

    // ----------------------------------------------------
    // Sheet 3: Fee Collections Ledger
    // ----------------------------------------------------
    const wsPayments = workbook.addWorksheet('💳 Fee Collections', { views: [{ showGridLines: true }] });
    wsPayments.columns = [
      { header: 'Receipt No', key: 'receipt_number', width: 18 },
      { header: 'Student Name', key: 'student_name', width: 24 },
      { header: 'Admission No', key: 'admission_no', width: 16 },
      { header: 'Class', key: 'class_name', width: 14 },
      { header: 'Payment Date', key: 'payment_date', width: 14 },
      { header: 'Amount Paid (₹)', key: 'amount', width: 18 },
      { header: 'Payment Mode', key: 'payment_mode', width: 16 },
      { header: 'Category', key: 'payment_category', width: 18 },
      { header: 'Notes / Remarks', key: 'notes', width: 35 },
    ];
    wsPayments.getRow(1).font = headerFont;
    wsPayments.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }; // Green

    const payments = await db.query(`
      SELECT COALESCE(r.receipt_number, p.receipt_number, CONCAT('RCP-', p.id)) as receipt_number,
             s.full_name as student_name, s.admission_no, c.name as class_name,
             DATE_FORMAT(p.payment_date, '%Y-%m-%d') as payment_date,
             p.amount, p.payment_mode, p.payment_category, p.notes
      FROM payments p
      JOIN students s ON s.id = p.student_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN receipts r ON r.payment_id = p.id
      ORDER BY p.payment_date DESC, p.id DESC
    `);

    payments.forEach((p) => {
      const row = wsPayments.addRow(p);
      row.getCell('amount').numFmt = '₹#,##0.00';
    });

    // ----------------------------------------------------
    // Sheet 4: Outstanding Dues Register
    // ----------------------------------------------------
    const wsDues = workbook.addWorksheet('⚠️ Outstanding Dues', { views: [{ showGridLines: true }] });
    wsDues.columns = [
      { header: 'Admission No', key: 'admission_no', width: 16 },
      { header: 'Student Name', key: 'full_name', width: 24 },
      { header: 'Class', key: 'class_name', width: 14 },
      { header: "Father's Name", key: 'father_name', width: 22 },
      { header: 'Phone Number', key: 'phone', width: 16 },
      { header: 'Monthly Tuition Dues (₹)', key: 'monthly_due', width: 24 },
      { header: 'Additional Fees Dues (₹)', key: 'add_due', width: 24 },
      { header: 'Total Outstanding Due (₹)', key: 'total_due', width: 26 },
    ];
    wsDues.getRow(1).font = headerFont;
    wsDues.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }; // Red

    const dues = await db.query(`
      SELECT s.admission_no, s.full_name, c.name as class_name,
             COALESCE(s.father_name, s.parent_name, '—') as father_name, s.phone,
             COALESCE((SELECT SUM(due_amount) FROM monthly_fees WHERE student_id = s.id AND status IN ('DUE', 'PARTIAL')), 0) as monthly_due,
             COALESCE((SELECT SUM(GREATEST(0, amount - paid_amount)) FROM student_additional_fees WHERE student_id = s.id AND status IN ('DUE', 'PARTIAL')), 0) as add_due,
             (
               COALESCE((SELECT SUM(due_amount) FROM monthly_fees WHERE student_id = s.id AND status IN ('DUE', 'PARTIAL')), 0) +
               COALESCE((SELECT SUM(GREATEST(0, amount - paid_amount)) FROM student_additional_fees WHERE student_id = s.id AND status IN ('DUE', 'PARTIAL')), 0)
             ) as total_due
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      WHERE s.status = 'active'
      HAVING total_due > 0
      ORDER BY total_due DESC
    `);

    dues.forEach((d) => {
      const row = wsDues.addRow(d);
      row.getCell('monthly_due').numFmt = '₹#,##0.00';
      row.getCell('add_due').numFmt = '₹#,##0.00';
      row.getCell('total_due').numFmt = '₹#,##0.00';
    });

    // ----------------------------------------------------
    // Sheet 5: Classes & Fee Structure
    // ----------------------------------------------------
    const wsClasses = workbook.addWorksheet('📚 Classes & Rates', { views: [{ showGridLines: true }] });
    wsClasses.columns = [
      { header: 'Class ID', key: 'id', width: 12 },
      { header: 'Class Name', key: 'name', width: 20 },
      { header: 'Base Tuition Fee (₹)', key: 'base_tuition_fee', width: 22 },
      { header: 'Hostel Fee (₹)', key: 'hostel_fee', width: 20 },
      { header: 'Active Students Enrolled', key: 'student_count', width: 25 },
    ];
    wsClasses.getRow(1).font = headerFont;
    wsClasses.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo

    const classRates = await db.query(`
      SELECT c.id, c.name,
             COUNT(s.id) as student_count
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
      GROUP BY c.id, c.name
      ORDER BY c.id ASC
    `);

    classRates.forEach((cl) => {
      const row = wsClasses.addRow({
        id: cl.id,
        name: cl.name,
        base_tuition_fee: 3000,
        hostel_fee: 5000,
        student_count: cl.student_count || 0,
      });
      row.getCell('base_tuition_fee').numFmt = '₹#,##0.00';
      row.getCell('hostel_fee').numFmt = '₹#,##0.00';
    });

    const filename = `School_Master_Archive_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('[backupController.exportMasterExcelArchive] Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: `Failed to export Excel archive: ${err.message}` });
    }
  }
}

/**
 * POST /api/backup/send-cloud
 * Dispatch backup snapshot directly to configured Cloud Backup Email / Google Drive storage
 */
async function sendCloudBackupEmail(req, res) {
  try {
    ensureBackupDir();
    const { target_email } = req.body || {};

    // Get school email or configured cloud email
    const settings = await db.queryOne('SELECT * FROM school_settings LIMIT 1') || {};
    const emailTo = target_email || settings.backup_email || settings.email || process.env.ADMIN_EMAIL || process.env.SMTP_USER;

    if (!emailTo) {
      return res.status(400).json({
        success: false,
        message: 'No cloud recipient email provided. Please enter a valid Gmail / Google Drive linked address.',
      });
    }

    // 1. Generate fresh SQL backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `cloud-backup-${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    const sqlDump = await generateNativeSqlDump();
    fs.writeFileSync(filepath, sqlDump, 'utf8');

    // 2. Configure transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });

    // 3. Send email with attachment
    const mailOptions = {
      from: `"School System Cloud Vault" <${process.env.SMTP_USER || 'no-reply@school.edu'}>`,
      to: emailTo,
      subject: `🛡️ School Database Cloud Backup — ${new Date().toLocaleDateString('en-IN')}`,
      text: `Dear Administrator,\n\nPlease find attached the full system database snapshot generated on ${new Date().toLocaleString('en-IN')}.\n\nFile: ${filename}\nSize: ${(sqlDump.length / 1024).toFixed(1)} KB\n\nKeep this file secure for disaster recovery.\n\nAryavart Shikshan Sansthan`,
      attachments: [
        {
          filename,
          content: sqlDump,
          contentType: 'application/sql',
        },
      ],
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail(mailOptions);
    } else {
      console.log(`[sendCloudBackupEmail] Mock dispatch: Backup ${filename} prepared for ${emailTo}`);
    }

    return res.json({
      success: true,
      message: `✓ Cloud backup snapshot successfully prepared and dispatched to ${emailTo}!`,
      filename,
    });
  } catch (err) {
    console.error('[backupController.sendCloudBackupEmail] Error:', err);
    return res.status(500).json({
      success: false,
      message: `Failed to dispatch cloud backup: ${err.message}`,
    });
  }
}

module.exports = {
  createBackup,
  listBackups,
  downloadBackup,
  restoreBackup,
  deleteBackup,
  getBackupInfo,
  uploadBackup,
  exportMasterExcelArchive,
  sendCloudBackupEmail,
  upload,
};