const express = require('express');
const router = express.Router();
const { searchPlaces, getPlaceDetails, reverseGeocode, getDirections, geocodeAddress } = require('../controllers/locationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/search', searchPlaces);
router.get('/place/:placeId', getPlaceDetails);
router.get('/reverse-geocode', reverseGeocode);
router.get('/geocode', geocodeAddress);
router.get('/directions', getDirections);

module.exports = router;
