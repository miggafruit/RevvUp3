const express = require('express');
const router = express.Router();
const { getShops, getShopById, getProviders, getProviderById } = require('../controllers/businessController');

router.get('/shops', getShops);
router.get('/shops/:id', getShopById);
router.get('/providers', getProviders);
router.get('/providers/:id', getProviderById);

module.exports = router;
