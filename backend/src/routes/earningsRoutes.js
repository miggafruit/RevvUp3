const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getSummary } = require('../controllers/earningsController');

router.get('/summary', protect, authorize('shop', 'service_provider'), getSummary);

module.exports = router;
