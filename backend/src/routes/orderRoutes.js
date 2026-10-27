const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getCheckoutQuote,
  checkout,
  getMyOrders,
  getIncomingOrders,
  getOrderById,
  updateOrderStatus,
  completeServiceOrder,
  confirmServiceOrder,
  payOrder
} = require('../controllers/orderController');

router.post('/delivery-quote', protect, authorize('client'), getCheckoutQuote);
router.post('/checkout', protect, authorize('client'), checkout);
router.get('/mine', protect, authorize('client'), getMyOrders);
router.get('/incoming', protect, authorize('shop', 'service_provider'), getIncomingOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/status', protect, authorize('shop', 'service_provider'), updateOrderStatus);
router.patch('/:id/complete', protect, authorize('shop', 'service_provider'), completeServiceOrder);
router.post('/:id/confirm', protect, authorize('client'), confirmServiceOrder);
router.post('/:id/pay', protect, authorize('client'), payOrder);

module.exports = router;