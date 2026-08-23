const express = require('express');
const {
  login,
  me,
  updateProfile,
  changePassword,
  sendForgotPasswordOtp,
  verifyOtpAndResetPassword,
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public: login & forgot password with email OTP verification
router.post('/login', login);
router.post('/forgot-password-otp', sendForgotPasswordOtp);
router.post('/verify-otp-reset', verifyOtpAndResetPassword);
router.post('/reset-password', verifyOtpAndResetPassword);
router.post('/forgot-password', verifyOtpAndResetPassword);

// Protected: fetch user, update profile, change password
router.get('/me', authenticateToken, me);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);

module.exports = router;
