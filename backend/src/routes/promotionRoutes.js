const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createPromotion,
  payPromotion,
  getPromotions,
  getMyPromotions,
  getActiveSellerIds,
  getPromotionById
} = require('../controllers/promotionController');

// Specific paths before '/:id' so Express doesn't try to parse them as an id
router.get('/mine', protect, authorize('shop', 'service_provider'), getMyPromotions);
router.get('/active-seller-ids', getActiveSellerIds);
router.get('/:id', protect, getPromotionById);
router.get('/', getPromotions);

router.post('/', protect, authorize('shop', 'service_provider'), createPromotion);
router.post('/:id/pay', protect, authorize('shop', 'service_provider'), payPromotion);

module.exports = router;