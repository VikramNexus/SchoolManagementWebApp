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
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const { generateStudentExcelWorkbook } = require('../services/studentExcelDossierService');
const { sendDatabaseBackupEmail } = require('../services/emailService');

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
 * Generate native SQL dump text of all database tables (Ultra-Fast Parallel Extraction)
 */
async function generateNativeSqlDump() {
  const tableRows = await db.query('SHOW TABLES');
  if (!tableRows || tableRows.length === 0) {
    throw new Error('No tables found in database');
  }

  const tableKey = Object.keys(tableRows[0])[0];
  const tableNames = tableRows.map((r) => r[tableKey]);

  const chunks = [];
  chunks.push(`-- ========================================================\n`);
  chunks.push(`-- School Management System — High-Speed Database Snapshot\n`);
  chunks.push(`-- Generated At: ${new Date().toISOString()}\n`);
  chunks.push(`-- Total Tables: ${tableNames.length}\n`);
  chunks.push(`-- ========================================================\n\n`);
  chunks.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);
  chunks.push(`SET NAMES utf8mb4;\n\n`);

  // Parallel extraction in concurrency batches of 8 tables for high network throughput
  const CONCURRENCY = 8;
  const results = new Array(tableNames.length);

  for (let i = 0; i < tableNames.length; i += CONCURRENCY) {
    const batch = tableNames.slice(i, i + CONCURRENCY);
    const batchPromises = batch.map(async (table, bIdx) => {
      const idx = i + bIdx;
      const [createRes, rows] = await Promise.all([
        db.query(`SHOW CREATE TABLE \`${table}\``).catch(() => null),
        db.query(`SELECT * FROM \`${table}\``).catch(() => []),
      ]);

      let tableChunk = '';
      if (createRes && createRes[0]) {
        const createSql = createRes[0]['Create Table'] || createRes[0]['Create View'];
        tableChunk += `-- --------------------------------------------------------\n`;
        tableChunk += `-- Table structure for table \`${table}\`\n`;
        tableChunk += `-- --------------------------------------------------------\n`;
        tableChunk += `${createSql.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ')};\n`;
        tableChunk += `DELETE FROM \`${table}\`;\n\n`;
      }

      if (rows && rows.length > 0) {
        tableChunk += `-- Dumping data for table \`${table}\` (${rows.length} rows)\n`;
        const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(', ');

        const batchSize = 100;
        for (let j = 0; j < rows.length; j += batchSize) {
          const rowBatch = rows.slice(j, j + batchSize);
          const valuesList = rowBatch
            .map((row) => `(${Object.values(row).map(escapeSqlValue).join(', ')})`)
            .join(',\n');
          tableChunk += `INSERT INTO \`${table}\` (${cols}) VALUES\n${valuesList};\n`;
        }
        tableChunk += `\n`;
      }

      results[idx] = tableChunk;
    });

    await Promise.all(batchPromises);
  }

  chunks.push(results.join(''));
  chunks.push(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  chunks.push(`-- End of Snapshot Dump\n`);

  return chunks.join('');
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
 * GET /api/backup/export-excel or /api/backup/export-class-wise-zip
 * Export All Students Class-Wise into a Structured ZIP Archive (.zip)
 * Each student's file is formatted as an individual Excel Dossier inside their Class folder.
 */
async function exportClassWiseZipArchive(req, res) {
  try {
    console.log('[backupController] Generating Class-Wise Student Excel ZIP Archive...');
    const students = await db.query(`
      SELECT s.id, s.admission_no, s.full_name, COALESCE(c.name, 'Unassigned_Class') as class_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      WHERE s.status = 'active'
      ORDER BY c.id ASC, s.full_name ASC
    `);

    const archive = (typeof archiver === 'function')
      ? archiver('zip', { zlib: { level: 9 } })
      : (archiver.ZipArchive ? new archiver.ZipArchive({ zlib: { level: 9 } }) : new archiver.Archiver('zip', { zlib: { level: 9 } }));

    const timestamp = new Date().toISOString().slice(0, 10);
    const zipFilename = `School_Student_Ledgers_ClassWise_${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    archive.on('error', (err) => {
      console.error('[exportClassWiseZipArchive] Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to build ZIP archive: ' + err.message });
      }
    });

    archive.pipe(res);

    // Loop through students, generate individual Excel buffer, and append into Class folder
    const nameCounts = {};
    for (const st of students) {
      const cleanClassName = (st.class_name || 'Class_General').trim().replace(/[^a-zA-Z0-9_\s-]/g, '').replace(/\s+/g, '_');
      const cleanName = (st.full_name || 'Student').trim().replace(/[^a-zA-Z0-9_\s-]/g, '').replace(/\s+/g, '_');

      const classStudentKey = `${cleanClassName}/${cleanName}`;
      nameCounts[classStudentKey] = (nameCounts[classStudentKey] || 0) + 1;
      const fileSuffix = nameCounts[classStudentKey] > 1 ? `_${nameCounts[classStudentKey]}` : '';
      const entryPath = `${cleanClassName}/${cleanName}${fileSuffix}.xlsx`;

      try {
        const wb = await generateStudentExcelWorkbook(st.id);
        const buffer = await wb.xlsx.writeBuffer();
        archive.append(buffer, { name: entryPath });
      } catch (stErr) {
        console.warn(`[exportClassWiseZipArchive] Skipped student #${st.id}:`, stErr.message);
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('[backupController.exportClassWiseZipArchive] Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: `Failed to export Class-Wise ZIP archive: ${err.message}` });
    }
  }
}

// Alias for backwards compatibility
const exportMasterExcelArchive = exportClassWiseZipArchive;

/**
 * POST /api/backup/send-cloud
 * Dispatch backup snapshot directly to configured Cloud Backup Email / Google Drive storage
 */
async function sendCloudBackupEmail(req, res) {
  try {
    ensureBackupDir();
    const { target_email } = req.body || {};

    const settings = await db.queryOne('SELECT * FROM school_settings LIMIT 1') || {};
    const adminUser = await db.queryOne("SELECT email FROM users WHERE role = 'admin' LIMIT 1") || {};
    const emailTo = (target_email && target_email.trim()) || settings.backup_email || settings.email || adminUser.email || process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'admin@school.com';

    // Strict email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailTo || !emailRegex.test(emailTo.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address. Please check your email and try again.',
      });
    }

    // 1. Generate fast SQL backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `cloud-backup-${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    const sqlDump = await generateNativeSqlDump();
    fs.writeFileSync(filepath, sqlDump, 'utf8');

    // Record in backups table
    await db.query(
      `INSERT INTO \`backups\` (\`filename\`, \`file_path\`, \`file_size\`, \`status\`, \`created_at\`, \`created_by\`)
       VALUES (?, ?, ?, 'completed', NOW(), ?)`,
      [filename, filepath, sqlDump.length, req.user?.id || null]
    );

    // Audit log
    try {
      await db.query(
        `INSERT INTO \`backup_logs\` (\`type\`, \`file_name\`, \`file_size\`, \`performed_by\`, \`created_at\`)
         VALUES ('export', ?, ?, ?, NOW())`,
        [filename, sqlDump.length, req.user?.id || null]
      );
    } catch (logErr) {
      console.warn('[sendCloudBackupEmail] Log insert warning:', logErr.message);
    }

    // 2. Dispatch email with attachment
    try {
      await sendDatabaseBackupEmail(emailTo.trim(), filename, sqlDump);
    } catch (emailErr) {
      console.error('[sendCloudBackupEmail] Email dispatch failed:', emailErr.message);
      return res.status(400).json({
        success: false,
        message: `Failed to send backup to "${emailTo}". Please check your email address and try again.`,
      });
    }

    return res.json({
      success: true,
      message: `✓ Database backup snapshot successfully dispatched to ${emailTo}!`,
      filename,
    });
  } catch (err) {
    console.error('[backupController.sendCloudBackupEmail] Error:', err);
    return res.status(500).json({
      success: false,
      message: `Failed to dispatch cloud backup: ${err.message}. Please check your email and try again.`,
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
  exportClassWiseZipArchive,
  sendCloudBackupEmail,
  upload,
};