/**
 * Student Excel Dossier Service — School Management System
 *
 * Generates an ultra-clean, pixel-perfect single-sheet student profile
 * and running-balance financial fee ledger formatted exactly like
 * standard institutional academic registers.
 */

const ExcelJS = require('exceljs');
const db = require('../config/db');

const MONTH_ABBR = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Format date to DD-MM-YY (e.g. 18-10-25)
 */
function formatDateShort(dateVal) {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const yr = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${yr}`;
  } catch {
    return '';
  }
}

/**
 * Format month-year to Mmm-YY (e.g. Sep-25)
 */
function formatMonthYear(monthNum, yearNum) {
  const m = MONTH_ABBR[Number(monthNum)] || `M${monthNum}`;
  const y = String(yearNum || new Date().getFullYear()).slice(-2);
  return `${m}-${y}`;
}

/**
 * Generate Excel Workbook for a single student
 * @param {number|string} studentId
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function generateStudentExcelWorkbook(studentId) {
  // 1. Fetch Student Details
  const student = await db.queryOne(
    `SELECT s.*, c.\`name\` as class_name, sec.\`name\` as section_name
     FROM \`students\` s
     LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
     LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
     WHERE s.\`id\` = ? AND s.\`status\` != 'deleted'`,
    [studentId]
  );

  if (!student) {
    throw new Error(`Student #${studentId} not found.`);
  }

  // 2. Fetch School Settings for Header
  const school = await db.queryOne('SELECT * FROM school_settings LIMIT 1') || {};
  const schoolName = school.school_name || 'ARYAVART SHIKSHAN SANSTHAN';
  const schoolAddress = school.address || 'Knowledge Campus, Bihar, India';

  // 3. Fetch Monthly Fee Ledger Records
  const monthlyFees = await db.query(
    `SELECT mf.*,
       COALESCE(
         (SELECT SUM(pa.\`allocated_amount\`) FROM \`payment_allocations\` pa WHERE pa.\`monthly_fee_id\` = mf.\`id\`),
         mf.\`paid_amount\`,
         0
       ) as actual_paid,
       (SELECT COALESCE(SUM(saf.\`amount\`), 0)
        FROM \`student_additional_fees\` saf
        WHERE saf.\`student_id\` = mf.\`student_id\`
          AND MONTH(saf.\`due_date\`) = mf.\`fee_month\`
          AND YEAR(saf.\`due_date\`) = mf.\`fee_year\`
          AND saf.\`description\` NOT LIKE '%Admission%'
          AND saf.\`description\` NOT LIKE '%Security%'
          AND saf.\`description\` NOT LIKE '%Tie%'
          AND saf.\`description\` NOT LIKE '%Belt%'
          AND saf.\`description\` NOT LIKE '%Caution%'
          AND saf.\`description\` NOT LIKE '%Uniform%') as other_charges,
       (SELECT p.\`payment_date\`
        FROM \`payment_allocations\` pa
        JOIN \`payments\` p ON p.\`id\` = pa.\`payment_id\`
        WHERE pa.\`monthly_fee_id\` = mf.\`id\`
        ORDER BY p.\`payment_date\` DESC LIMIT 1) as actual_payment_date,
       (SELECT p.\`payment_mode\`
        FROM \`payment_allocations\` pa
        JOIN \`payments\` p ON p.\`id\` = pa.\`payment_id\`
        WHERE pa.\`monthly_fee_id\` = mf.\`id\`
        ORDER BY p.\`payment_date\` DESC LIMIT 1) as actual_payment_mode
     FROM \`monthly_fees\` mf
     WHERE mf.\`student_id\` = ?
     ORDER BY mf.\`fee_year\` ASC, mf.\`fee_month\` ASC`,
    [studentId]
  );

  // 4. Create Workbook & Sheet
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'School Management System';
  workbook.created = new Date();

  const safeSheetName = (student.full_name || 'Student').slice(0, 28);
  const sheet = workbook.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  });

  // Set explicit column widths matching the photo layout
  sheet.columns = [
    { key: 'colA', width: 14 }, // Month
    { key: 'colB', width: 13 }, // Prev Due
    { key: 'colC', width: 12 }, // Other Fee
    { key: 'colD', width: 13 }, // Monthly Fee / Tuition
    { key: 'colE', width: 14 }, // Total Demand
    { key: 'colF', width: 14 }, // Amount Paid (Credit)
    { key: 'colG', width: 14 }, // Net Balance Due
    { key: 'colH', width: 14 }, // Payment Date
    { key: 'colI', width: 14 }, // Mode
  ];

  // Border helper
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } },
  };

  const boldBorder = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    left: { style: 'medium', color: { argb: 'FF0F172A' } },
    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    right: { style: 'medium', color: { argb: 'FF0F172A' } },
  };

  // ---------------------------------------------------------
  // 1. INSTITUTION HEADER
  // ---------------------------------------------------------
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = schoolName.toUpperCase();
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  sheet.mergeCells('A2:I2');
  const subCell = sheet.getCell('A2');
  subCell.value = `STUDENT PROFILE & RUNNING FEE REGISTER  •  ${schoolAddress}`;
  subCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.addRow([]); // Blank spacer row 3

  // ---------------------------------------------------------
  // 2. STUDENT & PARENT PROFILE CARD (Rows 4 - 7)
  // ---------------------------------------------------------
  const profileRows = [
    [
      'Student Name:', student.full_name || '—',
      'Admission No:', student.admission_no || '—',
      'Class & Sec:', `${student.class_name || '—'} ${student.section_name || ''}`.trim(),
      'Category:', student.category === 'hosteller' ? 'Hosteller / Residential' : 'Day Scholar'
    ],
    [
      "Father's Name:", student.father_name || student.parent_name || '—',
      "Mother's Name:", student.mother_name || '—',
      'Phone Number:', student.phone || '—',
      'Monthly Rate:', `₹${Number(student.monthly_fee_rate || 3000).toLocaleString('en-IN')}`
    ],
    [
      'Address:', student.address || '—',
      'WhatsApp:', student.whatsapp_number || student.phone || '—',
      'Admission Date:', student.admission_date ? new Date(student.admission_date).toLocaleDateString('en-IN') : '—',
      'Family ID:', student.family_id || '—'
    ],
  ];

  profileRows.forEach((pRow) => {
    const row = sheet.addRow([
      pRow[0], pRow[1], '',
      pRow[2], pRow[3],
      pRow[4], pRow[5],
      pRow[6], pRow[7]
    ]);
    row.font = { name: 'Calibri', size: 10 };
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    row.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    row.getCell(6).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    row.getCell(8).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
  });

  sheet.addRow([]); // Blank spacer row 8

  // ---------------------------------------------------------
  // 3. RUNNING BALANCE FEE LEDGER TABLE (Headers on Row 9)
  // ---------------------------------------------------------
  const headerRow = sheet.addRow([
    'Month',
    'Prev Due',
    'Other Fee',
    'Tuition',
    'Total Demand',
    'Amount Paid',
    'Net Balance',
    'Pay Date',
    'Mode'
  ]);

  headerRow.height = 24;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= 9; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = boldBorder;
  }

  // ---------------------------------------------------------
  // 4. DATA ROWS (Row-by-Row Running Balance Arithmetic)
  // ---------------------------------------------------------
  let runningPrevDue = Number(student.opening_dues || 0);

  if (monthlyFees.length === 0) {
    // If no months generated yet, show current status row
    const defaultRate = Number(student.monthly_fee_rate || 3000);
    const totalDemand = runningPrevDue + defaultRate;
    const curMonth = formatMonthYear(new Date().getMonth() + 1, new Date().getFullYear());

    const r = sheet.addRow([
      curMonth,
      runningPrevDue,
      0,
      defaultRate,
      totalDemand,
      0,
      totalDemand,
      '',
      ''
    ]);
    r.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= 9; c++) {
      const cell = r.getCell(c);
      cell.border = thinBorder;
      if (c >= 2 && c <= 7) cell.numFmt = '#,##0';
    }
  } else {
    monthlyFees.forEach((mf) => {
      const monthLabel = formatMonthYear(mf.fee_month, mf.fee_year);
      const prevDue = runningPrevDue;
      const otherFee = Number(mf.other_charges || 0);
      const tuition = Number(mf.amount || student.monthly_fee_rate || 3000);
      const totalDemand = prevDue + otherFee + tuition;
      const paid = Number(mf.actual_paid || 0);
      // Photo displays paid amount with negative sign (e.g. -5000) or 0
      const paidDisplay = paid > 0 ? -paid : 0;
      const netBalance = Math.max(0, totalDemand - paid);

      const payDate = mf.actual_payment_date ? formatDateShort(mf.actual_payment_date) : '';
      const payMode = mf.actual_payment_mode === 'IN_ACCOUNT'
        ? 'in acc.'
        : mf.actual_payment_mode === 'CASH'
        ? 'cash'
        : mf.actual_payment_mode || '';

      const r = sheet.addRow([
        monthLabel,
        prevDue,
        otherFee,
        tuition,
        totalDemand,
        paidDisplay,
        netBalance,
        payDate,
        payMode
      ]);

      r.height = 20;
      r.alignment = { horizontal: 'center', vertical: 'middle' };

      for (let c = 1; c <= 9; c++) {
        const cell = r.getCell(c);
        cell.border = thinBorder;
        if (c >= 2 && c <= 7) {
          cell.numFmt = '#,##0';
        }
      }

      // Roll over net balance to next month's opening due
      runningPrevDue = netBalance;
    });
  }

  // ---------------------------------------------------------
  // 5. SIGNATURE & AUTHORITY FOOTER BLOCK
  // ---------------------------------------------------------
  sheet.addRow([]); // Blank spacer
  const signRow = sheet.addRow([
    '', '', '', '', '', '', '',
    "Head's Signature", ''
  ]);
  signRow.height = 28;
  const startRowIdx = signRow.number;

  sheet.mergeCells(`H${startRowIdx}:I${startRowIdx}`);
  const signCell = sheet.getCell(`H${startRowIdx}`);
  signCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  signCell.alignment = { horizontal: 'center', vertical: 'middle' };
  signCell.border = {
    top: { style: 'thin', color: { argb: 'FF334155' } },
    left: { style: 'thin', color: { argb: 'FF334155' } },
    bottom: { style: 'thin', color: { argb: 'FF334155' } },
    right: { style: 'thin', color: { argb: 'FF334155' } },
  };

  return workbook;
}

module.exports = {
  generateStudentExcelWorkbook,
  formatDateShort,
  formatMonthYear,
};
