/**
 * PDF Receipt Service — School Management System
 *
 * Day 8: Receipts & Messaging Foundation.
 *
 * Generates branded PDF receipts using PDFKit containing:
 * - School logo, name, address, phone, email
 * - Unique RECEIPT-YYYY-XXXXXX sequence
 * - Student information (name, admission no, class, section)
 * - Allocated-month breakdown with amounts
 * - Total paid, remaining due
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

/**
 * Ensure the receipts directory exists
 */
function ensureReceiptsDir() {
  const dir = path.join(__dirname, '../../uploads/receipts');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get the next receipt sequence number for a given year
 * Format: REC-YYYY-XXXXXX (6 digits, zero-padded)
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
 * Get school settings for receipt header
 */
async function getSchoolSettings() {
  return await db.queryOne(
    `SELECT \`school_name\`, \`address\`, \`phone\`, \`email\`, \`logo_path\`, \`currency_symbol\`
     FROM \`school_settings\`
     WHERE \`id\` = 1`
  );
}

/**
 * Get payment details with student info and allocations
 */
async function getPaymentDetailsForReceipt(paymentId) {
  return await db.queryOne(
    `SELECT p.*, s.\`full_name\`, s.\`admission_no\`, s.\`class_id\`, s.\`section_id\`, s.\`category\`,
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
 * Get payment allocations with month details
 */
async function getPaymentAllocations(paymentId) {
  return await db.query(
    `SELECT pa.\`allocated_amount\`, mf.\`fee_month\`, mf.\`fee_year\`, mf.\`fee_amount\`, mf.\`paid_amount\`, mf.\`due_amount\`, mf.\`status\`
     FROM \`payment_allocations\` pa
     LEFT JOIN \`monthly_fees\` mf ON mf.\`id\` = pa.\`monthly_fee_id\`
     WHERE pa.\`payment_id\` = ?
     ORDER BY mf.\`fee_year\` ASC, mf.\`fee_month\` ASC`,
    [paymentId]
  );
}

/**
 * Get total outstanding for student after this payment
 */
async function getStudentOutstanding(studentId) {
  const result = await db.queryOne(
    `SELECT COALESCE(SUM(\`due_amount\`), 0) as total
     FROM \`monthly_fees\`
     WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
    [studentId]
  );
  return Number(result?.total || 0);
}

/**
 * Get additional fees outstanding
 */
async function getStudentAdditionalOutstanding(studentId) {
  const result = await db.queryOne(
    `SELECT COALESCE(SUM(\`amount\`), 0) as total
     FROM \`student_additional_fees\`
     WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
    [studentId]
  );
  return Number(result?.total || 0);
}

/**
 * Format month number to name
 */
function formatMonth(monthNum) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthNum - 1] || String(monthNum);
}

/**
 * Format currency
 */
function formatCurrency(amount, symbol = '₹') {
  return `${symbol} ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generate receipt PDF
 * @param {number} paymentId - Payment ID
 * @returns {Promise<string>} - Path to generated PDF file
 */
async function generateReceiptPDF(paymentId) {
  // Fetch all required data
  const [payment, school, allocations] = await Promise.all([
    getPaymentDetailsForReceipt(paymentId),
    getSchoolSettings(),
    getPaymentAllocations(paymentId)
  ]);

  if (!payment) {
    throw new Error('Payment not found');
  }

  const studentOutstanding = await getStudentOutstanding(payment.student_id);
  const additionalOutstanding = await getStudentAdditionalOutstanding(payment.student_id);
  const totalOutstanding = studentOutstanding + additionalOutstanding;

  // Generate receipt number if not exists
  let receiptNumber = payment.receipt_number;
  if (!receiptNumber) {
    receiptNumber = await getNextReceiptNumber(new Date(payment.payment_date).getFullYear());
    // Update receipts table
    await db.query(
      `UPDATE \`receipts\` SET \`receipt_number\` = ? WHERE \`payment_id\` = ?`,
      [receiptNumber, paymentId]
    );
  }

  // Create PDF document
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Receipt ${receiptNumber}`,
      Author: school?.school_name || 'School Management System',
      Subject: `Fee Receipt for ${payment.full_name}`,
      Keywords: 'receipt, school, fees, payment',
    }
  });

  const receiptsDir = ensureReceiptsDir();
  const fileName = `receipt_${receiptNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const filePath = path.join(receiptsDir, fileName);

  // Pipe to file
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // ================================================================
  // HEADER - School Info
  // ================================================================
  let y = 50;

  // School logo (if available)
  if (school?.logo_path) {
    try {
      const logoPath = path.join(__dirname, '../../', school.logo_path);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, y, { width: 80 });
      }
    } catch (e) {
      // Logo not found, continue without it
    }
  }

  // School name
  doc.fontSize(22)
     .font('Helvetica-Bold')
     .fillColor('#1a1a2e')
     .text(school?.school_name || 'School Management System', 150, y);

  y += 30;

  // School address
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#4a4a6a')
     .text(school?.address || '', 150, y);

  y += 15;

  // School contact
  const contactParts = [];
  if (school?.phone) contactParts.push(`Phone: ${school.phone}`);
  if (school?.email) contactParts.push(`Email: ${school.email}`);
  doc.text(contactParts.join('  |  '), 150, y);

  // ================================================================
  // RECEIPT TITLE & NUMBER
  // ================================================================
  y += 35;

  // Divider line
  doc.moveTo(50, y)
     .lineTo(545, y)
     .strokeColor('#e0e0e0')
     .lineWidth(1)
     .stroke();

  y += 15;

  // "FEE RECEIPT" title
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor('#1a1a2e')
     .text('FEE RECEIPT', 50, y, { align: 'center' });

  y += 25;

  // Receipt number and date
  doc.fontSize(11)
     .font('Helvetica')
     .fillColor('#4a4a6a');

  const paymentDate = new Date(payment.payment_date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  doc.text(`Receipt No: ${receiptNumber}`, 50, y, { continued: true });
  doc.text(`Date: ${paymentDate}`, 545, y, { align: 'right' });

  y += 25;

  // ================================================================
  // STUDENT INFORMATION
  // ================================================================
  // Section header
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor('#1a1a2e')
     .text('Student Information', 50, y);

  y += 20;

  // Student details in a nice layout
  const studentInfo = [
    { label: 'Name', value: payment.full_name || '—' },
    { label: 'Admission No', value: payment.admission_no || '—' },
    { label: 'Class', value: payment.class_name ? `${payment.class_name}${payment.section_name ? '-' + payment.section_name : ''}` : '—' },
    { label: 'Category', value: payment.category === 'hosteller' ? 'Hosteller' : 'Day Scholar' },
  ];

  const colWidth = 220;
  studentInfo.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 50 + col * colWidth;
    const itemY = y + row * 22;

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#4a4a6a')
       .text(`${item.label}:`, x, itemY, { continued: true });

    doc.font('Helvetica')
       .fillColor('#1a1a2e')
       .text(` ${item.value}`, x + 80, itemY);
  });

  y += (Math.ceil(studentInfo.length / 2) * 22) + 15;

  // ================================================================
  // PAYMENT BREAKDOWN TABLE
  // ================================================================
  // Section header
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor('#1a1a2e')
     .text('Payment Allocation Breakdown', 50, y);

  y += 15;

  // Table header
  const tableCols = [
    { x: 50, width: 80, label: 'Month', align: 'left' },
    { x: 140, width: 70, label: 'Year', align: 'center' },
    { x: 220, width: 100, label: 'Fee Amount', align: 'right' },
    { x: 330, width: 100, label: 'Paid', align: 'right' },
    { x: 440, width: 100, label: 'Allocated', align: 'right' },
  ];

  // Draw header background
  doc.rect(50, y, 495, 22)
     .fillColor('#1a1a2e')
     .fill();

  doc.fillColor('#ffffff')
     .fontSize(10)
     .font('Helvetica-Bold');

  tableCols.forEach(col => {
    doc.text(col.label, col.x + 5, y + 5, {
      width: col.width - 10,
      align: col.align
    });
  });

  y += 22;

  // Table rows
  let totalAllocated = 0;
  let totalFeeAmount = 0;
  let totalPaidBefore = 0;

  doc.font('Helvetica')
     .fillColor('#1a1a2e')
     .fontSize(9);

  allocations.forEach((alloc, index) => {
    const rowY = y + index * 20;
    const isEven = index % 2 === 0;

    // Alternating row background
    if (isEven) {
      doc.rect(50, rowY, 495, 20)
         .fillColor('#f8f8fc')
         .fill();
    }

    const monthName = formatMonth(alloc.fee_month);
    const feeAmt = Number(alloc.fee_amount);
    const paidAmt = Number(alloc.paid_amount);
    const allocAmt = Number(alloc.allocated_amount);

    totalAllocated += allocAmt;
    totalFeeAmount += feeAmt;
    totalPaidBefore += paidAmt;

    const cells = [
      { x: tableCols[0].x, width: tableCols[0].width, text: `${monthName} ${alloc.fee_year}`, align: 'left' },
      { x: tableCols[1].x, width: tableCols[1].width, text: String(alloc.fee_year), align: 'center' },
      { x: tableCols[2].x, width: tableCols[2].width, text: formatCurrency(feeAmt, school?.currency_symbol || '₹'), align: 'right' },
      { x: tableCols[3].x, width: tableCols[3].width, text: formatCurrency(paidAmt, school?.currency_symbol || '₹'), align: 'right' },
      { x: tableCols[4].x, width: tableCols[4].width, text: formatCurrency(allocAmt, school?.currency_symbol || '₹'), align: 'right' },
    ];

    cells.forEach(cell => {
      doc.text(cell.text, cell.x + 5, rowY + 4, {
        width: cell.width - 10,
        align: cell.align
      });
    });
  });

  y += allocations.length * 20;

  // Table total row
  doc.rect(50, y, 495, 25)
     .fillColor('#1a1a2e')
     .fill();

  doc.fillColor('#ffffff')
     .fontSize(10)
     .font('Helvetica-Bold');

  doc.text('TOTAL', 55, y + 7, { width: tableCols[0].width + tableCols[1].width + tableCols[2].width - 10, align: 'right' });
  doc.text(formatCurrency(totalAllocated, school?.currency_symbol || '₹'), tableCols[4].x + 5, y + 7, {
    width: tableCols[4].width - 10,
    align: 'right'
  });

  y += 35;

  // ================================================================
  // SUMMARY SECTION
  // ================================================================
  const paymentAmount = Number(payment.amount);
  const currencySymbol = school?.currency_symbol || '₹';

  // Summary box
  doc.rect(50, y, 495, 85)
     .fillColor('#f8f8fc')
     .strokeColor('#e0e0e0')
     .lineWidth(0.5)
     .fillAndStroke();

  let summaryY = y + 15;

  // Payment mode
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#4a4a6a')
     .text('Payment Mode:', 60, summaryY, { continued: true });
  doc.font('Helvetica-Bold')
     .fillColor('#1a1a2e')
     .text(` ${payment.payment_mode || 'CASH'}`);

  summaryY += 20;

  // Amount paid
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#4a4a6a')
     .text('Amount Paid:', 60, summaryY, { continued: true });
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('#2e7d32')
     .text(` ${formatCurrency(paymentAmount, currencySymbol)}`);

  summaryY += 25;

  // Total outstanding after payment
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#4a4a6a')
     .text('Remaining Due:', 60, summaryY, { continued: true });
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor(totalOutstanding > 0 ? '#c62828' : '#2e7d32')
     .text(` ${formatCurrency(totalOutstanding, currencySymbol)}`);

  summaryY += 25;

  // Status
  const statusText = totalOutstanding > 0 ? 'PARTIAL PAYMENT' : 'FULLY PAID';
  const statusColor = totalOutstanding > 0 ? '#f57c00' : '#2e7d32';
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#4a4a6a')
     .text('Status:', 60, summaryY, { continued: true });
  doc.font('Helvetica-Bold')
     .fillColor(statusColor)
     .text(` ${statusText}`);

  y += 100;

  // ================================================================
  // FOOTER
  // ================================================================
  // Divider
  doc.moveTo(50, y)
     .lineTo(545, y)
     .strokeColor('#e0e0e0')
     .lineWidth(1)
     .stroke();

  y += 15;

  // Thank you note
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#4a4a6a')
     .text('Thank you for your payment!', 50, y, { align: 'center' });

  y += 20;

  // Terms / Note
  doc.fontSize(8)
     .fillColor('#888888')
     .text('This is a computer-generated receipt. No signature required.', 50, y, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`, 50, y + 12, { align: 'center' });

  // Finalize PDF
  doc.end();

  // Wait for stream to finish
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

/**
 * Generate receipt and update database with file path
 */
async function generateAndSaveReceipt(paymentId) {
  const filePath = await generateReceiptPDF(paymentId);

  // Update receipts table with file path
  const relativePath = path.relative(path.join(__dirname, '../../'), filePath);
  const existingReceipt = await db.queryOne(
    `SELECT id FROM \`receipts\` WHERE \`payment_id\` = ?`,
    [paymentId]
  );

  if (existingReceipt) {
    await db.query(
      `UPDATE \`receipts\` SET \`file_path\` = ? WHERE \`payment_id\` = ?`,
      [relativePath, paymentId]
    );
  } else {
    const payment = await db.queryOne(`SELECT \`receipt_number\` FROM \`payments\` WHERE \`id\` = ?`, [paymentId]);
    const rNum = payment?.receipt_number || `REC-${String(paymentId).padStart(6, '0')}`;
    await db.query(
      `INSERT INTO \`receipts\` (\`payment_id\`, \`receipt_number\`, \`file_path\`) VALUES (?, ?, ?)`,
      [paymentId, rNum, relativePath]
    );
  }

  return { filePath, relativePath };
}

/**
 * Generate a PDF Dues Statement / Dues Notice for a student
 * @param {number} studentId
 * @returns {Promise<string>} File path to generated PDF
 */
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

  // Fetch unpaid monthly fees
  const monthlyFees = await db.query(
    `SELECT * FROM monthly_fees
     WHERE student_id = ? AND status IN ('DUE', 'PARTIAL') AND due_amount > 0
     ORDER BY fee_year ASC, fee_month ASC`,
    [studentId]
  );

  // Fetch unpaid additional fees
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
  const fileName = `Dues_Notice_${student.admission_no}_${Date.now()}.pdf`;
  const filePath = path.join(receiptsDir, fileName);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  let y = 50;

  // Header Banner
  doc.rect(50, y, 495, 75).fill('#1e293b');

  doc.fillColor('#ffffff')
     .fontSize(18)
     .font('Helvetica-Bold')
     .text(school.school_name || 'School Management System', 65, y + 15);

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#cbd5e1')
     .text(`${school.address || ''} | Phone: ${school.phone || ''} | Email: ${school.email || ''}`, 65, y + 42);

  y += 90;

  // Notice Title
  doc.rect(50, y, 495, 28).fill('#fee2e2');
  doc.fillColor('#991b1b')
     .fontSize(12)
     .font('Helvetica-Bold')
     .text('STATEMENT OF OUTSTANDING DUES / DUES NOTICE', 65, y + 8);

  y += 40;

  // Student Info Grid
  doc.rect(50, y, 495, 65).stroke('#e2e8f0');

  doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
  doc.text('Student Name:', 65, y + 12);
  doc.text('Admission No:', 65, y + 30);
  doc.text('Class & Section:', 65, y + 48);

  doc.fillColor('#0f172a').font('Helvetica');
  doc.text(student.full_name, 150, y + 12);
  doc.text(student.admission_no, 150, y + 30);
  doc.text(`${student.class_name || ''} ${student.section_name ? `(${student.section_name})` : ''}`, 150, y + 48);

  doc.fillColor('#475569').font('Helvetica-Bold');
  doc.text('Category:', 320, y + 12);
  doc.text('Parent Name:', 320, y + 30);
  doc.text('Notice Date:', 320, y + 48);

  doc.fillColor('#0f172a').font('Helvetica');
  doc.text(student.category === 'hosteller' ? 'Hosteller' : 'Day Scholar', 400, y + 12);
  doc.text(student.parent_name || '—', 400, y + 30);
  doc.text(new Date().toLocaleDateString('en-IN'), 400, y + 48);

  y += 85;

  // Itemized Dues Table Header
  doc.rect(50, y, 495, 22).fill('#f1f5f9');
  doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
  doc.text('#', 60, y + 6);
  doc.text('Fee Description', 90, y + 6);
  doc.text('Period / Type', 280, y + 6);
  doc.text('Status', 400, y + 6);
  doc.text('Due Amount (₹)', 460, y + 6, { align: 'right', width: 75 });

  y += 22;

  let index = 1;

  // Monthly Dues Rows
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const m of monthlyFees) {
    doc.rect(50, y, 495, 20).stroke('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica');
    doc.text(`${index++}`, 60, y + 5);
    doc.text(`Monthly Tuition & Base Fee`, 90, y + 5);
    doc.text(`${monthNames[m.fee_month - 1]} ${m.fee_year}`, 280, y + 5);
    doc.fillColor('#dc2626').font('Helvetica-Bold').text(m.status, 400, y + 5);
    doc.fillColor('#0f172a').font('Helvetica').text(`₹${Number(m.due_amount).toLocaleString('en-IN')}`, 460, y + 5, { align: 'right', width: 75 });
    y += 20;
  }

  // Additional Dues Rows
  for (const a of additionalFees) {
    doc.rect(50, y, 495, 20).stroke('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica');
    doc.text(`${index++}`, 60, y + 5);
    doc.text(`${a.fee_type_name || a.description || 'Custom Fee'}`, 90, y + 5);
    doc.text('Additional Charge', 280, y + 5);
    doc.fillColor('#dc2626').font('Helvetica-Bold').text(a.status, 400, y + 5);
    doc.fillColor('#0f172a').font('Helvetica').text(`₹${Number(a.amount).toLocaleString('en-IN')}`, 460, y + 5, { align: 'right', width: 75 });
    y += 20;
  }

  y += 10;

  // Total Outstanding Banner
  doc.rect(50, y, 495, 30).fill('#0f172a');
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL OUTSTANDING BALANCE DUE:', 65, y + 9);
  doc.text(`₹${totalOutstanding.toLocaleString('en-IN')}`, 460, y + 9, { align: 'right', width: 75 });

  y += 45;

  // Payment Instructions
  doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
  doc.text('Payment Instructions:', 50, y);
  doc.font('Helvetica').fontSize(8.5).fillColor('#64748b');
  doc.text('1. Please deposit cash at the school accounts counter to receive an official stamped receipt.', 50, y + 15);
  doc.text('2. Please clear outstanding dues by the due date to avoid administrative delays.', 50, y + 28);
  doc.text('3. This statement reflects live ledger records recorded at the school office.', 50, y + 41);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

/**
 * Generate dues notice and return relative path
 */
async function generateAndSaveDuesNotice(studentId) {
  const filePath = await generateDuesNoticePDF(studentId);
  const relativePath = path.relative(path.join(__dirname, '../../'), filePath);
  return { filePath, relativePath };
}

/**
 * Generate complete Student Fee Ledger Statement PDF
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
    throw new Error('Student not found');
  }

  const school = await getSchoolSettings() || {
    school_name: 'Aryavart Shikshan Sansthan',
    address: 'Near Knowledge Hub, Main Campus',
    phone: '+91-9876543210',
    email: 'info@aryavart.edu.in',
  };

  const monthlyFees = await db.query(
    `SELECT * FROM \`monthly_fees\`
     WHERE \`student_id\` = ?
     ORDER BY \`fee_year\` ASC, \`fee_month\` ASC`,
    [studentId]
  );

  const additionalFees = await db.query(
    `SELECT * FROM \`student_additional_fees\`
     WHERE \`student_id\` = ?
     ORDER BY \`created_at\` ASC`,
    [studentId]
  );

  const payments = await db.query(
    `SELECT p.*, r.\`receipt_number\`
     FROM \`payments\` p
     LEFT JOIN \`receipts\` r ON r.\`payment_id\` = p.\`id\`
     WHERE p.\`student_id\` = ?
     ORDER BY p.\`payment_date\` DESC, p.\`id\` DESC`,
    [studentId]
  );

  const totalAssessed = monthlyFees.reduce((s, m) => s + Number(m.fee_amount || 0), 0) +
    additionalFees.reduce((s, a) => s + Number(a.amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalDue = Math.max(0, totalAssessed - totalPaid);

  const receiptsDir = ensureReceiptsDir();
  const filename = `ledger_${student.admission_no || studentId}_${Date.now()}.pdf`;
  const filePath = path.join(receiptsDir, filename);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  let y = 40;

  // Header
  doc.rect(40, y, 515, 60).fill('#0f172a');
  doc.fillColor('#38bdf8').fontSize(16).font('Helvetica-Bold').text(school.school_name, 55, y + 12);
  doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica').text(
    `📍 ${school.address || 'Main Campus'}  •  📞 ${school.phone || '+91-9876543210'}  •  Academic Session 2025–2026`,
    55,
    y + 34
  );

  y += 75;

  // Title Strip
  doc.rect(40, y, 515, 24).fill('#f1f5f9');
  doc.fillColor('#0369a1').fontSize(10).font('Helvetica-Bold').text(
    'OFFICIAL STUDENT FEE LEDGER & ACCOUNT STATEMENT',
    40,
    y + 7,
    { align: 'center', width: 515 }
  );

  y += 32;

  // Student Info Box
  doc.rect(40, y, 515, 60).stroke('#cbd5e1');
  doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold');
  doc.text('Student Name:', 55, y + 10);
  doc.text('Admission No:', 55, y + 26);
  doc.text('Class & Section:', 55, y + 42);

  doc.fillColor('#0f172a').font('Helvetica');
  doc.text(student.full_name || 'N/A', 140, y + 10);
  doc.text(student.admission_no || 'N/A', 140, y + 26);
  doc.text(`${student.class_name || 'N/A'} ${student.section_name ? `(${student.section_name})` : ''}`, 140, y + 42);

  doc.fillColor('#475569').font('Helvetica-Bold');
  doc.text('Father\'s Name:', 320, y + 10);
  doc.text('Category:', 320, y + 26);
  doc.text('Statement Date:', 320, y + 42);

  doc.fillColor('#0f172a').font('Helvetica');
  doc.text(student.father_name || 'N/A', 410, y + 10);
  doc.text(student.category === 'hosteller' ? 'Hostel Resident' : 'Day Scholar', 410, y + 26);
  doc.text(new Date().toLocaleDateString('en-IN'), 410, y + 42);

  y += 72;

  // Financial KPIs
  const boxW = 165;
  doc.rect(40, y, boxW, 36).fill('#f0f9ff').stroke('#bae6fd');
  doc.fillColor('#0369a1').fontSize(7.5).font('Helvetica-Bold').text('TOTAL ASSESSED FEES', 45, y + 6);
  doc.fillColor('#0369a1').fontSize(12).font('Helvetica-Bold').text(`₹${totalAssessed.toLocaleString('en-IN')}`, 45, y + 18);

  doc.rect(215, y, boxW, 36).fill('#f0fdf4').stroke('#bbf7d0');
  doc.fillColor('#15803d').fontSize(7.5).font('Helvetica-Bold').text('TOTAL FEES CLEARED', 220, y + 6);
  doc.fillColor('#15803d').fontSize(12).font('Helvetica-Bold').text(`₹${totalPaid.toLocaleString('en-IN')}`, 220, y + 18);

  doc.rect(390, y, boxW, 36).fill(totalDue > 0 ? '#fff7ed' : '#f0fdfa').stroke(totalDue > 0 ? '#fed7aa' : '#99f6e4');
  doc.fillColor(totalDue > 0 ? '#c2410c' : '#0f766e').fontSize(7.5).font('Helvetica-Bold').text('OUTSTANDING DUES', 395, y + 6);
  doc.fillColor(totalDue > 0 ? '#c2410c' : '#0f766e').fontSize(12).font('Helvetica-Bold').text(`₹${totalDue.toLocaleString('en-IN')}`, 395, y + 18);

  y += 48;

  // Monthly Table
  doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Month-by-Month Fee Schedule', 40, y);
  y += 14;

  doc.rect(40, y, 515, 18).fill('#0f172a');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('Month / Fee Period', 50, y + 5);
  doc.text('Assessed Rate', 240, y + 5, { align: 'right', width: 70 });
  doc.text('Amount Paid', 330, y + 5, { align: 'right', width: 70 });
  doc.text('Balance Due', 420, y + 5, { align: 'right', width: 60 });
  doc.text('Status', 500, y + 5, { align: 'center', width: 45 });

  y += 18;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (monthlyFees.length === 0) {
    doc.rect(40, y, 515, 18).stroke('#e2e8f0');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('No monthly fee schedules generated yet.', 50, y + 5);
    y += 18;
  } else {
    for (const m of monthlyFees) {
      if (y > 720) {
        doc.addPage();
        y = 40;
      }
      const due = Number(m.fee_amount || 0);
      const paid = Number(m.paid_amount || 0);
      const bal = Math.max(0, due - paid);
      const isPaid = bal === 0 && due > 0;

      doc.rect(40, y, 515, 16).stroke('#f1f5f9');
      doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica');
      doc.text(`${monthNames[m.fee_month - 1]} ${m.fee_year}`, 50, y + 4);
      doc.text(`₹${due.toLocaleString('en-IN')}`, 240, y + 4, { align: 'right', width: 70 });
      doc.fillColor('#15803d').text(`₹${paid.toLocaleString('en-IN')}`, 330, y + 4, { align: 'right', width: 70 });
      doc.fillColor(bal > 0 ? '#dc2626' : '#64748b').text(`₹${bal.toLocaleString('en-IN')}`, 420, y + 4, { align: 'right', width: 60 });
      doc.fillColor(isPaid ? '#15803d' : bal > 0 ? '#dc2626' : '#64748b').font('Helvetica-Bold').text(
        isPaid ? 'PAID' : bal > 0 ? 'DUE' : '—',
        500,
        y + 4,
        { align: 'center', width: 45 }
      );
      y += 16;
    }
  }

  y += 14;

  // Payments History Log (if any)
  if (payments.length > 0) {
    if (y > 660) {
      doc.addPage();
      y = 40;
    }
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(`Validated Payment Receipts Log (${payments.length})`, 40, y);
    y += 14;

    doc.rect(40, y, 515, 18).fill('#334155');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    doc.text('Receipt No', 50, y + 5);
    doc.text('Payment Date', 170, y + 5);
    doc.text('Payment Channel', 280, y + 5);
    doc.text('Amount Received', 440, y + 5, { align: 'right', width: 100 });

    y += 18;

    for (const p of payments.slice(0, 10)) {
      if (y > 730) {
        doc.addPage();
        y = 40;
      }
      doc.rect(40, y, 515, 16).stroke('#f1f5f9');
      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text(p.receipt_number || `RCP-${p.id}`, 50, y + 4);
      doc.fillColor('#334155').font('Helvetica').text(
        p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—',
        170,
        y + 4
      );
      doc.text(p.payment_mode === 'IN_ACCOUNT' ? '🏦 In Account (Bank)' : '💵 Cash Handover', 280, y + 4);
      doc.fillColor('#15803d').font('Helvetica-Bold').text(`₹${Number(p.amount).toLocaleString('en-IN')}`, 440, y + 4, { align: 'right', width: 100 });
      y += 16;
    }
  }

  // Footer & Seal
  if (y > 700) {
    doc.addPage();
    y = 40;
  }
  y += 20;
  doc.rect(40, y, 515, 45).fill('#f8fafc').stroke('#e2e8f0');
  doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(
    '✓ This is an official computer-generated fee ledger statement issued by Aryavart Shikshan Sansthan Accounts Department.',
    50,
    y + 16
  );
  doc.fillColor('#0369a1').font('Helvetica-Bold').text('Authorized Accounts Signatory', 390, y + 16);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
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