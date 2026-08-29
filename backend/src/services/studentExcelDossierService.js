/**
 * Student Excel Dossier Service — School Management System
 *
 * Generates an ultra-clean, spacious, un-congested single-sheet student profile
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
 * Helper to apply styled borders to a cell range
 */
function applyRangeBorder(sheet, startRow, startCol, endRow, endCol, borderStyle, fillColor) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = sheet.getCell(r, c);
      if (borderStyle) cell.border = borderStyle;
      if (fillColor) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      }
    }
  }
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

  const safeSheetName = (student.full_name || 'Student Profile').slice(0, 30);
  const sheet = workbook.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // Generous column widths ensuring zero text truncation
  sheet.columns = [
    { key: 'colA', width: 16 }, // Month
    { key: 'colB', width: 15 }, // Prev Due
    { key: 'colC', width: 14 }, // Other Fee
    { key: 'colD', width: 15 }, // Tuition Fee
    { key: 'colE', width: 16 }, // Total Demand
    { key: 'colF', width: 16 }, // Amount Paid (Credit)
    { key: 'colG', width: 16 }, // Net Balance Due
    { key: 'colH', width: 16 }, // Payment Date
    { key: 'colI', width: 16 }, // Mode
  ];

  // Border helper styles
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const cardBorder = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } },
  };

  // ---------------------------------------------------------
  // 1. INSTITUTION TITLE HEADER
  // ---------------------------------------------------------
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = schoolName.toUpperCase();
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  sheet.getRow(1).height = 28;

  sheet.mergeCells('A2:I2');
  const subCell = sheet.getCell('A2');
  subCell.value = `STUDENT PROFILE & RUNNING FEE REGISTER  •  ${schoolAddress}`;
  subCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 18;

  sheet.addRow([]); // Blank spacer row 3
  sheet.getRow(3).height = 8;

  // ---------------------------------------------------------
  // 2. SPACIOUS 3-COLUMN PROFILE INFORMATION CARDS (Rows 4 to 6)
  // ---------------------------------------------------------
  // Row 4: Student Name | Admission No | Class & Section
  sheet.mergeCells('A4:C4');
  sheet.mergeCells('D4:F4');
  sheet.mergeCells('G4:I4');

  const cellA4 = sheet.getCell('A4');
  cellA4.value = {
    richText: [
      { font: { bold: true, color: { argb: 'FF334155' } }, text: 'Student Name: ' },
      { font: { bold: true, color: { argb: 'FF0F172A' } }, text: student.full_name || '—' }
    ]
  };
  cellA4.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const cellD4 = sheet.getCell('D4');
  cellD4.value = {
    richText: [
      { font: { bold: true, color: { argb: 'FF334155' } }, text: 'Admission No: ' },
      { font: { bold: true, color: { argb: 'FF0284C7' } }, text: student.admission_no || '—' }
    ]
  };
  cellD4.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const cellG4 = sheet.getCell('G4');
  cellG4.value = {
    richText: [
      { font: { bold: true, color: { argb: 'FF334155' } }, text: 'Class & Sec: ' },
      { font: { bold: true, color: { argb: 'FF0F172A' } }, text: `${student.class_name || '—'} ${student.section_name || ''}`.trim() }
    ]
  };
  cellG4.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  sheet.getRow(4).height = 22;
  applyRangeBorder(sheet, 4, 1, 4, 3, cardBorder, 'FFF8FAFC');
  applyRangeBorder(sheet, 4, 4, 4, 6, cardBorder, 'FFF8FAFC');
  applyRangeBorder(sheet, 4, 7, 4, 9, cardBorder, 'FFF8FAFC');

  // Row 5: Father's Name | Mother's Name | Category & Monthly Rate
  sheet.mergeCells('A5:C5');
  sheet.mergeCells('D5:F5');
  sheet.mergeCells('G5:I5');

  const cellA5 = sheet.getCell('A5');
  cellA5.value = {
    richText: [
      { font: { bold: true, color: { argb: 'FF334155' } }, text: "Father's Name: " },
      { font: { color: { argb: 'FF0F172A' } }, text: student.father_name || student.parent_name || '—' }
    ]
  };
  cellA5.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const cellD5 = sheet.getCell('D5');
  cellD5.value = {
    richText: [
      { font: { bold: true, color: { argb: 'FF334155' } }, text: "Mother's Name: " },
      { font: { color: { argb: 'FF0F172A' } }, text: student.mother_name || '—' }
    ]
  };
  cellD5.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const cellG5 = sheet.getCell('G5');
  cellG5.value = {
    richText: [
      { font: { bold: true, color: { argb: 'FF334155' } }, text: 'Category / Rate: ' },
      { font: { color: { argb: 'FF0F172A' } }, text: `${student.category === 'hosteller' ? 'Hosteller' : 'Day Scholar'} (₹${Number(student.monthly_fee_rate || 3000).toLocaleString('en-IN')}/mo)` }
    ]
  };
  cellG5.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  sheet.getRow(5).height = 22;
  applyRangeBorder(sheet, 5, 1, 5, 3, cardBorder, 'FFF8FAFC');
  applyRangeBorder(sheet, 5, 4, 5, 6, cardBorder, 'FFF8FAFC');
  applyRangeBorder(sheet, 5, 7, 5, 9, cardBorder, 'FFF8FAFC');

  // Row 6: Address | Phone Number | Family ID & Admission Date
  sheet.mergeCells('A6:C6');
  sheet.mergeCells('D6:F6');
  sheet.mergeCells('G6:I6');

  const cellA6 = sheet.getCell('A6');
  cellA6.value = {
    richText: [
      { font: { bold: true, color: { argb: 'FF334155' } }, text: 'Address: ' },
      { font: { color: { argb: 'FF0F172A' } }, text: student.address || '—' }
    ]
  };
  cellA6.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const cellD6 = sheet.getCell('D6');
  const phoneText = `${student.phone || '—'}${student.whatsapp_number && student.whatsapp_number !== student.phone ? ' (WA: ' + student.whatsapp_number + ')' : ''}`;
  cellD6.value = {
    richText: [
      { font: { bold: true, color: { argb: 'FF334155' } }, text: 'Phone Number: ' },
      { font: { color: { argb: 'FF0F172A' } }, text: phoneText }
    ]
  };
  cellD6.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const cellG6 = sheet.getCell('G6');
  const admDateStr = student.admission_date ? formatDateShort(student.admission_date) : '—';
  cellG6.value = {
    richText: [
      { font: { bold: true, color: { argb: 'FF334155' } }, text: 'Family / Adm Date: ' },
      { font: { color: { argb: 'FF0F172A' } }, text: `${student.family_id || '—'}  •  ${admDateStr}` }
    ]
  };
  cellG6.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  sheet.getRow(6).height = 22;
  applyRangeBorder(sheet, 6, 1, 6, 3, cardBorder, 'FFF8FAFC');
  applyRangeBorder(sheet, 6, 4, 6, 6, cardBorder, 'FFF8FAFC');
  applyRangeBorder(sheet, 6, 7, 6, 9, cardBorder, 'FFF8FAFC');

  sheet.addRow([]); // Blank spacer row 7
  sheet.getRow(7).height = 10;

  // ---------------------------------------------------------
  // 3. RUNNING BALANCE FEE LEDGER TABLE (Headers on Row 8)
  // ---------------------------------------------------------
  const headerRow = sheet.addRow([
    'Month',
    'Previous Due',
    'Other Fee',
    'Tuition Fee',
    'Total Demand',
    'Amount Paid',
    'Net Balance',
    'Payment Date',
    'Payment Mode'
  ]);

  headerRow.height = 25;
  headerRow.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= 9; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2E5A' } }; // Deep Navy Slate
    cell.border = thinBorder;
  }

  // ---------------------------------------------------------
  // 4. DATA ROWS (Row-by-Row Running Balance Arithmetic)
  // ---------------------------------------------------------
  let runningPrevDue = Number(student.opening_dues || 0);

  if (monthlyFees.length === 0) {
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
      '—',
      '—'
    ]);
    r.height = 22;
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
      // Format paid amount with negative sign (e.g. -5,000) matching accounting registers
      const paidDisplay = paid > 0 ? -paid : 0;
      const netBalance = Math.max(0, totalDemand - paid);

      const payDate = mf.actual_payment_date ? formatDateShort(mf.actual_payment_date) : '—';
      const payMode = mf.actual_payment_mode === 'IN_ACCOUNT'
        ? 'in acc.'
        : mf.actual_payment_mode === 'CASH'
        ? 'cash'
        : mf.actual_payment_mode || '—';

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

      r.height = 22;
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
  sheet.addRow([]);

  const curRowNumber = sheet.lastRow.number;
  sheet.mergeCells(`H${curRowNumber}:I${curRowNumber}`);
  const signCell = sheet.getCell(`H${curRowNumber}`);
  signCell.value = "Head's Signature";
  signCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  signCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(curRowNumber).height = 30;

  applyRangeBorder(sheet, curRowNumber, 8, curRowNumber, 9, cardBorder, 'FFF8FAFC');

  return workbook;
}

module.exports = {
  generateStudentExcelWorkbook,
  formatDateShort,
  formatMonthYear,
};
