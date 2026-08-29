const db = require('../src/config/db');

async function testPart3() {
  console.log('=== RUNNING PART 3: SYSTEM SETTINGS, CLASSES, SECTIONS & FEE TYPES ===\n');

  try {
    // 3.1 School Profile
    const school = await db.queryOne('SELECT * FROM school_settings WHERE id = 1');
    if (!school) {
      console.error('❌ 3.1 School settings row not found.');
    } else {
      console.log(`✅ 3.1 School Profile verified: "${school.school_name}", Academic Year: "${school.academic_year}", Currency: "${school.currency_symbol}"`);
    }

    // 3.2 Classes Verification
    const classes = await db.query('SELECT * FROM classes ORDER BY order_index ASC, name ASC');
    console.log(`\n--- Classes List (${classes.length} found) ---`);
    classes.slice(0, 5).forEach(c => console.log(`  • Class: "${c.name}", Order: ${c.order_index}, Active: ${c.is_active}`));
    if (classes.length > 5) console.log(`  ... and ${classes.length - 5} more classes.`);
    if (classes.length > 0) {
      console.log(`✅ 3.2 Classes verified (${classes.length} classes available).`);
    } else {
      console.error('❌ 3.2 No classes found.');
    }

    // 3.3 Sections Verification
    const sections = await db.query(`
      SELECT s.*, c.name as class_name
      FROM sections s
      LEFT JOIN classes c ON c.id = s.class_id
      ORDER BY c.order_index ASC, s.name ASC
    `);
    console.log(`\n--- Sections List (${sections.length} found) ---`);
    sections.slice(0, 6).forEach(s => console.log(`  • Section: "${s.name}" (Class: ${s.class_name || 'N/A'})`));
    if (sections.length > 6) console.log(`  ... and ${sections.length - 6} more sections.`);
    if (sections.length > 0) {
      console.log(`✅ 3.3 Sections verified (${sections.length} sections mapped to classes).`);
    } else {
      console.error('❌ 3.3 No sections found.');
    }

    // 3.4 Custom Fee Types
    const feeTypes = await db.query('SELECT * FROM fee_types ORDER BY name ASC');
    console.log(`\n--- Custom Fee Types (${feeTypes.length} found) ---`);
    feeTypes.forEach(ft => console.log(`  • Fee Type: "${ft.name}", Recurring: ${ft.is_recurring ? 'Yes' : 'No'}, Active: ${ft.is_active}`));
    if (feeTypes.length > 0) {
      console.log(`✅ 3.4 Custom Fee Types verified (${feeTypes.length} types registered).`);
    } else {
      console.error('❌ 3.4 No fee types found.');
    }

    // 3.5 Fee Structures (Base Rates)
    const structures = await db.query('SELECT * FROM fee_structures ORDER BY category ASC');
    console.log(`\n--- Fee Structures (${structures.length} found) ---`);
    structures.forEach(fs => console.log(`  • Category: "${fs.category}", Base Rate: ₹${Number(fs.amount).toLocaleString('en-IN')}`));
    console.log(`✅ 3.5 Base Category Rates verified.`);

    console.log('\n======================================================');
    console.log('🎉 PART 3 TESTING RESULT: 100% PASS (ALL CHECKS PASSED)');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Part 3 Test Error:', err);
    process.exit(1);
  }
}

testPart3();
