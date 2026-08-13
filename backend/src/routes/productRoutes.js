const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getMyProducts,
  getProducts,
  getProductById
} = require('../controllers/productController');

// Public browsing
router.get('/', getProducts);

// Shop-only management (must come before /:id to avoid "mine" being treated as an id)
router.get('/mine', protect, authorize('shop'), getMyProducts);
router.post('/', protect, authorize('shop'), createProduct);
router.put('/:id', protect, authorize('shop'), updateProduct);
router.delete('/:id', protect, authorize('shop'), deleteProduct);

// Public detail (after /mine so it doesn't shadow it)
router.get('/:id', getProductById);

module.exports = router;
