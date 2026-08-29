/**
 * Universal File Downloader & Native Device Storage Engine — School Management System
 * Automatically routes downloads to Native Android Mobile Storage (Downloads/Documents) on APK
 * or Browser Download Manager on Desktop/Web.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Convert a Blob to a Base64 Data URL string
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Strip Data URL prefix (e.g. "data:image/jpeg;base64,") to get raw base64
 */
function cleanBase64(dataUrlOrBase64) {
  if (typeof dataUrlOrBase64 !== 'string') return '';
  const commaIdx = dataUrlOrBase64.indexOf(',');
  if (commaIdx !== -1) {
    return dataUrlOrBase64.slice(commaIdx + 1);
  }
  return dataUrlOrBase64;
}

/**
 * Universally save any File, PDF, Image, or Blob to Device Storage.
 * - On Android APK: Writes directly to device's public Documents/Downloads folder with runtime permission request.
 * - On Web Browser: Triggers standard browser download.
 *
 * @param {Object} options
 * @param {string|Blob} options.data - Base64 string, Data URL, or Blob
 * @param {string} options.filename - Name of file with extension (e.g. "Receipt_1001.jpg")
 * @param {string} [options.mimeType] - e.g. "image/jpeg" or "application/pdf"
 * @returns {Promise<{ success: boolean, platform: string, path?: string, message?: string }>}
 */
export async function saveFileToDeviceStorage({ data, filename = 'download', mimeType = 'application/octet-stream' }) {
  if (!data) throw new Error('No data provided to download');

  const isNative = Capacitor.isNativePlatform();

  // =========================================================================
  // 1. NATIVE ANDROID APK FLOW (Write directly to phone storage)
  // =========================================================================
  if (isNative) {
    try {
      // Step A: Request Runtime Storage Permissions on Android
      try {
        const permStatus = await Filesystem.checkPermissions();
        if (permStatus.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }
      } catch (permErr) {
        console.warn('[Filesystem Perm]', permErr);
      }

      // Step B: Convert Blob to raw base64 if needed
      let rawBase64 = '';
      if (data instanceof Blob) {
        const dataUrl = await blobToBase64(data);
        rawBase64 = cleanBase64(dataUrl);
      } else {
        rawBase64 = cleanBase64(data);
      }

      // Step C: Write file to public Documents / Downloads directory
      // Directory.Documents is universally supported across Android 10, 11, 12, 13, 14 Scoped Storage
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: rawBase64,
        directory: Directory.Documents,
        recursive: true,
      });

      return {
        success: true,
        platform: 'native',
        path: writeResult.uri,
        message: `Saved to Phone Storage: Documents/${filename}`,
      };
    } catch (nativeErr) {
      console.error('[Native Save Error, attempting fallback]', nativeErr);

      // Fallback attempt: Write to Directory.Data if Documents permission was denied
      try {
        let rawBase64 = data instanceof Blob ? cleanBase64(await blobToBase64(data)) : cleanBase64(data);
        const fallbackResult = await Filesystem.writeFile({
          path: filename,
          data: rawBase64,
          directory: Directory.Data,
          recursive: true,
        });
        return {
          success: true,
          platform: 'native_data',
          path: fallbackResult.uri,
          message: `Saved to App Storage: ${filename}`,
        };
      } catch (fallbackErr) {
        console.error('[Filesystem Fallback Error]', fallbackErr);
        throw new Error('Could not write to device storage. Please check storage permissions in App Settings.');
      }
    }
  }

  // =========================================================================
  // 2. WEB BROWSER / DESKTOP FLOW (Standard Browser Download)
  // =========================================================================
  let blobUrl = '';
  let needRevoke = false;

  if (data instanceof Blob) {
    blobUrl = window.URL.createObjectURL(data);
    needRevoke = true;
  } else if (typeof data === 'string') {
    if (data.startsWith('data:')) {
      blobUrl = data;
    } else {
      // Raw base64 -> convert to Blob URL
      const byteCharacters = atob(cleanBase64(data));
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      blobUrl = window.URL.createObjectURL(blob);
      needRevoke = true;
    }
  }

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (needRevoke) {
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  }

  return {
    success: true,
    platform: 'web',
    message: `Downloaded: ${filename}`,
  };
}
