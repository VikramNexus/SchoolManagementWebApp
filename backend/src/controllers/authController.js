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
 * PUT /api/auth/profile-and-security
 * Unified 1-Click Update for Admin Profile, Password, and Security Question
 */
async function updateAllAdminSettings(req, res) {
  const userId = req.user.id;
  const {
    full_name,
    username,
    email,
    current_password,
    new_password,
    confirm_password,
    security_question,
    security_answer,
  } = req.body || {};

  if (!username || !username.trim()) {
    return res.status(400).json({ success: false, message: 'Login username cannot be empty.' });
  }

  try {
    const user = await db.queryOne(
      'SELECT id, username, email, password_hash, security_question, security_answer_hash FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Administrator account not found.' });
    }

    // 1. Check if new username is already taken by another user
    const trimmedUsername = username.trim();
    if (trimmedUsername.toLowerCase() !== user.username.toLowerCase()) {
      const existingUser = await db.queryOne(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ? LIMIT 1',
        [trimmedUsername, userId]
      );
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: `Username '${trimmedUsername}' is already taken by another account.`,
        });
      }
    }

    // 2. Check if new email is already taken by another user
    const trimmedEmail = email?.trim() || null;
    if (trimmedEmail && trimmedEmail.toLowerCase() !== (user.email || '').toLowerCase()) {
      const existingEmail = await db.queryOne(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ? LIMIT 1',
        [trimmedEmail, userId]
      );
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: `Email '${trimmedEmail}' is already registered with another account.`,
        });
      }
    }

    // Password verification flag (to avoid verifying multiple times in the same request)
    let passwordVerified = false;

    // 3. Handle Password Change (if new_password is typed)
    const isChangingPassword = Boolean(new_password && new_password.trim());
    if (isChangingPassword) {
      if (!current_password) {
        return res.status(400).json({
          success: false,
          message: 'Please enter your current password to authorize changing your password.',
        });
      }
      const matches = await bcrypt.compare(current_password, user.password_hash);
      if (!matches) {
        return res.status(400).json({ success: false, message: 'Incorrect current password.' });
      }
      passwordVerified = true;

      if (new_password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long.',
        });
      }
      if (confirm_password && new_password !== confirm_password) {
        return res.status(400).json({ success: false, message: 'New passwords do not match.' });
      }

      const newPassHash = await bcrypt.hash(new_password, 10);
      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newPassHash, userId]);
    }

    // 4. Handle Security Question & Answer Change (if security_answer is entered)
    const isUpdatingSecurity = Boolean(security_answer && security_answer.trim());
    if (isUpdatingSecurity) {
      if (!passwordVerified) {
        if (!current_password) {
          return res.status(400).json({
            success: false,
            message: 'Please enter your current password to save the new security question & answer.',
          });
        }
        const matches = await bcrypt.compare(current_password, user.password_hash);
        if (!matches) {
          return res.status(400).json({ success: false, message: 'Incorrect current password.' });
        }
        passwordVerified = true;
      }

      const questionToSave = security_question?.trim() || user.security_question || "What is your father's name?";
      const normalizedAnswer = String(security_answer).trim().toLowerCase();
      const ansHash = await bcrypt.hash(normalizedAnswer, 10);

      await db.query(
        'UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?',
        [questionToSave, ansHash, userId]
      );
    } else if (security_question && security_question.trim() && security_question.trim() !== user.security_question) {
      // Just updating the question wording without resetting answer hash
      await db.query(
        'UPDATE users SET security_question = ? WHERE id = ?',
        [security_question.trim(), userId]
      );
    }

    // 5. Update Profile Details (Full Name, Username, Email)
    await db.query(
      'UPDATE users SET full_name = ?, username = ?, email = ? WHERE id = ?',
      [full_name?.trim() || null, trimmedUsername, trimmedEmail, userId]
    );

    // 6. Fetch updated user details & sign fresh JWT
    const updatedUser = await db.queryOne(
      'SELECT id, username, email, role, full_name, security_question FROM users WHERE id = ?',
      [userId]
    );

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
      message: 'All Admin Profile & Security settings updated successfully!',
      token,
      user: updatedUser,
    });
  } catch (err) {
    console.error('[authController.updateAllAdminSettings]', err);
    return res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
}

const STANDARD_SECURITY_QUESTIONS = [
  "What is your father's name?",
  "What is your favorite pet's name?",
  "What is your mother's maiden or childhood name?",
  "What was the name of your first school?",
  "In which city or village were you born?",
  "What was your first vehicle, car, or favorite bike?",
  "What was your childhood nickname?",
  "What is your favorite childhood friend's name?",
  "Custom secret question",
];

