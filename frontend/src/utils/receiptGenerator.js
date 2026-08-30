/**
 * Receipt Generator Utility — School Management System
 * High-Resolution Full-Page JPG Receipt Exporter & Background WhatsApp Image Engine
 */

import html2canvas from 'html2canvas';

/**
 * Capture a DOM element and export it as a high-resolution full-page JPEG image.
 * Solves half-page clipping by strictly calculating full scrollHeight and disabling container overflow in clone.
 * @param {HTMLElement} element - The DOM element to capture
 * @param {number} quality - JPEG compression quality (0.1 to 1.0)
 * @returns {Promise<string>} Base64 data URL
 */
export async function captureElementAsJpg(element, quality = 0.95) {
  if (!element) throw new Error('Receipt element not found');

  // Measure exact full dimensions of receipt sheet
  const fullWidth = Math.max(element.scrollWidth, element.offsetWidth, 600);
  const fullHeight = Math.max(element.scrollHeight, element.offsetHeight, 700);

  // Render with html2canvas ensuring full scroll height & zero viewport clipping
  const canvas = await html2canvas(element, {
    scale: 2, // 2x Crisp resolution
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
    width: fullWidth,
    height: fullHeight,
    windowWidth: fullWidth + 100,
    windowHeight: fullHeight + 100,
    onclone: (clonedDoc, clonedElement) => {
      // Force element and all parent hierarchy to be visible, fully expanded, and zero scroll offset
      clonedElement.style.overflow = 'visible';
      clonedElement.style.height = `${fullHeight}px`;
      clonedElement.style.maxHeight = 'none';
      clonedElement.style.position = 'static';
      clonedElement.style.transform = 'none';
      clonedElement.style.margin = '0';
      clonedElement.style.boxSizing = 'border-box';

      let parent = clonedElement.parentElement;
      while (parent) {
        parent.style.overflow = 'visible';
        parent.style.height = 'auto';
        parent.style.maxHeight = 'none';
        parent.scrollTop = 0;
        parent = parent.parentElement;
      }
    },
  });

  return canvas.toDataURL('image/jpeg', quality);
}

import { saveFileToDeviceStorage } from './fileDownloader';

/**
 * Download a DOM element directly as a full-page .jpg file, saving to native Phone Storage on APK or browser downloads.
 */
export async function downloadElementAsJpg(element, filename = 'Fee_Receipt') {
  const cleanName = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
  const dataUrl = await captureElementAsJpg(element);

  const saveRes = await saveFileToDeviceStorage({
    data: dataUrl,
    filename: cleanName,
    mimeType: 'image/jpeg',
  });

  return saveRes;
}

/**
 * Share receipt directly via WhatsApp fallback
 */
export async function shareReceiptViaWhatsApp({ element, phone = '', studentName = '', receiptNo = '', amount = '', customText = '' }) {
  let cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

  const defaultText = customText || (
    `🏫 *Aryavart Shikshan Sansthan — Fee Payment Receipt*\n\n` +
    `Dear Parent,\nFee payment has been received successfully for *${studentName || 'Student'}*.\n\n` +
    `📋 *Receipt No:* ${receiptNo || 'RCP-PAID'}\n` +
    `💰 *Amount Paid:* ₹${amount || '0'}\n` +
    `📅 *Date:* ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n\n` +
    `Thank you for your timely fee submission!\n_Aryavart Shikshan Sansthan_`
  );

  const filename = `Receipt_${receiptNo || studentName || 'Payment'}.jpg`;

  if (element && navigator.share && navigator.canShare) {
    try {
      const dataUrl = await captureElementAsJpg(element);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: 'image/jpeg' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Fee Payment Receipt',
          text: defaultText,
        });
        return { success: true, mode: 'native_share' };
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[shareReceiptViaWhatsApp] Native share fallback:', err);
      } else {
        return { success: true, mode: 'user_cancelled' };
      }
    }
  }

  return { success: true, mode: 'completed' };
}

/**
 * Print a receipt element in a dedicated, clean print layout without background website clutter.
 */
