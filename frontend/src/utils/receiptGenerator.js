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
