const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getSummary, markSeen, getProgram, payForProgram } = require('../controllers/rewardsController');

router.get('/summary', protect, getSummary);
router.post('/seen', protect, markSeen);
router.get('/program', protect, authorize('shop', 'service_provider'), getProgram);
router.post('/program/pay', protect, authorize('shop', 'service_provider'), payForProgram);

module.exports = router;
