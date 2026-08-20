const db = require('../src/config/db');

async function fixRates() {
  try {
    await db.ensureDatabase();

    // Fetch fee structures
    const feeStructures = await db.query('SELECT category, amount FROM fee_structures WHERE is_active = 1');
    console.log('Active Fee Structures:', feeStructures);

    let dayScholarRate = 3000;
    let hostellerRate = 5000;

    for (const fs of feeStructures) {
      if (fs.category === 'day_scholar' && Number(fs.amount) > 0) dayScholarRate = Number(fs.amount);
      if (fs.category === 'hosteller' && Number(fs.amount) > 0) hostellerRate = Number(fs.amount);
    }

    console.log(`Setting Day Scholar default rate: ₹${dayScholarRate}`);
    console.log(`Setting Hosteller default rate: ₹${hostellerRate}`);

    // Update students in DB
    const res1 = await db.query(
      `UPDATE students SET monthly_fee_rate = ? WHERE category = 'day_scholar' AND (monthly_fee_rate IS NULL OR monthly_fee_rate <= 0)`,
      [dayScholarRate]
    );
    console.log(`Updated Day Scholar students: ${res1.affectedRows}`);

    const res2 = await db.query(
      `UPDATE students SET monthly_fee_rate = ? WHERE category = 'hosteller' AND (monthly_fee_rate IS NULL OR monthly_fee_rate <= 0)`,
      [hostellerRate]
    );
    console.log(`Updated Hosteller students: ${res2.affectedRows}`);

    // Check updated students
    const updated = await db.query('SELECT id, admission_no, full_name, category, monthly_fee_rate FROM students');
    console.log('\nUpdated Database Records:');
    console.table(updated);
  } catch (err) {
    console.error('Error fixing DB rates:', err);
  } finally {
    await db.closePool();
  }
}

fixRates();
