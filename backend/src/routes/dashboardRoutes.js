const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// These are placeholder endpoints confirming role-based access works.
// Real dashboard data/logic will be built out later.

router.get('/client', protect, authorize('client'), (req, res) => {
  res.status(200).json({ message: `Welcome to the client dashboard, ${req.user.name}`, user: req.user.toSafeObject() });
});

router.get('/service-provider', protect, authorize('service_provider'), (req, res) => {
  res.status(200).json({ message: `Welcome to the service provider dashboard, ${req.user.name}`, user: req.user.toSafeObject() });
});

router.get('/shop', protect, authorize('shop'), (req, res) => {
  res.status(200).json({ message: `Welcome to the shop dashboard, ${req.user.name}`, user: req.user.toSafeObject() });
});

module.exports = router;
