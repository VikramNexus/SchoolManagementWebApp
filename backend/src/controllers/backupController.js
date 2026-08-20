/**
 * Backup Controller — School Management System
 *
 * Day 10: Backup, Security & Launch.
 *
 * Handles database backup (mysqldump), restore, and backup file management.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const multer = require('multer');
const db = require('../config/db');

const execAsync = promisify(exec);

// Backup directory
const BACKUP_DIR = path.resolve(__dirname, '../../../uploads/backups');

// Configure multer for file uploads
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
    if (file.originalname.endsWith('.sql')) {
      cb(null, true);
    } else {
      cb(new Error('Only .sql files are allowed'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return BACKUP_DIR;
}

/**
 * Get database connection config for mysqldump
 */
function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '3306',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'school_management_db',
    mysqldumpPath: process.env.MYSQLDUMP_PATH || 'mysqldump',
    mysqlPath: process.env.MYSQL_PATH || 'mysql',
  };
}

/**
 * POST /api/backup/create
 * Create a new database backup using mysqldump
 */
async function createBackup(req, res) {
  try {
    ensureBackupDir();

    const config = getDbConfig();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Build mysqldump command
    const passwordArg = config.password ? `-p${config.password}` : '';
    const mysqldumpCmd = config.mysqldumpPath || 'mysqldump';
    const command = `"${mysqldumpCmd}" -h ${config.host} -P ${config.port} -u ${config.user} ${passwordArg} --single-transaction --routines --triggers --events ${config.database} > "${filepath}"`;

    console.log('[backupController] Running backup:', command.replace(passwordArg, '-p***'));

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 50, // 50MB buffer
      timeout: 120000, // 2 minutes timeout
    });

    if (stderr && !stderr.includes('Warning:')) {
      console.warn('[backupController] mysqldump stderr:', stderr);
    }

    // Verify file was created
    if (!fs.existsSync(filepath)) {
      throw new Error('Backup file was not created');
    }

    const stats = fs.statSync(filepath);
    const size = stats.size;

    // Save backup metadata to database
    await db.query(
      `INSERT INTO \`backups\` (\`filename\`, \`file_path\`, \`file_size\`, \`status\`, \`created_at\`)
       VALUES (?, ?, ?, 'completed', NOW())`,
      [filename, filepath, size]
    );

    return res.json({
      success: true,
      message: 'Backup created successfully',
      backup: {
        filename,
        size,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[backupController.createBackup] Error:', err);
    return res.status(500).json({ success: false, message: `Backup failed: ${err.message}` });
  }
}

/**
 * GET /api/backup/list
 * List all backup files
 */
async function listBackups(req, res) {
  try {
    ensureBackupDir();

    // Get from database first
    const dbBackups = await db.query(
      'SELECT * FROM `backups` ORDER BY `created_at` DESC'
    );

    // Also scan filesystem for any orphaned files
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql'))
      .map(f => {
        const filepath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filepath);
        return {
          filename: f,
          filepath,
          size: stats.size,
          created_at: stats.mtime.toISOString(),
          from_fs: true,
        };
      });

    // Merge: prefer database records, add filesystem-only files
    const dbFilenames = new Set(dbBackups.map(b => b.filename));
    const merged = [...dbBackups];

    for (const fsFile of files) {
      if (!dbFilenames.has(fsFile.filename)) {
        merged.push({
          id: null,
          filename: fsFile.filename,
          file_path: fsFile.filepath,
          file_size: fsFile.size,
          status: 'completed',
          created_at: fsFile.created_at,
          from_fs: true,
        });
      }
    }

    // Sort by date descending
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

  // Sanitize filename to prevent path traversal
  const safeFilename = path.basename(filename);
  if (!safeFilename.endsWith('.sql')) {
    return res.status(400).json({ success: false, message: 'Invalid backup file' });
  }

  const filepath = path.join(BACKUP_DIR, safeFilename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, message: 'Backup file not found' });
  }

  res.download(filepath, safeFilename, (err) => {
    if (err) {
      console.error('[backupController.downloadBackup] Error:', err);
      res.status(500).json({ success: false, message: 'Download failed' });
    }
  });
}

/**
 * POST /api/backup/restore/:filename
 * Restore database from a backup file
 */