/**
 * POST /api/auth/get-security-question
 * Step 1 of password recovery: Fetch the admin's secret question
 */
async function getSecurityQuestion(req, res) {
  const { identifier } = req.body || {};

  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ success: false, message: 'Username or registered email is required.' });
  }

  try {
    const user = await db.queryOne(
      'SELECT id, username, email, security_question, security_answer_hash FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier.trim(), identifier.trim()]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No administrator account found with that username or email.',
      });
    }

    if (user.security_question && user.security_answer_hash) {
      return res.json({
        success: true,
        has_question: true,
        question: user.security_question,
        username: user.username,
      });
    }

    // If user has not yet configured a question, provide the list of standard questions to pick and answer
    return res.json({
      success: true,
      has_question: false,
      available_questions: STANDARD_SECURITY_QUESTIONS,
      username: user.username,
      message: 'No security question set yet. Please select a question and answer to secure your account.',
    });
  } catch (err) {
    console.error('[authController.getSecurityQuestion]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve security question.' });
  }
}

/**
 * POST /api/auth/reset-password-with-security-answer
 * Step 2 of password recovery: Validate secret answer and reset password
 */
async function resetPasswordWithSecurityAnswer(req, res) {
  const { identifier, security_answer, new_password, confirm_password, chosen_question } = req.body || {};

  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ success: false, message: 'Username or registered email is required.' });
  }

  if (!security_answer || !security_answer.trim()) {
    return res.status(400).json({ success: false, message: 'Secret answer is required.' });
  }

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
  }

  if (confirm_password && new_password !== confirm_password) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  try {
    const user = await db.queryOne(
      'SELECT id, username, email, password_hash, security_question, security_answer_hash FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier.trim(), identifier.trim()]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Administrator account not found.' });
    }

    const normalizedAnswer = String(security_answer).trim().toLowerCase();

    // If user already has a saved answer hash, verify it
    if (user.security_answer_hash) {
      const isMatch = await bcrypt.compare(normalizedAnswer, user.security_answer_hash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Incorrect secret answer. Please verify and try again.',
        });
      }
    } else {
      // First time initialization via recovery
      const questionToSave = chosen_question || "What is your father's name?";
      const ansHash = await bcrypt.hash(normalizedAnswer, 10);
      await db.query(
        'UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?',
        [questionToSave, ansHash, user.id]
      );
    }

    // Hash new password and update user
    const newHash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    return res.json({
      success: true,
      message: `Password for ${user.username} has been securely reset! You can now log in.`,
    });
  } catch (err) {
    console.error('[authController.resetPasswordWithSecurityAnswer]', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
}

/**
 * GET /api/auth/security-question
 * Authenticated: Get current user's configured security question
 */
async function getAdminSecurityQuestion(req, res) {
  try {
    const user = await db.queryOne(
      'SELECT id, username, security_question, security_answer_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      security_question: user.security_question || '',
      has_answer: !!user.security_answer_hash,
      available_questions: STANDARD_SECURITY_QUESTIONS,
    });
  } catch (err) {
    console.error('[authController.getAdminSecurityQuestion]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch security question.' });
  }
}

/**
 * PUT /api/auth/security-question
 * Authenticated: Update security question and secret answer
 */
async function updateAdminSecurityQuestion(req, res) {
  const { security_question, security_answer, current_password } = req.body || {};

  if (!security_question || !security_question.trim()) {
    return res.status(400).json({ success: false, message: 'Security question is required.' });
  }

  if (!security_answer || !security_answer.trim()) {
    return res.status(400).json({ success: false, message: 'Secret answer is required.' });
  }

  if (!current_password) {
    return res.status(400).json({ success: false, message: 'Current password is required to save security question.' });
  }

  try {
    const user = await db.queryOne(
      'SELECT id, username, password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Normalize and hash secret answer
    const normalizedAnswer = String(security_answer).trim().toLowerCase();
    const answerHash = await bcrypt.hash(normalizedAnswer, 10);

    await db.query(
      'UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?',
      [security_question.trim(), answerHash, user.id]
    );

    return res.json({
      success: true,
      message: 'Password recovery security question and secret answer saved successfully!',
    });
  } catch (err) {
    console.error('[authController.updateAdminSecurityQuestion]', err);
    return res.status(500).json({ success: false, message: 'Failed to update security question.' });
  }
}

module.exports = {
  login,
  me,
  updateProfile,
  changePassword,
  updateAllAdminSettings,
  getSecurityQuestion,
  resetPasswordWithSecurityAnswer,
  getAdminSecurityQuestion,
  updateAdminSecurityQuestion,
  // Backward compatibility alias
  forgotPassword: resetPasswordWithSecurityAnswer,
};
