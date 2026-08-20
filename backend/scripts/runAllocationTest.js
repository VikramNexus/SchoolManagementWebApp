/**
 * Allocation Test Runner — School Management System
 *
 * Day 7: Financial Validation & Allocation Correctness Runner.
 *
 * Run with: node scripts/runAllocationTest.js
 */

const { spawn } = require('child_process');
const path = require('path');
const db = require('../src/config/db');

async function main() {
  console.log('===========================================================');
  console.log('🚀 Running Day 7 Financial Validation & Allocation Tests');
  console.log('===========================================================');

  try {
    await db.ensureDatabase();

    const testFilePath = path.join(__dirname, '..', 'tests', 'paymentAllocation.test.js');
    const child = spawn(process.execPath, ['--test', testFilePath], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', async (code) => {
      await db.closePool();
      console.log('===========================================================');
      if (code === 0) {
        console.log('✅ ALL DAY 7 ALLOCATION TESTS PASSED SUCCESSFULLY!');
      } else {
        console.error(`❌ Allocation tests failed with exit code ${code}`);
        process.exit(code);
      }
    });
  } catch (err) {
    console.error('Fatal error running allocation tests:', err);
    await db.closePool();
    process.exit(1);
  }
}

main();