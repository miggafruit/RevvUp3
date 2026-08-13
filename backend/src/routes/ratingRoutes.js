const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { createRating, getRatings, getMyRatingsForOrder } = require('../controllers/ratingController');

router.get('/', getRatings); // public
router.get('/mine', protect, authorize('client'), getMyRatingsForOrder);
router.post('/', protect, authorize('client'), createRating);

module.exports = router;
