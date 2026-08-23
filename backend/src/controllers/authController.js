/**
 * Authentication Controller — School Management System
 *
 * Day 3: Authentication & Security.
 *
 * Handles admin/staff login. Verifies the supplied credentials against the
 * `users` table using bcrypt, then issues a signed JWT for stateless auth.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
async function login(req, res) {
  const { username, password } = req.body || {};

  // --- Input validation -----------------------------------------------------
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.',
    });
  }

  try {
    // --- Fetch the user (case-insensitive on username/email) ----------------
    const user = await db.queryOne(
      `SELECT id, username, email, password_hash, role, full_name, is_active
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [username, username]
    );

    // Generic error to avoid username enumeration.
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This account is deactivated. Contact the administrator.',
      });
    }

    // --- Verify password with bcrypt ---------------------------------------
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // --- Update last_login timestamp ---------------------------------------
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // --- Sign JWT ------------------------------------------------------------
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
      },
    });
  } catch (err) {
    console.error('[authController.login]', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during login.',
    });
  }
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (uses req.user from middleware).
 * Useful for re-hydrating the client session on page refresh.
 */
async function me(req, res) {
  try {
    const user = await db.queryOne(
      `SELECT id, username, email, role, full_name, last_login
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        last_login: user.last_login,
      },
    });
  } catch (err) {
    console.error('[authController.me]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
}

/**
 * PUT /api/auth/profile
 * Update user full name, username, and email.
 */
async function updateProfile(req, res) {
  const userId = req.user.id;
  const { full_name, username, email } = req.body || {};

  if (!username || !username.trim()) {
    return res.status(400).json({ success: false, message: 'Username cannot be empty.' });
  }

  try {
    // Check if username is already taken by another user
    const existingUsername = await db.queryOne(
      'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
      [username.trim(), userId]
    );
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'Username is already in use.' });
    }

    // Check if email is already taken if provided
    if (email && email.trim()) {
      const existingEmail = await db.queryOne(
        'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
        [email.trim(), userId]
      );
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'Email address is already registered.' });
      }
    }

    await db.query(
      `UPDATE users
       SET full_name = ?, username = ?, email = ?
       WHERE id = ?`,
      [full_name?.trim() || null, username.trim(), email?.trim() || null, userId]
    );

    const updatedUser = await db.queryOne(
      'SELECT id, username, email, role, full_name FROM users WHERE id = ?',
      [userId]
    );

    // Sign new JWT with updated info
    const token = jwt.sign(
      {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      message: 'Admin profile updated successfully.',
      token,
      user: updatedUser,
    });
  } catch (err) {
    console.error('[authController.updateProfile]', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
}

/**
 * PUT /api/auth/change-password
 * Change password by verifying old password and setting new password.
 */
async function changePassword(req, res) {
  const userId = req.user.id;
  const { current_password, new_password, confirm_password } = req.body || {};

  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Current and new password are required.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  if (confirm_password && new_password !== confirm_password) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  try {
    const user = await db.queryOne('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const matches = await bcrypt.compare(current_password, user.password_hash);
    if (!matches) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    return res.json({
      success: true,
      message: 'Password changed successfully. Please keep it secure.',
    });
  } catch (err) {
    console.error('[authController.changePassword]', err);
    return res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
}

const { sendPasswordResetOtpEmail } = require('../services/emailService');

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
}

/**
 * POST /api/auth/forgot-password-otp
 * Step 1: Generate & Send 6-digit verification code to registered email
 */
async function sendForgotPasswordOtp(req, res) {
  const { identifier } = req.body || {};

  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ success: false, message: 'Username or registered email is required.' });
  }

  try {
    // Ensure password_resets table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`password_resets\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`email\` VARCHAR(191) NOT NULL,
        \`otp_code\` VARCHAR(10) NOT NULL,
        \`expires_at\` DATETIME NOT NULL,
        \`is_used\` TINYINT(1) DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (\`email\`),
        INDEX (\`otp_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const user = await db.queryOne(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier.trim(), identifier.trim()]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No administrator account found with that username or email.',
      });
    }

    if (!user.email || !user.email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No email address is linked to this admin account for verification.',
      });
    }

    // Generate secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Expire previous unused OTPs for this email
    await db.query('UPDATE password_resets SET is_used = 1 WHERE email = ?', [user.email]);

    // Insert new OTP with 10 minute expiry
    await db.query(
      `INSERT INTO password_resets (email, otp_code, expires_at, is_used)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0)`,
      [user.email, otpCode]
    );

    // Send email
    await sendPasswordResetOtpEmail(user.email, otpCode, user.username);

    const masked = maskEmail(user.email);
    return res.json({
      success: true,
      message: `A 6-digit verification code has been securely sent to your email (${masked}). Please check your inbox.`,
      masked_email: masked,
    });
  } catch (err) {
    console.error('[authController.sendForgotPasswordOtp]', err);
    return res.status(500).json({ success: false, message: 'Failed to send verification code.' });
  }
}

/**
 * POST /api/auth/verify-otp-reset (also /reset-password)
 * Step 2: Verify 6-digit OTP and reset password
 */
async function verifyOtpAndResetPassword(req, res) {
  const { identifier, otp_code, new_password, confirm_password } = req.body || {};

  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ success: false, message: 'Username or email is required.' });
  }

  if (!otp_code || !otp_code.trim()) {
    return res.status(400).json({ success: false, message: '6-digit verification code is required.' });
  }

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
  }

  if (confirm_password && new_password !== confirm_password) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  try {
    const user = await db.queryOne(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier.trim(), identifier.trim()]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Administrator account not found.' });
    }

    // Verify OTP code
    const validOtp = await db.queryOne(
      `SELECT id FROM password_resets
       WHERE email = ? AND otp_code = ? AND is_used = 0 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [user.email, otp_code.trim()]
    );

    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code. Please check or request a new code.',
      });
    }

    // Hash new password and update user
    const newHash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    // Mark OTP as used
    await db.query('UPDATE password_resets SET is_used = 1 WHERE id = ?', [validOtp.id]);

    return res.json({
      success: true,
      message: `Password for ${user.username} has been securely reset. You can now log in.`,
    });
  } catch (err) {
    console.error('[authController.verifyOtpAndResetPassword]', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
}

module.exports = {
  login,
  me,
  updateProfile,
  changePassword,
  sendForgotPasswordOtp,
  verifyOtpAndResetPassword,
  forgotPassword: verifyOtpAndResetPassword,
};
