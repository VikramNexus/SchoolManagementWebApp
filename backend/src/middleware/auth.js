/**
 * JWT Authentication Middleware — School Management System
 *
 * Day 3: Authentication & Security.
 *
 * Verifies the Bearer token sent in the Authorization header, attaches the
 * decoded user payload to `req.user`, and rejects unauthenticated requests
 * with a 401. Optionally enforces a minimum role when passed a `role` arg.
 *
 * Usage:
 *   app.use('/api/students', authenticateToken, studentRoutes);     // any logged-in user
 *   app.use('/api/admin', authenticateToken('admin'), adminRoutes); // admin only
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_to_a_long_random_secret';

/**
 * Extract and verify the JWT from the Authorization header.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // Distinguish expired vs malformed for clearer client messaging.
      const message =
        err.name === 'TokenExpiredError'
          ? 'Session expired. Please log in again.'
          : 'Invalid authentication token.';
      return res.status(401).json({ success: false, message });
    }

    // Attach the decoded payload (id, username, role) to the request.
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };
    next();
  });
}

/**
 * Role-restricted variant factory.
 * @param {string} requiredRole - e.g. 'admin'
 * @returns {import('express').RequestHandler}
 */
function authorizeRole(requiredRole) {
  return (req, res, next) => {
    authenticateToken(req, res, () => {
      if (req.user.role !== requiredRole) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
        });
      }
      next();
    });
  };
}

module.exports = { authenticateToken, authorizeRole, JWT_SECRET };
