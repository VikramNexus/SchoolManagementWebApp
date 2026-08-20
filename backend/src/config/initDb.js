/**
 * Database Initialization Script — School Management System
 *
 * Reads schema.sql and seeders.sql from the database/ directory
 * and executes them against the configured MySQL database.
 *
 * Usage:
 *   node src/config/initDb.js
 *
 * Can also be imported and called programmatically.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import after dotenv config so env vars are available
const { query, transaction, closePool, healthCheck, ensureDatabase } = require('./db');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DB_DIR = path.resolve(__dirname, '../../../database');
const SCHEMA_FILE = path.join(DB_DIR, 'schema.sql');
const SEEDERS_FILE = path.join(DB_DIR, 'seeders.sql');

// ---------------------------------------------------------------------------
// Helper: Split SQL file into individual statements
// ---------------------------------------------------------------------------
function splitSqlStatements(sqlContent) {
  // Remove single-line comments and trim
  const cleaned = sqlContent
    .split('\n')
    .map(line => line.replace(/--.*$/, '').trim())
    .filter(line => line.length > 0)
    .join('\n');

  // Split by semicolon followed by newline or end of string
  // This is a simple split - works for our controlled SQL files
  return cleaned
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.toUpperCase().startsWith('USE '));
}

// ---------------------------------------------------------------------------
// Execute a single SQL file
// ---------------------------------------------------------------------------
async function executeSqlFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const statements = splitSqlStatements(content);

  console.log(`\n📄 Executing ${label} (${statements.length} statements)...`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      // Use transaction for DDL statements that modify schema
      if (stmt.trim().toUpperCase().startsWith('CREATE') ||
          stmt.trim().toUpperCase().startsWith('DROP') ||
          stmt.trim().toUpperCase().startsWith('ALTER')) {
        await query(stmt);
      } else {
        // Data manipulation - use regular query
        await query(stmt);
      }
      successCount++;
      if (process.env.NODE_ENV !== 'production') {
        const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
        console.debug(`  ✓ [${i + 1}/${statements.length}] ${preview}...`);
      }
    } catch (err) {
      // Some statements like "INSERT IGNORE" may produce warnings, not errors
      // But actual errors should be reported
      errorCount++;
      console.error(`  ✗ [${i + 1}/${statements.length}] FAILED:`);
      console.error(`    Statement: ${stmt.substring(0, 200)}...`);
      console.error(`    Error: ${err.message}`);
      // Don't throw on seed data errors (e.g. duplicate key on re-run)
      if (label === 'Seeders' && err.code === 'ER_DUP_ENTRY') {
        console.log(`    (Ignoring duplicate entry — re-run safe)`);
        errorCount--; // Don't count as real error
      }
    }
  }

  console.log(`  ${label}: ${successCount} succeeded, ${errorCount} errors`);
  return { successCount, errorCount };
}

// ---------------------------------------------------------------------------
// Main initialization function
// ---------------------------------------------------------------------------
async function initializeDatabase(options = {}) {
  const { skipSchema = false, skipSeeders = false, verbose = false } = options;

  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  School Management System — Database Initialization             ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  // Verify database connectivity first
  console.log('\n🔌 Checking database connection...');

  // Ensure database exists
  try {
    await ensureDatabase();
    console.log('  ✓ Database exists/created');
  } catch (err) {
    throw new Error(`Cannot create/connect to database: ${err.message}`);
  }

  const connected = await healthCheck();
  if (!connected) {
    throw new Error('Cannot connect to database. Check your .env configuration.');
  }
  console.log('  ✓ Connected successfully');

  // Execute schema
  if (!skipSchema) {
    await executeSqlFile(SCHEMA_FILE, 'Schema');
  }

  // Execute seeders
  if (!skipSeeders) {
    await executeSqlFile(SEEDERS_FILE, 'Seeders');
  }

  console.log('\n✅ Database initialization complete!');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Close pool if we created it
  await closePool();
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    skipSchema: args.includes('--skip-schema'),
    skipSeeders: args.includes('--skip-seeders'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  initializeDatabase(options)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Initialization failed:');
      console.error(err.message);
      if (options.verbose) console.error(err.stack);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };