/**
 * Local WhatsApp Gateway — School Management System (Aryavart Portal)
 *
 * Lightweight, headless WhatsApp Web companion socket using Baileys.
 * Runs in the background on the local machine with zero external dependencies.
 *
 * Features:
 * - Mutex-locked single socket instance to prevent conflict errors (code 440)
 * - Cacheable Signal Key Store for session integrity
 * - Auto-reconnect on network interruptions
 * - Direct Plaintext WhatsApp Message Dispatch (Payments, Dues, Admissions)
 */

const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const pino = require('pino');

let sock = null;
let qrCodeDataUrl = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let linkedUserPhone = null;
let isInitializing = false;
let reconnectTimer = null;

const AUTH_FOLDER = path.join(__dirname, '../../data/wpp_auth');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_FOLDER)) {
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
}

/**
 * Format raw phone number into standard WhatsApp JID
 * e.g., '9876543210' -> '919876543210@s.whatsapp.net'
 * e.g., '09876543210' -> '919876543210@s.whatsapp.net'
 * e.g., '+91 98765-43210' -> '919876543210@s.whatsapp.net'
 */
function formatToJID(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '91' + cleaned.slice(1);
  } else if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Format phone for display (e.g. +91 62018 44773)
 */
function formatDisplayPhone(jidOrNumber) {
  if (!jidOrNumber) return null;
  const num = String(jidOrNumber).split('@')[0].split(':')[0];
  if (num.length >= 12 && num.startsWith('91')) {
    return `+91 ${num.slice(2, 7)} ${num.slice(7)}`;
  }
  return `+${num}`;
}

/**
 * Clean up existing socket before opening a new one
 */
function destroySocket() {
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      sock.end(undefined);
    } catch (e) {}
    sock = null;
  }
}

/**
 * Initialize WhatsApp Gateway Socket with single-instance lock
 */
async function initWhatsAppGateway() {
  // If already connecting or already connected, do not spawn another socket
  if (isInitializing || connectionStatus === 'connected' || (sock && connectionStatus === 'qr_ready')) {
    return;
  }

  isInitializing = true;
  connectionStatus = 'connecting';
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      makeCacheableSignalKeyStore,
      DisconnectReason,
      fetchLatestBaileysVersion,
    } = await import('@whiskeysockets/baileys');

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    destroySocket();

    const logger = pino({ level: 'silent' });

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      browser: ['Aryavart Portal Server', 'Chrome', '122.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    // Save credentials update
    sock.ev.on('creds.update', saveCreds);

    // Connection lifecycle handler
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          qrCodeDataUrl = await qrcode.toDataURL(qr, {
            margin: 2,
            width: 280,
            color: { dark: '#090e17', light: '#ffffff' },
          });
          connectionStatus = 'qr_ready';
        } catch (qrErr) {
          console.error('[WhatsApp Gateway] Error generating QR code image:', qrErr);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[WhatsApp Gateway] Disconnected (code: ${statusCode || 'unknown'}). Should reconnect: ${shouldReconnect}`);
        
        qrCodeDataUrl = null;
        linkedUserPhone = null;
        destroySocket();

        if (statusCode === DisconnectReason.loggedOut) {
          connectionStatus = 'disconnected';
          try {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
          } catch (e) {}
          // Re-init so fresh QR is immediately available
          reconnectTimer = setTimeout(() => {
            isInitializing = false;
            initWhatsAppGateway();
          }, 2000);
        } else {
          connectionStatus = 'connecting';
          if (shouldReconnect) {
            reconnectTimer = setTimeout(() => {
              isInitializing = false;
              initWhatsAppGateway();
            }, 4000);
          } else {
            connectionStatus = 'disconnected';
          }
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        qrCodeDataUrl = null;
        const userJid = sock?.user?.id || '';
        linkedUserPhone = formatDisplayPhone(userJid);
        console.log(`[WhatsApp Gateway] ✅ WhatsApp Connected Successfully! Linked Phone: ${linkedUserPhone}`);
      }
    });
  } catch (err) {
    console.error('[WhatsApp Gateway] Startup Error:', err);
    connectionStatus = 'disconnected';
    destroySocket();
  } finally {
    isInitializing = false;
  }
}

/**
 * Get the current Gateway Status
 */
function getStatus() {
  const isConnected = connectionStatus === 'connected' && Boolean(sock);
  return {
    connected: isConnected,
    status: isConnected ? 'connected' : connectionStatus,
    qrCodeDataUrl: connectionStatus === 'qr_ready' ? qrCodeDataUrl : null,
    userPhone: linkedUserPhone,
    hasAuthFiles: fs.existsSync(path.join(AUTH_FOLDER, 'creds.json')),
  };
}

/**
 * Send a direct WhatsApp text message in background (No PDF, 100% Text Message)
 */
async function sendTextMessage(toPhone, messageBody) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp is not linked on your laptop. Please visit Settings -> Messaging to link your phone.');
  }

  const jid = formatToJID(toPhone);
  if (!jid) {
    throw new Error(`Invalid recipient phone number: ${toPhone}`);
  }

  const result = await sock.sendMessage(jid, { text: messageBody });
  return {
    success: true,
    messageId: result?.key?.id || `WA-${Date.now()}`,
    recipient: toPhone,
    timestamp: new Date(),
  };
}

/**
 * Send a direct WhatsApp image (JPEG / PNG) with optional caption in background
 */
async function sendImageMessage(toPhone, imageBufferOrDataUrl, caption = '') {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp is not linked on your laptop. Please visit Settings -> Messaging to link your phone.');
  }

  const jid = formatToJID(toPhone);
  if (!jid) {
    throw new Error(`Invalid recipient phone number: ${toPhone}`);
  }

  let buffer;
  if (Buffer.isBuffer(imageBufferOrDataUrl)) {
    buffer = imageBufferOrDataUrl;
  } else if (typeof imageBufferOrDataUrl === 'string' && imageBufferOrDataUrl.startsWith('data:image/')) {
    const base64Data = imageBufferOrDataUrl.split(';base64,').pop();
    buffer = Buffer.from(base64Data, 'base64');
  } else if (typeof imageBufferOrDataUrl === 'string' && fs.existsSync(imageBufferOrDataUrl)) {
    buffer = fs.readFileSync(imageBufferOrDataUrl);
  } else {
    throw new Error('Invalid image payload provided for WhatsApp');
  }

  const result = await sock.sendMessage(jid, {
    image: buffer,
    caption: caption || '',
    mimetype: 'image/jpeg',
  });

  return {
    success: true,
    messageId: result?.key?.id || `WA-IMG-${Date.now()}`,
    recipient: toPhone,
    timestamp: new Date(),
  };
}

/**
 * Disconnect / Log out session
 */
async function disconnectGateway() {
  destroySocket();

  qrCodeDataUrl = null;
  connectionStatus = 'disconnected';
  linkedUserPhone = null;

  try {
    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  } catch (e) {}

  setTimeout(() => {
    isInitializing = false;
    initWhatsAppGateway();
  }, 1000);

  return { success: true, message: 'WhatsApp session unlinked.' };
}

/**
 * Force restart socket to refresh QR code
 */
async function restartGateway() {
  destroySocket();
  connectionStatus = 'disconnected';
  qrCodeDataUrl = null;
  isInitializing = false;
  await initWhatsAppGateway();
  return getStatus();
}

module.exports = {
  initWhatsAppGateway,
  getStatus,
  sendTextMessage,
  sendImageMessage,
  disconnectGateway,
  restartGateway,
};