async function restoreBackup(req, res) {
  const { filename } = req.params;

  // Sanitize filename
  const safeFilename = path.basename(filename);
  if (!safeFilename.endsWith('.sql')) {
    return res.status(400).json({ success: false, message: 'Invalid backup file' });
  }

  const filepath = path.join(BACKUP_DIR, safeFilename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, message: 'Backup file not found' });
  }

  try {
    const config = getDbConfig();
    const passwordArg = config.password ? `-p${config.password}` : '';
    const mysqlCmd = config.mysqlPath || 'mysql';

    // Read the SQL file first to validate
    const sqlContent = fs.readFileSync(filepath, 'utf8');
    if (!sqlContent.trim()) {
      return res.status(400).json({ success: false, message: 'Backup file is empty' });
    }

    // Drop all tables and recreate from backup
    // We'll use mysql command to restore
    const command = `"${mysqlCmd}" -h ${config.host} -P ${config.port} -u ${config.user} ${passwordArg} ${config.database} < "${filepath}"`;

    console.log('[backupController] Running restore:', command.replace(passwordArg, '-p***'));

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 50,
      timeout: 180000, // 3 minutes timeout
    });

    if (stderr && !stderr.includes('Warning:')) {
      console.warn('[backupController] mysql restore stderr:', stderr);
    }

    // Record restore in database
    await db.query(
      `INSERT INTO \`backups\` (\`filename\`, \`file_path\`, \`file_size\`, \`status\`, \`created_at\`)
       VALUES (?, ?, ?, 'restored', NOW())`,
      [`restored-${safeFilename}`, filepath, fs.statSync(filepath).size]
    );

    return res.json({
      success: true,
      message: 'Database restored successfully',
    });
  } catch (err) {
    console.error('[backupController.restoreBackup] Error:', err);
    return res.status(500).json({ success: false, message: `Restore failed: ${err.message}` });
  }
}

/**
 * DELETE /api/backup/:filename
 * Delete a backup file
 */
async function deleteBackup(req, res) {
  const { filename } = req.params;

  // Sanitize filename
  const safeFilename = path.basename(filename);
  if (!safeFilename.endsWith('.sql')) {
    return res.status(400).json({ success: false, message: 'Invalid backup file' });
  }

  const filepath = path.join(BACKUP_DIR, safeFilename);

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Also remove from database
    await db.query('DELETE FROM `backups` WHERE `filename` = ?', [safeFilename]);

    return res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (err) {
    console.error('[backupController.deleteBackup] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete backup' });
  }
}

/**
 * GET /api/backup/info
 * Get backup system info (disk space, last backup, etc.)
 */
async function getBackupInfo(req, res) {
  try {
    ensureBackupDir();

    const config = getDbConfig();

    // Get database size
    const dbSizeResult = await db.queryOne(
      `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
       FROM information_schema.tables
       WHERE table_schema = ?`,
      [config.database]
    );

    // Get last backup
    const lastBackup = await db.queryOne(
      'SELECT * FROM `backups` WHERE `status` = "completed" ORDER BY `created_at` DESC LIMIT 1'
    );

    // Get disk space for backup directory
    const { stdout: dfOutput } = await execAsync(`df -h "${BACKUP_DIR}"`);
    const dfLines = dfOutput.trim().split('\n');
    const diskInfo = dfLines[1]?.split(/\s+/) || [];

    return res.json({
      success: true,
      info: {
        database_size_mb: dbSizeResult?.size_mb || 0,
        backup_directory: BACKUP_DIR,
        last_backup: lastBackup ? {
          filename: lastBackup.filename,
          size: lastBackup.file_size,
          created_at: lastBackup.created_at,
        } : null,
        disk_space: {
          total: diskInfo[1] || 'unknown',
          used: diskInfo[2] || 'unknown',
          available: diskInfo[3] || 'unknown',
          use_percent: diskInfo[4] || 'unknown',
        },
      },
    });
  } catch (err) {
    console.error('[backupController.getBackupInfo] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get backup info' });
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
  upload,
};

/**
 * POST /api/backup/upload
 * Upload a backup file from client
 */
async function uploadBackup(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filename = req.file.filename;
    const filepath = req.file.path;
    const size = req.file.size;

    // Save to database
    await db.query(
      `INSERT INTO \`backups\` (\`filename\`, \`file_path\`, \`file_size\`, \`status\`, \`created_at\`)
       VALUES (?, ?, ?, 'completed', NOW())
       ON DUPLICATE KEY UPDATE \`file_path\` = ?, \`file_size\` = ?, \`status\` = 'completed', \`created_at\` = NOW()`,
      [filename, filepath, size, filepath, size]
    );

    return res.json({
      success: true,
      message: 'Backup uploaded successfully',
      backup: {
        filename,
        size,
      },
    });
  } catch (err) {
    console.error('[backupController.uploadBackup] Error:', err);
    return res.status(500).json({ success: false, message: `Upload failed: ${err.message}` });
  }
}