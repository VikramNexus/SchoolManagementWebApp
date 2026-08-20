const express = require('express');
const {
  login,
  me,
  updateProfile,
  changePassword,
  forgotPassword,
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public: login & forgot password
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// Protected: fetch user, update profile, change password
router.get('/me', authenticateToken, me);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);

module.exports = router;
