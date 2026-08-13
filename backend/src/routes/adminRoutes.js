const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getKycQueue,
  getKycDetail,
  reviewKyc,
  getOverview,
  getUsers,
  getUserDetail,
  getRides,
  getRideDetail,
  adminCancelRide,
  getOrders,
  getOrderDetail,
  getRevenue,
  getPayoutSummary,
  getPayoutDetail,
  markPayoutsPaid
} = require('../controllers/adminController');

router.use(protect, authorize('admin'));

router.get('/overview', getOverview);
router.get('/revenue', getRevenue);
router.get('/payouts', getPayoutSummary);
router.get('/payouts/:recipientId', getPayoutDetail);
router.patch('/payouts/:recipientId/mark-paid', markPayoutsPaid);
router.get('/kyc/queue', getKycQueue);
router.get('/kyc/:userId', getKycDetail);
router.patch('/kyc/:userId', reviewKyc);

router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);

router.get('/rides', getRides);
router.get('/rides/:id', getRideDetail);
router.patch('/rides/:id/cancel', adminCancelRide);

router.get('/orders', getOrders);
router.get('/orders/:id', getOrderDetail);

module.exports = router;
