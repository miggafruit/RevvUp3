const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getPendingDeliveries,
  getMyActiveDelivery,
  acceptDelivery,
  updateDeliveryLocation,
  markPickedUp,
  markDelivered,
  getDeliveryByOrder
} = require('../controllers/deliveryController');

router.get('/pending', protect, authorize('service_provider'), getPendingDeliveries);
router.get('/my-active', protect, authorize('service_provider'), getMyActiveDelivery);
router.post('/:id/accept', protect, authorize('service_provider'), acceptDelivery);
router.post('/:id/location', protect, authorize('service_provider'), updateDeliveryLocation);
router.post('/:id/picked-up', protect, authorize('service_provider'), markPickedUp);
router.post('/:id/delivered', protect, authorize('service_provider'), markDelivered);
router.get('/order/:orderId', protect, getDeliveryByOrder);

module.exports = router;