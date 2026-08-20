const db = require('./src/config/db');

async function fixZeroRates() {
  try {
    await db.ensureDatabase();
    
    // 1. Update students with 0.00 monthly_fee_rate
    await db.query(`UPDATE \`students\` SET \`monthly_fee_rate\` = 3000.00 WHERE \`category\` = 'day_scholar' AND (\`monthly_fee_rate\` IS NULL OR \`monthly_fee_rate\` <= 0)`);
    await db.query(`UPDATE \`students\` SET \`monthly_fee_rate\` = 5000.00 WHERE \`category\` = 'hosteller' AND (\`monthly_fee_rate\` IS NULL OR \`monthly_fee_rate\` <= 0)`);
    
    // 2. Update any 0.00 monthly_fees ledgers
    await db.query(
      `UPDATE \`monthly_fees\` mf
       JOIN \`students\` s ON s.\`id\` = mf.\`student_id\`
       SET mf.\`fee_amount\` = s.\`monthly_fee_rate\`, mf.\`due_amount\` = s.\`monthly_fee_rate\` - mf.\`paid_amount\`
       WHERE mf.\`status\` = 'DUE' AND (mf.\`fee_amount\` <= 0 OR mf.\`due_amount\` <= 0)`
    );

    console.log('✅ Fixed all zero rates in students and monthly_fees tables.');
  } catch (err) {
    console.error('Error fixing zero rates:', err);
  } finally {
    await db.closePool();
  }
}

fixZeroRates();
