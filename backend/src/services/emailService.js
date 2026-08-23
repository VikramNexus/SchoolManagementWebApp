/**
 * Email Service — School Management System
 * Handles sending system emails, OTP verification codes, and security alerts.
 */

const nodemailer = require('nodemailer');

let cachedTransporter = null;

// Initialize cached pooled SMTP / Gmail transporter for high-speed delivery
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  // Option 1: Direct Gmail High-Speed SSL Pool
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 8000,
      greetingTimeout: 4000,
    });
    return cachedTransporter;
  }

  // Option 2: Custom SMTP Host (cPanel, Hostinger, Brevo, SendGrid)
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      pool: true,
      maxConnections: 5,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 8000,
      greetingTimeout: 4000,
    });
    return cachedTransporter;
  }

  return null;
}

/**
 * Send 6-digit Password Reset OTP to Administrator Email
 */
async function sendPasswordResetOtpEmail(toEmail, otpCode, username) {
  const transporter = getTransporter();

  const senderEmail = process.env.GMAIL_USER || 'vy3052907@gmail.com';

  const mailOptions = {
    from: `"Aryavart Portal Security" <${senderEmail}>`,
    to: toEmail,
    replyTo: senderEmail,
    subject: `Password Reset Verification Code: ${otpCode} — Aryavart Portal`,
    text: `Hello ${username},\n\nYour 6-digit verification code to reset your Aryavart Portal admin password is: ${otpCode}\n\nThis code is valid for 10 minutes.\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 14px; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #1e293b; padding-bottom: 16px;">
          <h2 style="color: #38bdf8; margin: 0; font-size: 20px; letter-spacing: -0.5px;">🏫 Aryavart Shikshan Sansthan</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0;">Administrator Account Security</p>
        </div>

        <div style="background: #1e293b; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <p style="font-size: 14px; margin: 0 0 14px; color: #e2e8f0;">
            Hello <strong>${username}</strong>,<br/>
            We received a request to reset the password for your administrator account.
          </p>

          <p style="font-size: 12px; color: #94a3b8; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">Your 6-Digit Verification Code</p>

          <div style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; background: #0f172a; padding: 12px 28px; border-radius: 8px; border: 1.5px dashed #38bdf8; margin-bottom: 14px;">
            ${otpCode}
          </div>

          <p style="font-size: 12px; color: #fbbf24; margin: 0;">
            ⏱️ This code will expire in <strong>10 minutes</strong>.
          </p>
        </div>

        <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0; line-height: 1.5;">
          If you did not request this password reset, you can safely ignore this email.<br/>
          Your account remains protected.
        </p>
      </div>
    `,
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailService] OTP sent to ${toEmail}: ${info.messageId}`);
      return { success: true, mode: 'smtp' };
    } catch (err) {
      console.error('[EmailService] SMTP send error:', err);
      // Fallback
    }
  }

  // If no SMTP configured, log to console
  console.log('====================================================');
  console.log(`🔐 [EMAIL VERIFICATION OTP] Sent to: ${toEmail}`);
  console.log(`🔑 Verification Code: ${otpCode} (Valid for 10 min)`);
  console.log('====================================================');

  return { success: true, mode: 'console_dev' };
}

module.exports = {
  sendPasswordResetOtpEmail,
};
