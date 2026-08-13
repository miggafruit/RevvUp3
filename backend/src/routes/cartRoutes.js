const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getCart, addItemToCart, updateCartItem, removeCartItem, clearCart } = require('../controllers/cartController');

router.use(protect, authorize('client'));

router.get('/', getCart);
router.post('/items', addItemToCart);
router.put('/items/:cartItemId', updateCartItem);
router.delete('/items/:cartItemId', removeCartItem);
router.delete('/', clearCart);

module.exports = router;
