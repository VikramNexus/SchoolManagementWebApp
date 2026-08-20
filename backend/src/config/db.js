/**
 * MySQL Connection Pool — School Management System
 * Centralized DB connection with promise wrapper.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Database name from environment
const DB_NAME = process.env.DB_NAME || 'school_management_db';

// ---------------------------------------------------------------------------
// Pool configuration from environment
// ---------------------------------------------------------------------------
const isCloudSSL = process.env.DB_SSL === 'true' || !!process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1');

const poolConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: '+00:00',
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      ssl: isCloudSSL ? { rejectUnauthorized: false } : undefined,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: '+00:00',
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      ssl: isCloudSSL ? { rejectUnauthorized: false } : undefined,
    };

// ---------------------------------------------------------------------------
// Ensure database exists before creating pool
// ---------------------------------------------------------------------------
async function ensureDatabase() {
  if (process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1')) {
    // In managed cloud databases, database is pre-created by provider
    return;
  }
  try {
    const adminConfig = { ...poolConfig, database: undefined };
    const adminPool = mysql.createPool(adminConfig);
    try {
      await adminPool.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally {
      await adminPool.end();
    }
  } catch (err) {
    console.warn('[DB] Note on ensureDatabase:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Create the pool (lazy singleton)
// ---------------------------------------------------------------------------
let pool;

function getPool() {
  if (!pool) {
    pool = process.env.DATABASE_URL
      ? mysql.createPool(process.env.DATABASE_URL)
      : mysql.createPool(poolConfig);
    // Optional: log pool events in development
    if (process.env.NODE_ENV !== 'production') {
      pool.on('connection', (conn) => {
        console.debug(`[DB] New connection ${conn.threadId}`);
      });
      pool.on('acquire', (conn) => {
        console.debug(`[DB] Acquired connection ${conn.threadId}`);
      });
      pool.on('release', (conn) => {
        console.debug(`[DB] Released connection ${conn.threadId}`);
      });
    }
  }
  return pool;
}

/**
 * Execute a query with automatic connection management.
 * @param {string} sql - SQL query with ? or :named placeholders
 * @param {Array|Object} [params] - Query parameters
 * @returns {Promise<Array>} Result rows
 */
async function query(sql, params) {
  const p = getPool();
  const [rows] = await p.query(sql, params);
  return rows;
}

/**
 * Execute a query and return the first row only.
 * @param {string} sql
 * @param {Array|Object} [params]
 * @returns {Promise<Object|null>}
 */
async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Execute a query within a transaction.
 * Callback receives a connection with `execute` method.
 * @template T
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function transaction(callback) {
  const p = getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Get a raw connection from the pool (for advanced use).
 * Caller must release it.
 */
async function getConnection() {
  return getPool().getConnection();
}

/**
 * Close the pool (for graceful shutdown).
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Health check — verify DB connectivity.
 */
async function healthCheck() {
  try {
    await query('SELECT 1 AS ok');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  query,
  queryOne,
  transaction,
  getConnection,
  closePool,
  healthCheck,
  getPool,
  ensureDatabase,
};