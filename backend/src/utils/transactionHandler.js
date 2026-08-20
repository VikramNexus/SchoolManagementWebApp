/**
 * Transaction Handler — School Management System
 *
 * Day 6: Fee Engine & Payments.
 *
 * Wrapper for MySQL transactions with automatic rollback on error.
 */

const db = require('../config/db');

/**
 * Execute a callback within a transaction.
 * Automatically rolls back on error.
 *
 * @param {Function} callback - Async function receiving a connection object
 * @returns {Promise<any>} Result from callback
 */
async function withTransaction(callback) {
  const conn = await db.getConnection();
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
 * Execute multiple queries in a transaction.
 * Useful for batch operations.
 *
 * @param {Array} queries - Array of { sql, params } objects
 * @returns {Promise<Array>} Array of results
 */
async function executeBatch(queries) {
  return withTransaction(async (conn) => {
    const results = [];
    for (const { sql, params } of queries) {
      const [result] = await conn.execute(sql, params);
      results.push(result);
    }
    return results;
  });
}

module.exports = {
  withTransaction,
  executeBatch,
};