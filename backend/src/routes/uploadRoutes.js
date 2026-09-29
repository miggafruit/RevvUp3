const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getVideoUploadSignature } = require('../controllers/uploadController');

router.get('/video-signature', protect, authorize('shop', 'service_provider'), getVideoUploadSignature);

module.exports = router;
