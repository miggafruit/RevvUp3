const express = require('express');
const router = express.Router();
const {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  resubmitKyc,
  registerPushToken,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateProfile);
router.post('/kyc/resubmit', protect, resubmitKyc);
router.post('/push-token', protect, registerPushToken);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;