/**
 * Fee Generator Service — School Management System
 *
 * Auto-generates monthly_fees for students using their individual
 * monthly_fee_rate configured at admission or updated in profile.
 */

const db = require('../config/db');

/**
 * Get a transaction connection
 */
async function getTransaction() {
  return db.getConnection();
}

/**
 * Get the current fee structure for a category (fallback)
 */
async function getFeeStructure(category) {
  return await db.queryOne(
    `SELECT * FROM \`fee_structures\`
     WHERE \`category\` = ? AND \`is_active\` = 1
     ORDER BY \`effective_from\` DESC
     LIMIT 1`,
    [category]
  );
}

/**
 * Generate monthly fees for a student from admission month to current month
 * @param {number} studentId
 * @param {string|number} [studentCategoryOrRate]
 * @param {string|Date} [admissionDate]
 * @param {number} [explicitMonthlyRate]
 */
async function generateMonthlyFeesForStudent(studentId, studentCategoryOrRate, admissionDate, explicitMonthlyRate) {
  // Fetch student details from DB if needed
  const student = await db.queryOne(
    'SELECT `id`, `category`, `admission_date`, `monthly_fee_rate` FROM `students` WHERE `id` = ?',
    [studentId]
  );

  if (!student) {
    return { success: false, message: 'Student not found' };
  }

  let monthlyAmount = explicitMonthlyRate || Number(student.monthly_fee_rate);

  // Fallback to category base rate if 0
  if (!monthlyAmount || monthlyAmount <= 0) {
    if (typeof studentCategoryOrRate === 'number' && studentCategoryOrRate > 0) {
      monthlyAmount = studentCategoryOrRate;
    } else {
      const fs = await getFeeStructure(student.category);
      monthlyAmount = fs ? Number(fs.amount) : 0;
    }
  }

  const admission = new Date(admissionDate || student.admission_date || new Date());
  const currentDate = new Date();

  // Normalize to first day of month
  const startYear = admission.getFullYear();
  const startMonth = admission.getMonth() + 1; // 1-12

  const endYear = currentDate.getFullYear();
  const endMonth = currentDate.getMonth() + 1; // 1-12

  const feesToInsert = [];

  for (let year = startYear; year <= endYear; year++) {
    const monthStart = (year === startYear) ? startMonth : 1;
    const monthEnd = (year === endYear) ? endMonth : 12;

    for (let month = monthStart; month <= monthEnd; month++) {
      // Check if fee already exists for this student/month/year
      const existing = await db.queryOne(
        `SELECT \`id\` FROM \`monthly_fees\`
         WHERE \`student_id\` = ? AND \`fee_month\` = ? AND \`fee_year\` = ?`,
        [studentId, month, year]
      );

      if (!existing) {
        feesToInsert.push({
          student_id: studentId,
          fee_month: month,
          fee_year: year,
          fee_amount: monthlyAmount,
          paid_amount: 0,
          due_amount: monthlyAmount,
          status: 'DUE',
        });
      }
    }
  }

  if (feesToInsert.length === 0) {
    return { success: true, message: 'No new fees to generate', count: 0 };
  }

  // Bulk insert using transaction
  const conn = await getTransaction();
  try {
    await conn.beginTransaction();
    for (const fee of feesToInsert) {
      await conn.execute(
        `INSERT INTO \`monthly_fees\`
         (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [fee.student_id, fee.fee_month, fee.fee_year, fee.fee_amount, fee.paid_amount, fee.due_amount, fee.status]
      );
    }
    await conn.commit();
    return { success: true, message: 'Monthly fees generated', count: feesToInsert.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Generate monthly fees for ALL active students for a new month
 */
async function generateMonthlyFeesForAllStudents(targetMonth, targetYear) {
  // Get all active students with their individual monthly_fee_rate
  const students = await db.query(
    `SELECT \`id\`, \`category\`, \`monthly_fee_rate\` FROM \`students\`
     WHERE \`status\` = 'active'`
  );

  if (students.length === 0) {
    return { success: true, message: 'No active students', count: 0 };
  }

  // Fetch category fallbacks if needed
  const categories = [...new Set(students.map(s => s.category))];
  const fallbackRates = {};
  for (const cat of categories) {
    const fs = await getFeeStructure(cat);
    if (fs) fallbackRates[cat] = Number(fs.amount);
  }

  const feesToInsert = [];

  for (const student of students) {
    let monthlyAmount = Number(student.monthly_fee_rate);
    if (!monthlyAmount || monthlyAmount <= 0) {
      monthlyAmount = fallbackRates[student.category] || 0;
    }

    if (!monthlyAmount || monthlyAmount <= 0) continue;

    // Check if already exists
    const existing = await db.queryOne(
      `SELECT \`id\` FROM \`monthly_fees\`
       WHERE \`student_id\` = ? AND \`fee_month\` = ? AND \`fee_year\` = ?`,
      [student.id, targetMonth, targetYear]
    );

    if (!existing) {
      feesToInsert.push({
        student_id: student.id,
        fee_month: targetMonth,
        fee_year: targetYear,
        fee_amount: monthlyAmount,
        paid_amount: 0,
        due_amount: monthlyAmount,
        status: 'DUE',
      });
    }
  }

  if (feesToInsert.length === 0) {
    return { success: true, message: 'No new fees to generate', count: 0 };
  }

  const conn = await getTransaction();
  try {
    await conn.beginTransaction();
    for (const fee of feesToInsert) {
      await conn.execute(
        `INSERT INTO \`monthly_fees\`
         (\`student_id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [fee.student_id, fee.fee_month, fee.fee_year, fee.fee_amount, fee.paid_amount, fee.due_amount, fee.status]
      );
    }
    await conn.commit();
    return { success: true, message: `Monthly fees generated for ${feesToInsert.length} students`, count: feesToInsert.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Generate fees for a specific student up to a target month/year
 */
async function generateFeesUpToMonth(studentId, targetMonth, targetYear) {
  const student = await db.queryOne(
    `SELECT \`category\`, \`admission_date\`, \`monthly_fee_rate\` FROM \`students\`
     WHERE \`id\` = ? AND \`status\` != 'deleted'`,
    [studentId]
  );

  if (!student) {
    return { success: false, message: 'Student not found' };
  }

  return await generateMonthlyFeesForStudent(studentId, student.category, student.admission_date, Number(student.monthly_fee_rate));
}

module.exports = {
  getFeeStructure,
  generateMonthlyFeesForStudent,
  generateMonthlyFeesForAllStudents,
  generateFeesUpToMonth,
};