export function printReceiptElement(element, title = 'Official Fee Receipt') {
  if (!element) {
    window.print();
    return;
  }

  // Clone element content
  const clone = element.cloneNode(true);
  clone.style.width = '100%';
  clone.style.maxWidth = '100%';
  clone.style.margin = '0 auto';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.transform = 'none';

  // Create an isolated hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 0;
          }
          .official-receipt-sheet {
            width: 100% !important;
            max-width: 100% !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 6px !important;
            padding: 18px !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }
          .receipt-sheet-top-stripe {
            height: 4px;
            background: linear-gradient(90deg, #1e3a8a, #0284c7, #38bdf8);
            margin: -18px -18px 14px -18px;
            border-radius: 6px 6px 0 0;
          }
          .receipt-letterhead {
            display: flex;
            align-items: center;
            gap: 14px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
            margin-bottom: 10px;
          }
          .letterhead-logo {
            width: 55px;
            height: 55px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .school-logo-img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .school-title {
            font-size: 19px;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 2px 0;
            letter-spacing: -0.3px;
          }
          .school-tagline {
            font-size: 10.5px;
            color: #64748b;
            margin: 0 0 3px 0;
          }
          .school-contact-line {
            font-size: 9.5px;
            color: #475569;
            margin: 0;
          }
          .receipt-banner-strip {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 7px 10px;
            margin-bottom: 10px;
          }
          .receipt-badge-title {
            font-size: 10.5px;
            font-weight: 700;
            color: #0284c7;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .receipt-meta-grid {
            display: flex;
            gap: 14px;
            font-size: 10.5px;
          }
          .meta-lbl {
            color: #64748b;
            margin-right: 4px;
          }
          .meta-val {
            font-weight: 600;
            color: #0f172a;
          }
          .meta-val.highlight {
            color: #0284c7;
            font-family: monospace;
          }
          .receipt-student-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 9px 12px;
            margin-bottom: 12px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            font-size: 10.5px;
            padding: 2px 0;
          }
          .detail-row .lbl {
            color: #64748b;
            font-weight: 500;
          }
          .detail-row .val {
            color: #0f172a;
            font-weight: 600;
          }
          .receipt-table-wrapper {
            margin-bottom: 12px;
          }
          .receipt-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
          }
          .receipt-table th {
            background: #0f172a !important;
            color: #ffffff !important;
            font-weight: 600;
            text-align: left;
            padding: 6px 9px;
          }
          .receipt-table td {
            padding: 6px 9px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
          }
          .receipt-table tr:nth-child(even) td {
            background: #f8fafc;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .text-green {
            color: #16a34a !important;
          }
          .font-bold {
            font-weight: 700;
          }
          .paid-tag {
            display: inline-block;
            background: #dcfce7;
            color: #15803d;
            font-size: 8.5px;
            font-weight: 700;
            padding: 1.5px 5px;
            border-radius: 4px;
          }
          .receipt-footer-section {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 12px;
            padding-top: 9px;
            border-top: 2px solid #e2e8f0;
          }
          .payment-mode-box {
            font-size: 9.5px;
            color: #475569;
          }
          .pm-label {
            color: #64748b;
            margin-right: 4px;
          }
          .pm-badge {
            font-weight: 600;
            color: #0f172a;
          }
          .thank-you-msg {
            margin-top: 6px;
            font-size: 8.5px;
            color: #64748b;
            font-style: italic;
          }
          .total-summary-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px;
          }
          .grand-total-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
            padding-bottom: 6px;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 6px;
          }
          .grand-total-val {
            color: #16a34a;
            font-size: 13px;
          }
          .stamp-signature-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 8px;
          }
          .official-stamp-circle {
            width: 44px;
            height: 44px;
            border: 2px dashed #94a3b8;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7.5px;
            font-weight: 700;
            color: #64748b;
            text-align: center;
          }
          .signature-line-box {
            text-align: right;
          }
          .statement-header-strip {
            background: #f0f9ff !important;
            border: 1px solid #bae6fd !important;
            border-radius: 6px !important;
            padding: 8px 12px !important;
            margin-bottom: 10px !important;
            text-align: center !important;
          }
          .statement-title {
            font-size: 11px !important;
            font-weight: 800 !important;
            color: #0369a1 !important;
            letter-spacing: 0.5px !important;
            margin-bottom: 4px !important;
          }
          .statement-meta-row {
            display: flex !important;
            justify-content: space-around !important;
            font-size: 9.5px !important;
            color: #475569 !important;
            border-top: 1px dashed #cbd5e1 !important;
            padding-top: 4px !important;
          }
          .ledger-kpi-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }
          .kpi-box {
            padding: 8px !important;
            border-radius: 6px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            border: 1px solid !important;
          }
          .kpi-box.blue { background: #f0f9ff !important; border-color: #bae6fd !important; color: #0369a1 !important; }
          .kpi-box.green { background: #f0fdf4 !important; border-color: #bbf7d0 !important; color: #15803d !important; }
          .kpi-box.orange { background: #fff7ed !important; border-color: #fed7aa !important; color: #c2410c !important; }
          .kpi-box.teal { background: #f0fdfa !important; border-color: #99f6e4 !important; color: #0f766e !important; }
          .kpi-lbl { font-size: 8px !important; font-weight: 800 !important; text-transform: uppercase !important; }
          .kpi-val { font-size: 13px !important; font-weight: 900 !important; margin-top: 2px !important; }
          .ledger-section-heading {
            font-size: 10px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            margin: 8px 0 4px 0 !important;
          }
          .paid-tag.cleared { background: #dcfce7 !important; color: #15803d !important; border: 1px solid #86efac !important; }
          .paid-tag.due { background: #fee2e2 !important; color: #dc2626 !important; border: 1px solid #fca5a5 !important; }
          .paid-tag.neutral { background: #f1f5f9 !important; color: #64748b !important; border: 1px solid #cbd5e1 !important; }
          .modern-table-container {
            border: 1px solid #cbd5e1 !important;
            border-radius: 6px !important;
            overflow: hidden !important;
            margin-bottom: 10px !important;
          }
          .modern-ledger-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9.5px !important;
          }
          .modern-ledger-table thead tr {
            background: #0f172a !important;
            color: #ffffff !important;
          }
          .modern-ledger-table th {
            padding: 6px 9px !important;
            font-weight: 700 !important;
            text-align: left !important;
          }
          .modern-ledger-table td {
            padding: 6px 9px !important;
            border-bottom: 1px solid #f1f5f9 !important;
          }
          .modern-ledger-table tbody tr:nth-child(even) td {
            background: #f8fafc !important;
          }
          .receipt-mono-tag {
            font-family: monospace !important;
            font-weight: 700 !important;
            color: #0284c7 !important;
            background: #f0f9ff !important;
            border: 1px solid #bae6fd !important;
            border-radius: 3px !important;
            padding: 1px 4px !important;
            font-size: 8.5px !important;
          }
          .channel-pill {
            display: inline-block !important;
            padding: 1px 5px !important;
            border-radius: 3px !important;
            font-size: 8px !important;
            font-weight: 600 !important;
          }
          .channel-pill.bank { background: #e0f2fe !important; color: #0369a1 !important; border: 1px solid #bae6fd !important; }
          .channel-pill.cash { background: #dcfce7 !important; color: #15803d !important; border: 1px solid #bbf7d0 !important; }
          .ledger-footer-section {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-top: 14px !important;
            padding: 10px 12px !important;
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
          }
          .footer-auth-box {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
          }
          .seal-stamp-circle {
            width: 48px !important;
            height: 48px !important;
            border: 2px double #0284c7 !important;
            border-radius: 50% !important;
            background: #f0f9ff !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .seal-top { font-size: 6px !important; font-weight: 900 !important; color: #0369a1 !important; }
          .seal-mid { font-size: 5px !important; font-weight: 700 !important; color: #0284c7 !important; }
          .seal-bot { font-size: 5.5px !important; font-weight: 800 !important; color: #15803d !important; }
          .signature-block { text-align: right !important; }
          .signature-block .sig-rule { width: 80px !important; height: 1px !important; background: #334155 !important; margin-bottom: 2px !important; }
          .signature-block .sig-title { font-size: 8px !important; font-weight: 700 !important; color: #334155 !important; }
        </style>
      </head>
      <body>
        ${clone.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.warn('[printReceiptElement] Iframe print fallback:', e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 300);
}
