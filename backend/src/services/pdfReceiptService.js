/**
 * PDF Receipt & Statement Service — School Management System
 *
 * Generates official, high-contrast, black-and-white printer-friendly PDF documents:
 * 1. Single Payment Receipts (Admission & Fee Collection)
 * 2. Student Monthly Fee Ledgers & Comprehensive Statements
 * 3. Outstanding Dues Notices & Formal Statements
 *
 * Fully calibrated for monochrome laser & thermal A4 printing with zero gray smudges or unreadable pastel colors.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

/**
 * Ensure receipts storage directory exists
 */
function ensureReceiptsDir() {
  const dir = path.join(__dirname, '../../uploads/receipts');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get next sequential receipt number: REC-YYYY-XXXXXX
 */
async function getNextReceiptNumber(year) {
  const currentYear = year || new Date().getFullYear();
  const prefix = `REC-${currentYear}-`;

  const result = await db.queryOne(
    `SELECT \`receipt_number\` FROM \`receipts\`
     WHERE \`receipt_number\` LIKE ?
     ORDER BY \`id\` DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (result && result.receipt_number) {
    const match = result.receipt_number.match(/REC-\d{4}-(\d{6})/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(6, '0')}`;
}

/**
 * Get dynamic school settings
 */
async function getSchoolSettings() {
  const settings = await db.queryOne(
    `SELECT \`school_name\`, \`address\`, \`phone\`, \`email\`, \`logo_path\`, \`currency_symbol\`, \`academic_year\`
     FROM \`school_settings\`
     WHERE \`id\` = 1`
  );

  return settings || {
    school_name: 'Aryavart (P.S.G) Shikshan Sansthan',
    address: 'Shastri Nagar, Ward no-07, Bara chakia, East Champaran, Bihar',
    phone: '+91-6201844773',
    email: 'Aryavartshikshansansthan@gmail.com',
    academic_year: '2025-2026',
    currency_symbol: 'Rs.',
  };
}

/**
 * Format currency cleanly in standard Indian numbering without unicode font corruption
 */
function formatCurrency(amount) {
  const num = Number(amount || 0);
  return `Rs. ${num.toLocaleString('en-IN')}`;
}

/**
 * Month names lookup
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatMonth(monthNum) {
  return MONTH_NAMES[monthNum - 1] || `Month ${monthNum}`;
}

/**
 * Get payment details with student info
 */
async function getPaymentDetailsForReceipt(paymentId) {
  return await db.queryOne(
    `SELECT p.*, s.\`full_name\`, s.\`admission_no\`, s.\`class_id\`, s.\`section_id\`, s.\`category\`,
            COALESCE(NULLIF(s.\`father_name\`, ''), NULLIF(s.\`parent_name\`, ''), (SELECT NULLIF(s2.\`father_name\`, '') FROM \`students\` s2 WHERE s2.\`family_id\` = s.\`family_id\` AND s2.\`father_name\` IS NOT NULL LIMIT 1), '—') as father_name,
            COALESCE(NULLIF(s.\`mother_name\`, ''), (SELECT NULLIF(s2.\`mother_name\`, '') FROM \`students\` s2 WHERE s2.\`family_id\` = s.\`family_id\` AND s2.\`mother_name\` IS NOT NULL LIMIT 1), '') as mother_name,
            COALESCE(NULLIF(s.\`phone\`, ''), NULLIF(s.\`whatsapp_number\`, ''), (SELECT NULLIF(s2.\`phone\`, '') FROM \`students\` s2 WHERE s2.\`family_id\` = s.\`family_id\` AND s2.\`phone\` IS NOT NULL LIMIT 1), '—') as phone,
            COALESCE(NULLIF(s.\`whatsapp_number\`, ''), NULLIF(s.\`phone\`, ''), '—') as whatsapp_number,
            COALESCE(NULLIF(s.\`address\`, ''), '—') as address,
            c.\`name\` as class_name, sec.\`name\` as section_name,
            r.\`receipt_number\`
     FROM \`payments\` p
     LEFT JOIN \`students\` s ON s.\`id\` = p.\`student_id\`
     LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
     LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
     LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
     WHERE p.\`id\` = ? OR r.\`id\` = ? OR r.\`receipt_number\` = ? OR p.\`receipt_number\` = ?`,
    [paymentId, paymentId, paymentId, paymentId]
  );
}

/**
 * Get payment allocations
 */
async function getPaymentAllocations(paymentId) {
  const rows = await db.query(
    `SELECT pa.\`id\` as allocation_id, pa.\`allocated_amount\`, pa.\`monthly_fee_id\`, pa.\`additional_fee_id\`,
            mf.\`fee_month\`, mf.\`fee_year\`, mf.\`fee_amount\`, mf.\`paid_amount\` as monthly_paid, mf.\`due_amount\` as monthly_due, mf.\`status\` as monthly_status,
            COALESCE(NULLIF(saf.\`description\`, ''), ft.\`name\`) as additional_description,
            saf.\`amount\` as additional_amount, saf.\`paid_amount\` as additional_paid, saf.\`due_date\`,
            ft.\`name\` as fee_type_name
     FROM \`payment_allocations\` pa
     LEFT JOIN \`monthly_fees\` mf ON mf.\`id\` = pa.\`monthly_fee_id\`
     LEFT JOIN \`student_additional_fees\` saf ON saf.\`id\` = pa.\`additional_fee_id\`
     LEFT JOIN \`fee_types\` ft ON ft.\`id\` = saf.\`fee_type_id\`
     WHERE pa.\`payment_id\` = ?
     ORDER BY pa.\`id\` ASC`,
    [paymentId]
  );

  if (rows && rows.length > 0) {
    return rows.map((r) => {
      let description = '';
      let period = '—';
      let feeAmount = Number(r.allocated_amount);
      let isAdditional = Boolean(r.additional_fee_id || r.additional_description);

      if (r.additional_description && r.additional_description.trim() && r.additional_description !== 'Fee Payment') {
        description = r.additional_description.trim();
        period = 'One-Time / Term';
        feeAmount = Number(r.additional_amount || r.allocated_amount);
        isAdditional = true;
      } else if (r.fee_type_name && r.fee_type_name.trim() && r.fee_type_name !== 'Fee Payment') {
        description = r.fee_type_name.trim();
        period = 'One-Time / Term';
        feeAmount = Number(r.additional_amount || r.allocated_amount);
        isAdditional = true;
      } else if (r.fee_month) {
        description = `${formatMonth(r.fee_month)} ${r.fee_year || ''} Monthly Tuition Fee`;
        period = `${formatMonth(r.fee_month)} ${r.fee_year || ''}`;
        feeAmount = Number(r.fee_amount || r.allocated_amount);
        isAdditional = false;
      } else {
        description = 'Admission & Academic Fee Payment';
        period = 'Payment';
      }

      return {
        ...r,
        description,
        period,
        fee_amount: feeAmount,
        allocated_amount: Number(r.allocated_amount),
        is_additional: isAdditional,
      };
    });
  }

  // Fallback if no explicit allocations
  const payment = await db.queryOne(
    'SELECT `student_id`, `amount`, `payment_category`, `notes` FROM `payments` WHERE `id` = ?',
    [paymentId]
  );

  if (payment && payment.student_id) {
    const studentSafs = await db.query(
      `SELECT saf.\`id\`, saf.\`description\` as additional_description, saf.\`amount\` as additional_amount, saf.\`paid_amount\`, ft.\`name\` as fee_type_name
       FROM \`student_additional_fees\` saf
       LEFT JOIN \`fee_types\` ft ON ft.\`id\` = saf.\`fee_type_id\`
       WHERE saf.\`student_id\` = ?
       ORDER BY saf.\`id\` ASC`,
      [payment.student_id]
    );

    if (studentSafs && studentSafs.length > 0) {
      return studentSafs.map((saf, idx) => ({
        allocation_id: idx + 1,
        allocated_amount: Number(saf.paid_amount || saf.additional_amount || 0),
        fee_amount: Number(saf.additional_amount || 0),
        description: saf.additional_description || saf.fee_type_name || 'Admission / Custom Charge',
        period: 'One-Time / Term',
        is_additional: true,
      }));
    }
  }

  return [];
}

async function getStudentOutstanding(studentId) {
  const result = await db.queryOne(
    `SELECT COALESCE(SUM(\`due_amount\`), 0) as total
     FROM \`monthly_fees\`
     WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
    [studentId]
  );
  return Number(result?.total || 0);
}

async function getStudentAdditionalOutstanding(studentId) {
  const result = await db.queryOne(
    `SELECT COALESCE(SUM(\`amount\`), 0) as total
     FROM \`student_additional_fees\`
     WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
    [studentId]
  );
  return Number(result?.total || 0);
}

// ============================================================================
// 1. GENERATE OFFICIAL STUDENT FEE LEDGER & ACCOUNT STATEMENT PDF (B&W Friendly)
// ============================================================================

/**
 * Generates an official, high-contrast monochrome A4 PDF matching the B&W printer layout.
 */
async function generateStudentLedgerPDF(studentId) {
  const student = await db.queryOne(
    `SELECT s.*, c.\`name\` as class_name, sec.\`name\` as section_name
     FROM \`students\` s
     LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\`
     LEFT JOIN \`sections\` sec ON sec.\`id\` = s.\`section_id\`
     WHERE s.\`id\` = ?`,
    [studentId]
  );

  if (!student) {
    throw new Error('Student not found for statement generation.');
  }

  const school = await getSchoolSettings();

  const monthlyFees = await db.query(
    `SELECT * FROM \`monthly_fees\`
     WHERE \`student_id\` = ?
     ORDER BY \`fee_year\` ASC, \`fee_month\` ASC`,
    [studentId]
  );

  const additionalFees = await db.query(
    `SELECT saf.*, ft.\`name\` as fee_type_name
     FROM \`student_additional_fees\` saf
     LEFT JOIN \`fee_types\` ft ON ft.\`id\` = saf.\`fee_type_id\`
     WHERE saf.\`student_id\` = ?
     ORDER BY saf.\`created_at\` ASC`,
    [studentId]
  );

  // Distinct payments query to prevent payment triplication
  const payments = await db.query(
    `SELECT p.*, r.\`receipt_number\`
     FROM \`payments\` p
     LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
     WHERE p.\`student_id\` = ?
     ORDER BY p.\`payment_date\` DESC, p.\`id\` DESC`,
    [studentId]
  );

  const totalAssessed =
    monthlyFees.reduce((s, m) => s + Number(m.fee_amount || 0), 0) +
    additionalFees.reduce((s, a) => s + Number(a.amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const outstandingBalance = Math.max(0, totalAssessed - totalPaid);

  const receiptsDir = ensureReceiptsDir();
  const filename = `Fee_Ledger_Statement_${student.admission_no || studentId}_${Date.now()}.pdf`;
  const filePath = path.join(receiptsDir, filename);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    info: {
      Title: `Fee Statement - ${student.full_name}`,
      Author: school.school_name,
      Subject: 'Official Student Financial Ledger & Account Statement',
    },
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const pageWidth = 595.28;
  const contentWidth = pageWidth - 72; // 523.28 pt
  const startX = 36;
  let y = 36;

  // 1. Top Solid Charcoal Rule
  doc.rect(startX, y, contentWidth, 3).fill('#1f2937');
  y += 9;

  // 2. School Letterhead Header
  doc.roundedRect(startX, y, 42, 42, 4).fillAndStroke('#f3f4f6', '#1f2937');
  doc.fillColor('#111827').fontSize(19).font('Helvetica-Bold').text('A', startX + 14, y + 10);

  // School Name & Details (Pure Black / Charcoal for High Contrast)
  doc.fillColor('#111827').fontSize(16).font('Helvetica-Bold').text(school.school_name, startX + 50, y);
  doc.fillColor('#4b5563').fontSize(8.5).font('Helvetica-Bold').text('Official Student Financial Ledger & Account Statement', startX + 50, y + 18);
  
  const addressLine = `${school.address || 'Main Campus'}  |  Ph: ${school.phone || '+91-6201844773'}  |  Session ${school.academic_year || '2025-2026'}`;
  doc.fillColor('#374151').fontSize(7.5).font('Helvetica').text(addressLine, startX + 50, y + 30);

  y += 48;

  // Divider
  doc.moveTo(startX, y).lineTo(startX + contentWidth, y).strokeColor('#1f2937').lineWidth(1.5).stroke();
  y += 8;

  // 3. Statement Header Strip (High Contrast Monochrome Banner)
  doc.roundedRect(startX, y, contentWidth, 34, 4).fillAndStroke('#f3f4f6', '#1f2937');
  doc.fillColor('#111827').fontSize(9.5).font('Helvetica-Bold').text(
    'STUDENT MONTHLY FEE LEDGER & PAYMENT STATEMENT',
    startX,
    y + 5,
    { align: 'center', width: contentWidth }
  );

  const statementDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const metaText = `Date: ${statementDate}       |       Adm No: ${student.admission_no || 'N/A'}       |       Class: ${student.class_name || 'N/A'}${student.section_name ? ` (${student.section_name})` : ''}`;
  doc.fillColor('#374151').fontSize(8).font('Helvetica').text(metaText, startX, y + 19, { align: 'center', width: contentWidth });

  y += 42;

  // 4. Student Details Box (High Contrast 2-Column Container)
  doc.roundedRect(startX, y, contentWidth, 54, 4).fillAndStroke('#f9fafb', '#374151');
  
  const fatherName = student.father_name || student.parent_name || '—';
  const categoryStr = student.category === 'hosteller' ? 'Hostel Resident' : 'Day Scholar';
  const phoneStr = student.whatsapp_number || student.phone || student.father_phone || '—';

  // Left Column
  doc.fillColor('#4b5563').fontSize(8).font('Helvetica-Bold').text('Student Full Name:', startX + 12, y + 10);
  doc.fillColor('#111827').font('Helvetica-Bold').text(student.full_name || '—', startX + 105, y + 10);

  doc.fillColor('#4b5563').font('Helvetica-Bold').text("Father's Name:", startX + 12, y + 30);
  doc.fillColor('#111827').font('Helvetica-Bold').text(fatherName, startX + 105, y + 30);

  // Right Column
  doc.fillColor('#4b5563').font('Helvetica-Bold').text('Student Category:', startX + 280, y + 10);
  doc.fillColor('#111827').font('Helvetica').text(categoryStr, startX + 370, y + 10);

  doc.fillColor('#4b5563').font('Helvetica-Bold').text('Contact Phone:', startX + 280, y + 30);
  doc.fillColor('#111827').font('Helvetica-Bold').text(phoneStr, startX + 370, y + 30);

  y += 62;

  // 5. Financial Summary KPI Cards (3 Crisp White Cards with Solid Dark Border)
  const cardW = (contentWidth - 16) / 3;

  // Card 1: Total Assessed
  doc.roundedRect(startX, y, cardW, 36, 4).fillAndStroke('#ffffff', '#1f2937');
  doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica-Bold').text('TOTAL ASSESSED', startX, y + 6, { align: 'center', width: cardW });
  doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text(formatCurrency(totalAssessed), startX, y + 18, { align: 'center', width: cardW });

  // Card 2: Total Paid
  doc.roundedRect(startX + cardW + 8, y, cardW, 36, 4).fillAndStroke('#ffffff', '#1f2937');
  doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica-Bold').text('TOTAL PAID', startX + cardW + 8, y + 6, { align: 'center', width: cardW });
  doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text(formatCurrency(totalPaid), startX + cardW + 8, y + 18, { align: 'center', width: cardW });

  // Card 3: Outstanding Balance
  doc.roundedRect(startX + (cardW + 8) * 2, y, cardW, 36, 4).fillAndStroke('#ffffff', '#1f2937');
  doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica-Bold').text('OUTSTANDING BALANCE', startX + (cardW + 8) * 2, y + 6, { align: 'center', width: cardW });
  doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text(formatCurrency(outstandingBalance), startX + (cardW + 8) * 2, y + 18, { align: 'center', width: cardW });

  y += 46;

  // 6. Section Table 1: Month-by-Month Fee Schedule
  doc.fillColor('#111827').fontSize(8.5).font('Helvetica-Bold').text('MONTH-BY-MONTH FEE SCHEDULE', startX, y);
  y += 12;

  // Table Header (Solid Charcoal Background for Razor Sharp Contrast)
  doc.rect(startX, y, contentWidth, 18).fill('#1f2937');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('Month / Fee Period', startX + 8, y + 5);
  doc.text('Assessed Fee', startX + 190, y + 5, { align: 'right', width: 75 });
  doc.text('Paid Amount', startX + 280, y + 5, { align: 'right', width: 75 });
  doc.text('Due Balance', startX + 370, y + 5, { align: 'right', width: 75 });
  doc.text('Status', startX + 465, y + 5, { align: 'center', width: 50 });

  y += 18;

  if (monthlyFees.length === 0) {
    doc.rect(startX, y, contentWidth, 18).fillAndStroke('#ffffff', '#d1d5db');
    doc.fillColor('#6b7280').fontSize(7.5).font('Helvetica').text('No monthly fee schedules generated yet for this student.', startX + 8, y + 5);
    y += 18;
  } else {
    monthlyFees.forEach((m, idx) => {
      if (y > 720) {
        doc.addPage();
        y = 36;
      }
      const due = Number(m.fee_amount || 0);
      const paid = Number(m.paid_amount || 0);
      const bal = Math.max(0, due - paid);
      const isPaid = bal === 0 && due > 0;
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

      doc.rect(startX, y, contentWidth, 16).fillAndStroke(rowBg, '#e5e7eb');
      doc.fillColor('#111827').fontSize(7.5).font('Helvetica');
      doc.text(`${formatMonth(m.fee_month)} ${m.fee_year}`, startX + 8, y + 4);
      doc.text(formatCurrency(due), startX + 190, y + 4, { align: 'right', width: 75 });
      doc.font('Helvetica-Bold').text(formatCurrency(paid), startX + 280, y + 4, { align: 'right', width: 75 });
      doc.text(formatCurrency(bal), startX + 370, y + 4, { align: 'right', width: 75 });

      // Monochrome Status Pill (Sharp borders)
      if (isPaid) {
        doc.roundedRect(startX + 472, y + 2, 36, 12, 2).fillAndStroke('#111827', '#111827');
        doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold').text('PAID', startX + 472, y + 4, { align: 'center', width: 36 });
      } else if (bal > 0) {
        doc.roundedRect(startX + 472, y + 2, 36, 12, 2).fillAndStroke('#ffffff', '#111827');
        doc.fillColor('#111827').fontSize(6.5).font('Helvetica-Bold').text('DUE', startX + 472, y + 4, { align: 'center', width: 36 });
      } else {
        doc.roundedRect(startX + 472, y + 2, 36, 12, 2).fillAndStroke('#f3f4f6', '#9ca3af');
        doc.fillColor('#4b5563').fontSize(6.5).font('Helvetica-Bold').text('—', startX + 472, y + 4, { align: 'center', width: 36 });
      }

      y += 16;
    });
  }

  y += 12;

  // 7. Section Table 2: Validated Payment Receipts Log
  if (payments.length > 0) {
    if (y > 670) {
      doc.addPage();
      y = 36;
    }

    doc.fillColor('#111827').fontSize(8.5).font('Helvetica-Bold').text(`VALIDATED PAYMENT RECEIPTS LOG (${payments.length})`, startX, y);
    y += 12;

    doc.rect(startX, y, contentWidth, 18).fill('#1f2937');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    doc.text('Receipt No', startX + 8, y + 5);
    doc.text('Payment Date', startX + 150, y + 5);
    doc.text('Channel', startX + 270, y + 5);
    doc.text('Amount Paid', startX + 420, y + 5, { align: 'right', width: 95 });

    y += 18;

    payments.slice(0, 8).forEach((p, idx) => {
      if (y > 730) {
        doc.addPage();
        y = 36;
      }
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      const rNum = p.receipt_number || `ADM-${p.id}`;
      const pDate = p.payment_date
        ? new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
      const channel = p.payment_mode === 'IN_ACCOUNT' ? 'In Account (Bank/UPI)' : 'Cash Handover';

      doc.rect(startX, y, contentWidth, 16).fillAndStroke(rowBg, '#e5e7eb');
      doc.fillColor('#111827').fontSize(7.5).font('Helvetica-Bold').text(rNum, startX + 8, y + 4);
      doc.fillColor('#374151').font('Helvetica').text(pDate, startX + 150, y + 4);
      doc.text(channel, startX + 270, y + 4);
      doc.fillColor('#111827').font('Helvetica-Bold').text(formatCurrency(p.amount), startX + 420, y + 4, { align: 'right', width: 95 });

      y += 16;
    });
  }

  // 8. Official Verification Footer & Seal (Monochrome)
  if (y > 730) {
    doc.addPage();
    y = 36;
  } else {
    y = Math.max(y + 16, 740);
  }

  doc.roundedRect(startX, y, contentWidth, 42, 4).fillAndStroke('#f9fafb', '#1f2937');
  
  doc.fillColor('#4b5563').fontSize(7).font('Helvetica').text(
    `Official computer-generated statement issued by ${school.school_name} Accounts Dept.`,
    startX + 12,
    y + 16
  );

  doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold').text(
    'ARYAVART ACCOUNTS SEAL  [VERIFIED]',
    startX + 320,
    y + 10,
    { align: 'right', width: 190 }
  );
  doc.fillColor('#374151').fontSize(7).font('Helvetica-Bold').text(
    'Accounts Officer Signature',
    startX + 320,
    y + 24,
    { align: 'right', width: 190 }
  );

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

// ============================================================================
// 2. GENERATE OFFICIAL SINGLE PAYMENT / ADMISSION RECEIPT PDF (B&W Friendly)
// ============================================================================

/**
 * Generates an official payment receipt A4 PDF with exact high-contrast monochrome design.
 */
async function generateReceiptPDF(paymentId) {
  const [payment, school, rawAllocations] = await Promise.all([
    getPaymentDetailsForReceipt(paymentId),
    getSchoolSettings(),
    getPaymentAllocations(paymentId),
  ]);

  if (!payment) {
    throw new Error('Payment not found for receipt generation.');
  }

  let allocations = rawAllocations;
  if (!allocations || allocations.length === 0) {
    const fallbackDesc = payment.payment_category === 'ADMISSION_CHARGE'
      ? 'Admission & Enrollment Charges'
      : (payment.notes ? payment.notes.replace(/^\[.*?\]\s*/, '') : 'School Fee Collection');
    allocations = [{
      description: fallbackDesc,
      period: 'Payment',
      fee_amount: Number(payment.amount),
      allocated_amount: Number(payment.amount),
    }];
  }

  const studentOutstanding = await getStudentOutstanding(payment.student_id);
  const additionalOutstanding = await getStudentAdditionalOutstanding(payment.student_id);
  const totalOutstanding = studentOutstanding + additionalOutstanding;

  let receiptNumber = payment.receipt_number;
  if (!receiptNumber) {
    receiptNumber = await getNextReceiptNumber(new Date(payment.payment_date).getFullYear());
    await db.query(
      `UPDATE \`receipts\` SET \`receipt_number\` = ? WHERE \`payment_id\` = ?`,
      [receiptNumber, paymentId]
    );
  }

  const receiptsDir = ensureReceiptsDir();
  const fileName = `receipt_${receiptNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const filePath = path.join(receiptsDir, fileName);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    info: {
      Title: `Receipt - ${receiptNumber}`,
      Author: school.school_name,
      Subject: `Official Fee Receipt for ${payment.full_name}`,
    },
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const pageWidth = 595.28;
  const contentWidth = pageWidth - 72; // 523.28 pt
  const startX = 36;
  let y = 36;

  // 1. Top Solid Charcoal Rule
  doc.rect(startX, y, contentWidth, 3).fill('#1f2937');
  y += 9;

  // 2. School Letterhead Header
  doc.roundedRect(startX, y, 42, 42, 4).fillAndStroke('#f3f4f6', '#1f2937');
  doc.fillColor('#111827').fontSize(19).font('Helvetica-Bold').text('A', startX + 14, y + 10);

  doc.fillColor('#111827').fontSize(16).font('Helvetica-Bold').text(school.school_name, startX + 50, y);
  doc.fillColor('#4b5563').fontSize(8.5).font('Helvetica-Bold').text('Official Student Fee Payment & Receipt Record', startX + 50, y + 18);
  
  const addressLine = `${school.address || 'Main Campus'}  |  Ph: ${school.phone || '+91-6201844773'}  |  Session ${school.academic_year || '2025-2026'}`;
  doc.fillColor('#374151').fontSize(7.5).font('Helvetica').text(addressLine, startX + 50, y + 30);

  y += 48;

  // Divider
  doc.moveTo(startX, y).lineTo(startX + contentWidth, y).strokeColor('#1f2937').lineWidth(1.5).stroke();
  y += 8;

  // 3. Receipt Banner Title & Number Strip
  const isAdmission = payment.payment_category === 'ADMISSION_CHARGE';
  const receiptTitle = isAdmission
    ? 'OFFICIAL ADMISSION & ENROLLMENT RECEIPT'
    : 'OFFICIAL STUDENT FEE PAYMENT RECEIPT';

  doc.roundedRect(startX, y, contentWidth, 34, 4).fillAndStroke('#f3f4f6', '#1f2937');
  doc.fillColor('#111827').fontSize(9.5).font('Helvetica-Bold').text(
    receiptTitle,
    startX,
    y + 5,
    { align: 'center', width: contentWidth }
  );

  const paymentDate = new Date(payment.payment_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const metaText = `Receipt No: ${receiptNumber}       |       Payment Date: ${paymentDate}       |       Channel: ${payment.payment_mode === 'IN_ACCOUNT' ? 'In Account (Bank)' : 'Cash Handover'}`;
  doc.fillColor('#374151').fontSize(8).font('Helvetica').text(metaText, startX, y + 19, { align: 'center', width: contentWidth });

  y += 42;

  // 4. Student & Parent Information Box
  doc.roundedRect(startX, y, contentWidth, 54, 4).fillAndStroke('#f9fafb', '#374151');

  const fatherName = payment.father_name || payment.parent_name || '—';
  const categoryStr = payment.category === 'hosteller' ? 'Hostel Resident' : 'Day Scholar';
  const phoneStr = payment.phone || payment.whatsapp_number || '—';

  // Left Column
  doc.fillColor('#4b5563').fontSize(8).font('Helvetica-Bold').text('Student Full Name:', startX + 12, y + 10);
  doc.fillColor('#111827').font('Helvetica-Bold').text(payment.full_name || '—', startX + 105, y + 10);

  doc.fillColor('#4b5563').font('Helvetica-Bold').text("Father's Name:", startX + 12, y + 30);
  doc.fillColor('#111827').font('Helvetica-Bold').text(fatherName, startX + 105, y + 30);

  // Right Column
  doc.fillColor('#4b5563').font('Helvetica-Bold').text('Admission No:', startX + 280, y + 10);
  doc.fillColor('#111827').font('Helvetica-Bold').text(payment.admission_no || '—', startX + 360, y + 10);

  doc.fillColor('#4b5563').font('Helvetica-Bold').text('Class & Section:', startX + 280, y + 30);
  doc.fillColor('#111827').font('Helvetica').text(`${payment.class_name || '—'}${payment.section_name ? ` (${payment.section_name})` : ''}`, startX + 360, y + 30);

  y += 62;

  // 5. Itemized Fee Breakdown Table
  doc.fillColor('#111827').fontSize(8.5).font('Helvetica-Bold').text('ITEMIZED FEE BREAKDOWN & ALLOCATIONS', startX, y);
  y += 12;

  // Table Header (Solid Charcoal)
  doc.rect(startX, y, contentWidth, 18).fill('#1f2937');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('#', startX + 8, y + 5);
  doc.text('Fee Description / Head', startX + 30, y + 5);
  doc.text('Total Fee', startX + 280, y + 5, { align: 'right', width: 75 });
  doc.text('Amount Paid', startX + 365, y + 5, { align: 'right', width: 75 });
  doc.text('Status', startX + 455, y + 5, { align: 'center', width: 60 });

  y += 18;

  let totalAllocated = 0;

  allocations.forEach((item, idx) => {
    const feeAmt = Number(item.fee_amount || item.allocated_amount);
    const allocAmt = Number(item.allocated_amount);
    totalAllocated += allocAmt;
    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

    doc.rect(startX, y, contentWidth, 18).fillAndStroke(rowBg, '#e5e7eb');
    doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica').text(`${idx + 1}`, startX + 8, y + 5);
    doc.fillColor('#111827').font('Helvetica-Bold').text(item.description || 'Fee Payment', startX + 30, y + 5);
    doc.fillColor('#111827').font('Helvetica').text(formatCurrency(feeAmt), startX + 280, y + 5, { align: 'right', width: 75 });
    doc.fillColor('#111827').font('Helvetica-Bold').text(formatCurrency(allocAmt), startX + 365, y + 5, { align: 'right', width: 75 });

    // Monochrome PAID Badge
    doc.roundedRect(startX + 468, y + 3, 34, 12, 2).fillAndStroke('#111827', '#111827');
    doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold').text('PAID', startX + 468, y + 5, { align: 'center', width: 34 });

    y += 18;
  });

  y += 12;

  // 6. Payment Summary Box (Clean High-Contrast 2-Column Card)
  doc.roundedRect(startX, y, contentWidth, 68, 4).fillAndStroke('#f9fafb', '#1f2937');

  // Left Details (Payment mode & notes)
  const modeText = payment.payment_mode === 'IN_ACCOUNT' ? 'Bank / Online Transfer (In Account)' : 'Cash Handover at Counter';
  doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica-Bold').text('Payment Channel:', startX + 12, y + 10);
  doc.fillColor('#111827').font('Helvetica-Bold').text(modeText, startX + 95, y + 10);

  doc.fillColor('#4b5563').font('Helvetica-Bold').text('Transaction Ref:', startX + 12, y + 26);
  doc.fillColor('#111827').font('Helvetica').text(payment.reference_number || 'Verified Financial Record', startX + 95, y + 26);

  doc.fillColor('#4b5563').font('Helvetica-Bold').text('Remarks:', startX + 12, y + 42);
  doc.fillColor('#111827').font('Helvetica').text(payment.notes ? payment.notes.replace(/^\[.*?\]\s*/, '') : 'Valid Financial Collection', startX + 95, y + 42);

  doc.fillColor('#4b5563').fontSize(6.8).font('Helvetica').text(
    '✓ Computer Generated Valid Financial Receipt. Keep safe for future reference.',
    startX + 12,
    y + 56
  );

  // Right Totals & Balances
  doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica-Bold').text('Grand Total Paid:', startX + 320, y + 10);
  doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text(formatCurrency(payment.amount), startX + 410, y + 8, { align: 'right', width: 105 });

  doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica-Bold').text('Remaining Dues:', startX + 320, y + 26);
  doc.fillColor('#111827').fontSize(8.5).font('Helvetica-Bold').text(formatCurrency(totalOutstanding), startX + 410, y + 26, { align: 'right', width: 105 });

  doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica-Bold').text('Account Status:', startX + 320, y + 42);
  doc.fillColor('#111827').font('Helvetica-Bold').text(
    totalOutstanding > 0 ? 'PARTIAL BALANCE DUE' : 'ALL DUES CLEARED',
    startX + 400,
    y + 42,
    { align: 'right', width: 115 }
  );

  y += 82;

  // 7. Footer & Verification Stamp
  y = Math.max(y, 740);

  doc.roundedRect(startX, y, contentWidth, 42, 4).fillAndStroke('#f9fafb', '#1f2937');
  
  doc.fillColor('#4b5563').fontSize(7).font('Helvetica').text(
    `Official computer-generated receipt issued by ${school.school_name}. No physical signature required.`,
    startX + 12,
    y + 16
  );

  doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold').text(
    'ARYAVART ACCOUNTS SEAL  [VERIFIED]',
    startX + 320,
    y + 10,
    { align: 'right', width: 190 }
  );
  doc.fillColor('#374151').fontSize(7).font('Helvetica-Bold').text(
    'Authorized Signatory',
    startX + 320,
    y + 24,
    { align: 'right', width: 190 }
  );

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

// ============================================================================
// 3. GENERATE DUES NOTICE PDF (B&W Friendly)
// ============================================================================

async function generateDuesNoticePDF(studentId) {
  const school = await getSchoolSettings();

  const student = await db.queryOne(
    `SELECT s.*, c.name as class_name, sec.name as section_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_id
     LEFT JOIN sections sec ON sec.id = s.section_id
     WHERE s.id = ? AND s.status != 'deleted'`,
    [studentId]
  );

  if (!student) {
    throw new Error('Student not found for Dues Notice generation.');
  }

  const monthlyFees = await db.query(
    `SELECT * FROM monthly_fees
     WHERE student_id = ? AND status IN ('DUE', 'PARTIAL') AND due_amount > 0
     ORDER BY fee_year ASC, fee_month ASC`,
    [studentId]
  );

  const additionalFees = await db.query(
    `SELECT saf.*, ft.name as fee_type_name
     FROM student_additional_fees saf
     LEFT JOIN fee_types ft ON ft.id = saf.fee_type_id
     WHERE saf.student_id = ? AND saf.status IN ('DUE', 'PARTIAL') AND saf.amount > 0
     ORDER BY saf.created_at ASC`,
    [studentId]
  );

  const monthlyDueTotal = monthlyFees.reduce((sum, f) => sum + Number(f.due_amount), 0);
  const additionalDueTotal = additionalFees.reduce((sum, f) => sum + Number(f.amount), 0);
  const totalOutstanding = monthlyDueTotal + additionalDueTotal;

  const receiptsDir = ensureReceiptsDir();
  const fileName = `Dues_Notice_${student.admission_no || studentId}_${Date.now()}.pdf`;
  const filePath = path.join(receiptsDir, fileName);

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const pageWidth = 595.28;
  const contentWidth = pageWidth - 72;
  const startX = 36;
  let y = 36;

  // Header Banner
  doc.rect(startX, y, contentWidth, 3).fill('#1f2937');
  y += 9;

  doc.fillColor('#111827').fontSize(16).font('Helvetica-Bold').text(school.school_name, startX, y);
  doc.fillColor('#4b5563').fontSize(8.5).font('Helvetica').text(`${school.address} | Ph: ${school.phone}`, startX, y + 18);
  y += 35;

  // Notice Title
  doc.roundedRect(startX, y, contentWidth, 26, 4).fillAndStroke('#f3f4f6', '#1f2937');
  doc.fillColor('#111827').fontSize(9.5).font('Helvetica-Bold').text(
    'OFFICIAL NOTICE: STATEMENT OF OUTSTANDING DUES',
    startX,
    y + 7,
    { align: 'center', width: contentWidth }
  );
  y += 34;

  // Student Info Box
  doc.roundedRect(startX, y, contentWidth, 46, 4).fillAndStroke('#f9fafb', '#374151');
  doc.fillColor('#4b5563').fontSize(8).font('Helvetica-Bold').text('Student Name:', startX + 12, y + 8);
  doc.fillColor('#111827').font('Helvetica-Bold').text(student.full_name, startX + 85, y + 8);

  doc.fillColor('#4b5563').font('Helvetica-Bold').text("Father's Name:", startX + 12, y + 26);
  doc.fillColor('#111827').font('Helvetica-Bold').text(student.father_name || student.parent_name || '—', startX + 85, y + 26);

  doc.fillColor('#4b5563').font('Helvetica-Bold').text('Admission No:', startX + 280, y + 8);
  doc.fillColor('#111827').font('Helvetica-Bold').text(student.admission_no || '—', startX + 355, y + 8);

  doc.fillColor('#4b5563').font('Helvetica-Bold').text('Class:', startX + 280, y + 26);
  doc.fillColor('#111827').font('Helvetica').text(`${student.class_name || '—'} ${student.section_name ? `(${student.section_name})` : ''}`, startX + 355, y + 26);
  y += 54;

  // Dues Table
  doc.rect(startX, y, contentWidth, 18).fill('#1f2937');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('#', startX + 8, y + 5);
  doc.text('Fee Description', startX + 35, y + 5);
  doc.text('Period / Head', startX + 240, y + 5);
  doc.text('Status', startX + 360, y + 5);
  doc.text('Due Amount', startX + 430, y + 5, { align: 'right', width: 85 });
  y += 18;

  let idx = 1;
  for (const m of monthlyFees) {
    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
    doc.rect(startX, y, contentWidth, 16).fillAndStroke(rowBg, '#e5e7eb');
    doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica').text(`${idx++}`, startX + 8, y + 4);
    doc.fillColor('#111827').font('Helvetica-Bold').text('Monthly Tuition Fee', startX + 35, y + 4);
    doc.fillColor('#374151').font('Helvetica').text(`${formatMonth(m.fee_month)} ${m.fee_year}`, startX + 240, y + 4);
    doc.fillColor('#111827').font('Helvetica-Bold').text(m.status, startX + 360, y + 4);
    doc.fillColor('#111827').font('Helvetica-Bold').text(formatCurrency(m.due_amount), startX + 430, y + 4, { align: 'right', width: 85 });
    y += 16;
  }

  for (const a of additionalFees) {
    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
    doc.rect(startX, y, contentWidth, 16).fillAndStroke(rowBg, '#e5e7eb');
    doc.fillColor('#4b5563').fontSize(7.5).font('Helvetica').text(`${idx++}`, startX + 8, y + 4);
    doc.fillColor('#111827').font('Helvetica-Bold').text(a.fee_type_name || a.description || 'Custom Fee', startX + 35, y + 4);
    doc.fillColor('#374151').font('Helvetica').text('Additional Charge', startX + 240, y + 4);
    doc.fillColor('#111827').font('Helvetica-Bold').text(a.status, startX + 360, y + 4);
    doc.fillColor('#111827').font('Helvetica-Bold').text(formatCurrency(a.amount), startX + 430, y + 4, { align: 'right', width: 85 });
    y += 16;
  }

  y += 12;

  // Total Outstanding Banner
  doc.roundedRect(startX, y, contentWidth, 32, 4).fillAndStroke('#f3f4f6', '#1f2937');
  doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text('TOTAL OUTSTANDING BALANCE DUE:', startX + 15, y + 10);
  doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text(formatCurrency(totalOutstanding), startX + 400, y + 9, { align: 'right', width: 110 });

  y += 42;

  // Instructions & Footer
  doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold').text('Payment Instructions:', startX, y);
  doc.font('Helvetica').fontSize(7.5).fillColor('#4b5563');
  doc.text('1. Please clear outstanding dues at the school accounts counter to avoid administrative delays.', startX, y + 12);
  doc.text('2. Computer-generated official notice issued by Aryavart Accounts Department.', startX, y + 24);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

// Wrapper Helpers
async function generateAndSaveReceipt(paymentId) {
  const filePath = await generateReceiptPDF(paymentId);
  const relativePath = path.relative(path.join(__dirname, '../../'), filePath);
  const existingReceipt = await db.queryOne(`SELECT id FROM \`receipts\` WHERE \`payment_id\` = ?`, [paymentId]);

  if (existingReceipt) {
    await db.query(`UPDATE \`receipts\` SET \`file_path\` = ? WHERE \`payment_id\` = ?`, [relativePath, paymentId]);
  } else {
    const payment = await db.queryOne(`SELECT \`receipt_number\` FROM \`payments\` WHERE \`id\` = ?`, [paymentId]);
    const rNum = payment?.receipt_number || `REC-${String(paymentId).padStart(6, '0')}`;
    await db.query(`INSERT INTO \`receipts\` (\`payment_id\`, \`receipt_number\`, \`file_path\`) VALUES (?, ?, ?)`, [paymentId, rNum, relativePath]);
  }

  return { filePath, relativePath };
}

async function generateAndSaveDuesNotice(studentId) {
  const filePath = await generateDuesNoticePDF(studentId);
  const relativePath = path.relative(path.join(__dirname, '../../'), filePath);
  return { filePath, relativePath };
}

async function generateAndSaveStudentLedger(studentId) {
  const filePath = await generateStudentLedgerPDF(studentId);
  const relativePath = path.relative(path.join(__dirname, '../../'), filePath);
  return { filePath, relativePath };
}

module.exports = {
  generateReceiptPDF,
  generateAndSaveReceipt,
  generateDuesNoticePDF,
  generateAndSaveDuesNotice,
  generateStudentLedgerPDF,
  generateAndSaveStudentLedger,
  getNextReceiptNumber,
  getPaymentDetailsForReceipt,
  getPaymentAllocations,
};