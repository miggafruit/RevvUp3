const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createInquiry,
  getInquiriesForShop,
  getInquiriesForClient,
  respondToInquiry,
  closeInquiry
} = require('../controllers/inquiryController');

router.post('/', protect, authorize('client'), createInquiry);
router.get('/mine', protect, authorize('shop'), getInquiriesForShop);
router.get('/sent', protect, authorize('client'), getInquiriesForClient);
router.post('/:id/respond', protect, authorize('shop'), respondToInquiry);
router.patch('/:id/close', protect, authorize('shop'), closeInquiry);

module.exports = router;
