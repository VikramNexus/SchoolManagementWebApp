const express = require('express');
const {
  login,
  me,
  updateProfile,
  changePassword,
  updateAllAdminSettings,
  getSecurityQuestion,
  resetPasswordWithSecurityAnswer,
  getAdminSecurityQuestion,
  updateAdminSecurityQuestion,
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public: login & password recovery via security question
router.post('/login', login);
router.post('/get-security-question', getSecurityQuestion);
router.post('/reset-password-security-question', resetPasswordWithSecurityAnswer);
router.post('/forgot-password', resetPasswordWithSecurityAnswer);
router.post('/reset-password', resetPasswordWithSecurityAnswer);

// Protected: fetch user, update profile, change password, security questions
router.get('/me', authenticateToken, me);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);
router.put('/profile-and-security', authenticateToken, updateAllAdminSettings);
router.get('/security-question', authenticateToken, getAdminSecurityQuestion);
router.put('/security-question', authenticateToken, updateAdminSecurityQuestion);

module.exports = router;
