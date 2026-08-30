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
            color: #111827;
            background: #ffffff;
            margin: 0;
            padding: 0;
          }
          .official-receipt-sheet {
            width: 100% !important;
            max-width: 100% !important;
            border: 1.5px solid #1f2937 !important;
            border-radius: 4px !important;
            padding: 16px !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }
          .receipt-sheet-top-stripe {
            height: 4px;
            background: #1f2937;
            margin: -16px -16px 12px -16px;
            border-radius: 4px 4px 0 0;
          }
          .receipt-letterhead {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #1f2937;
            margin-bottom: 10px;
          }
          .letterhead-logo {
            width: 46px;
            height: 46px;
            border: 2px solid #1f2937;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f3f4f6;
            color: #111827;
          }
          .school-logo-img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .school-title {
            font-size: 18px;
            font-weight: 900;
            color: #111827;
            margin: 0 0 2px 0;
            letter-spacing: -0.3px;
            text-transform: uppercase;
          }
          .school-tagline {
            font-size: 10px;
            color: #4b5563;
            margin: 0 0 2px 0;
            font-weight: 600;
          }
          .school-contact-line {
            font-size: 9px;
            color: #374151;
            margin: 0;
          }
          .receipt-banner-strip, .statement-header-strip {
            background: #f3f4f6 !important;
            border: 1.5px solid #1f2937 !important;
            border-radius: 4px !important;
            padding: 6px 10px !important;
            margin-bottom: 10px !important;
            text-align: center !important;
          }
          .receipt-badge-title, .statement-title {
            font-size: 10.5px !important;
            font-weight: 900 !important;
            color: #111827 !important;
            letter-spacing: 0.5px !important;
            text-transform: uppercase !important;
            margin-bottom: 4px !important;
          }
          .receipt-meta-grid, .statement-meta-row {
            display: flex !important;
            justify-content: space-around !important;
            font-size: 9px !important;
            color: #374151 !important;
            border-top: 1px dashed #9ca3af !important;
            padding-top: 4px !important;
          }
          .meta-lbl {
            color: #4b5563;
            margin-right: 4px;
            font-weight: 600;
          }
          .meta-val {
            font-weight: 700;
            color: #111827;
          }
          .meta-val.highlight {
            color: #111827;
            font-family: monospace;
          }
          .receipt-student-details, .receipt-info-box {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            background: #f9fafb !important;
            border: 1px solid #374151 !important;
            border-radius: 4px !important;
            padding: 8px 10px !important;
            margin-bottom: 10px !important;
          }
          .detail-row, .info-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 9.5px !important;
            padding: 1.5px 0 !important;
          }
          .detail-row .lbl, .info-k {
            color: #4b5563 !important;
            font-weight: 600 !important;
          }
          .detail-row .val, .info-v {
            color: #111827 !important;
            font-weight: 700 !important;
          }
          .ledger-kpi-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 6px !important;
            margin-bottom: 10px !important;
          }
          .kpi-box {
            padding: 6px 8px !important;
            border-radius: 4px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            background: #ffffff !important;
            border: 1.5px solid #1f2937 !important;
            color: #111827 !important;
          }
          .kpi-lbl { font-size: 7.5px !important; font-weight: 800 !important; text-transform: uppercase !important; color: #4b5563 !important; }
          .kpi-val { font-size: 12px !important; font-weight: 900 !important; margin-top: 1px !important; color: #111827 !important; }
          .ledger-section-heading {
            font-size: 9.5px !important;
            font-weight: 900 !important;
            color: #111827 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            margin: 10px 0 4px 0 !important;
            padding-left: 4px !important;
            border-left: 3px solid #1f2937 !important;
          }
          .receipt-table-wrapper, .modern-table-container {
            margin-bottom: 10px !important;
            border: 1.5px solid #1f2937 !important;
            border-radius: 4px !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
          .receipt-table, .modern-ledger-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9px !important;
          }
          .receipt-table th, .modern-ledger-table th {
            background: #1f2937 !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            text-align: left !important;
            padding: 5px 8px !important;
          }
          .receipt-table td, .modern-ledger-table td {
            padding: 5px 8px !important;
            border-bottom: 1px solid #e5e7eb !important;
            color: #111827 !important;
          }
          .receipt-table tr:nth-child(even) td, .modern-ledger-table tbody tr:nth-child(even) td {
            background: #f9fafb !important;
          }
          .text-right { text-align: right !important; }
          .text-center { text-align: center !important; }
          .text-green { color: #111827 !important; font-weight: 800 !important; }
          .font-bold { font-weight: 800 !important; }
          .paid-tag {
            display: inline-block !important;
            font-size: 7.5px !important;
            font-weight: 800 !important;
            padding: 1.5px 5px !important;
            border-radius: 2px !important;
          }
          .paid-tag.cleared, .paid-tag {
            background: #111827 !important;
            color: #ffffff !important;
            border: 1px solid #111827 !important;
          }
          .paid-tag.due {
            background: #ffffff !important;
            color: #111827 !important;
            border: 1.5px solid #111827 !important;
          }
          .paid-tag.neutral {
            background: #f3f4f6 !important;
            color: #4b5563 !important;
            border: 1px solid #9ca3af !important;
          }
          .receipt-mono-tag {
            font-family: monospace !important;
            font-weight: 700 !important;
            color: #111827 !important;
            background: #f3f4f6 !important;
            border: 1px solid #9ca3af !important;
            border-radius: 2px !important;
            padding: 1px 4px !important;
            font-size: 8px !important;
          }
          .channel-pill {
            display: inline-block !important;
            padding: 1px 5px !important;
            border-radius: 2px !important;
            font-size: 7.5px !important;
            font-weight: 700 !important;
            background: #ffffff !important;
            border: 1px solid #4b5563 !important;
            color: #111827 !important;
          }
          .receipt-footer-section, .ledger-footer-section {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding-top: 8px !important;
            border-top: 2px solid #1f2937 !important;
            margin-top: 10px !important;
          }
          .payment-mode-box, .footer-disclaimer-box {
            font-size: 8.5px !important;
            color: #4b5563 !important;
          }
          .pm-label { color: #4b5563 !important; margin-right: 4px !important; }
          .pm-badge { font-weight: 700 !important; color: #111827 !important; }
          .thank-you-msg { margin-top: 4px !important; font-size: 7.5px !important; color: #4b5563 !important; font-weight: 500 !important; }
          .total-summary-card {
            background: #f9fafb !important;
            border: 1.5px solid #1f2937 !important;
            border-radius: 4px !important;
            padding: 6px 8px !important;
          }
          .grand-total-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            color: #111827 !important;
            padding-bottom: 4px !important;
            border-bottom: 1.5px solid #1f2937 !important;
            margin-bottom: 4px !important;
          }
          .grand-total-val { color: #111827 !important; font-size: 11px !important; font-weight: 900 !important; }
          .stamp-signature-grid, .footer-auth-box {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
          }
          .official-stamp-circle, .seal-stamp-circle {
            width: 44px !important;
            height: 44px !important;
            border: 2px double #111827 !important;
            border-radius: 50% !important;
            background: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .official-stamp-circle span, .seal-top, .seal-bot { font-size: 5px !important; font-weight: 900 !important; color: #111827 !important; }
          .official-stamp-circle small, .seal-mid { font-size: 4px !important; font-weight: 800 !important; color: #374151 !important; }
          .signature-line-box, .signature-block { text-align: right !important; }
          .sig-line, .sig-rule { width: 75px !important; height: 1.5px !important; background: #111827 !important; margin-bottom: 2px !important; display: inline-block !important; }
          .sig-label, .sig-title { font-size: 7.5px !important; color: #111827 !important; font-weight: 800 !important; }
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
