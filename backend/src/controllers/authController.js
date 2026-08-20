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

/**
 * POST /api/auth/forgot-password
 * Reset password via username or email.
 */
async function forgotPassword(req, res) {
  const { identifier, new_password } = req.body || {};

  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ success: false, message: 'Username or registered email is required.' });
  }

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
  }

  try {
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

    const newHash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    return res.json({
      success: true,
      message: `Password for ${user.username} has been reset successfully. You can now sign in.`,
    });
  } catch (err) {
    console.error('[authController.forgotPassword]', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
}

module.exports = {
  login,
  me,
  updateProfile,
  changePassword,
  forgotPassword,
};
