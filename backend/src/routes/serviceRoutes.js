const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createService,
  updateService,
  deleteService,
  getMyServices,
  getServices,
  getServiceById
} = require('../controllers/serviceController');

router.get('/', getServices);

router.get('/mine', protect, authorize('service_provider'), getMyServices);
router.post('/', protect, authorize('service_provider'), createService);
router.put('/:id', protect, authorize('service_provider'), updateService);
router.delete('/:id', protect, authorize('service_provider'), deleteService);

router.get('/:id', getServiceById);

module.exports = router;
