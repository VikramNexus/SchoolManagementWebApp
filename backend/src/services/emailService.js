/**
 * Email Service — School Management System
 * Handles sending system emails, OTP verification codes, and security alerts.
 */

const nodemailer = require('nodemailer');

// Initialize SMTP or Gmail transporter
function createTransporter() {
  // Option 1: Direct Gmail App Password
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  // Option 2: Custom SMTP Host (cPanel, Hostinger, Brevo, SendGrid)
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  // Fallback transporter (console logging for dev/testing when SMTP is not configured)
  return null;
}

/**
 * Send 6-digit Password Reset OTP to Administrator Email
 */
async function sendPasswordResetOtpEmail(toEmail, otpCode, username) {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Aryavart Portal Security" <noreply@schoolmanagement.local>',
    to: toEmail,
    subject: `🔐 Your Password Reset Verification Code: ${otpCode}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #38bdf8; margin: 0; font-size: 22px;">🏫 Aryavart Portal</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0;">Administrator Account Security</p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; text-align: center;">
          <p style="font-size: 15px; margin: 0 0 16px; color: #e2e8f0;">
            Hello <strong>${username}</strong>,<br/>
            We received a request to reset the password for your administrator account.
          </p>

          <p style="font-size: 13px; color: #94a3b8; margin: 0 0 12px;">Your 6-digit email verification code is:</p>

          <div style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; background: #1e293b; padding: 12px 24px; border-radius: 10px; border: 1.5px dashed #38bdf8; margin-bottom: 16px;">
            ${otpCode}
          </div>

          <p style="font-size: 12px; color: #f59e0b; margin: 0;">
            ⚠️ This code is valid for <strong>10 minutes</strong>. Do NOT share this code with anyone.
          </p>
        </div>

        <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px;">
          If you did not request this password reset, please ignore this email. Your account remains secure.
        </p>
      </div>
    `,
    text: `Your Aryavart Portal Password Reset Code is: ${otpCode}. Valid for 10 minutes.`,
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
