/**
 * Receipt Generator Utility — School Management System
 * High-Resolution JPG Receipt Exporter & Native WhatsApp Share Engine
 */

import html2canvas from 'html2canvas';

/**
 * Capture a DOM element and export it as a high-resolution JPEG image.
 * @param {HTMLElement} element - The DOM element to capture
 * @param {string} filename - Base filename without extension
 * @returns {Promise<string>} Base64 data URL
 */
export async function captureElementAsJpg(element, quality = 0.95) {
  if (!element) throw new Error('Receipt element not found');

  // Clone or render with clean background and 2x scale for crisp printing
  const canvas = await html2canvas(element, {
    scale: 2, // 2x Retina resolution
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Download a DOM element directly as a .jpg file
 */
export async function downloadElementAsJpg(element, filename = 'Fee_Receipt') {
  const cleanName = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
  const dataUrl = await captureElementAsJpg(element);

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = cleanName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return cleanName;
}

/**
 * Share receipt directly via WhatsApp (Supports native image file share on mobile & wa.me fallback)
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

  // 1. Try Native Web Share API with JPEG File (Works on Mobile Android & iOS)
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

  // 2. Direct WhatsApp Web / App Link Fallback
  if (element) {
    // Also trigger instant JPG download so user has the image ready
    try {
      await downloadElementAsJpg(element, filename.replace('.jpg', ''));
    } catch {
      // Ignore download errors on direct link
    }
  }

  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultText)}`
    : `https://wa.me/?text=${encodeURIComponent(defaultText)}`;

  window.open(waUrl, '_blank');
  return { success: true, mode: 'direct_link' };
}
