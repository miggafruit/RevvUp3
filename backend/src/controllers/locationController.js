const axios = require('axios');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const PLACES_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

/**
 * GET /api/location/search?query=...&latitude=...&longitude=...
 * Places Autocomplete, optionally biased toward a location (e.g. the
 * requester's own GPS position, so nearby matches rank higher even
 * though they're searching for someone else's address).
 */
const searchPlaces = async (req, res, next) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ success: false, message: 'Location search is not configured on this server.' });
    }

    const { query, latitude, longitude } = req.query;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'A search query is required.' });
    }

    const params = { input: query, key: GOOGLE_MAPS_API_KEY };
    if (latitude != null && longitude != null) {
      params.location = `${latitude},${longitude}`;
      params.radius = 50000;
    }

    const { data } = await axios.get(PLACES_AUTOCOMPLETE_URL, { params });

    // TEMPORARY diagnostic — remove once this is sorted out. Prints
    // Google's actual response status directly to the backend
    // terminal, since a frontend error message alone can't distinguish
    // "genuinely zero matches" from "the key/API/billing is misconfigured"
    // without seeing what Google itself said.
    console.log('[location search] query:', query, '| Google status:', data.status, '| error_message:', data.error_message || '(none)');

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ success: false, message: `Places search error: ${data.status}` });
    }

    const predictions = (data.predictions || []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text,
      secondaryText: p.structured_formatting?.secondary_text
    }));

    return res.json({ success: true, data: predictions });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/location/place/:placeId
 * Resolves an Autocomplete placeId to full lat/lng + formatted address.
 */
const getPlaceDetails = async (req, res, next) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ success: false, message: 'Location search is not configured on this server.' });
    }

    const { placeId } = req.params;
    const { data } = await axios.get(PLACE_DETAILS_URL, {
      params: { place_id: placeId, fields: 'formatted_address,geometry', key: GOOGLE_MAPS_API_KEY }
    });

    if (data.status !== 'OK') {
      return res.status(502).json({ success: false, message: `Place details error: ${data.status}` });
    }

    const { formatted_address, geometry } = data.result;
    return res.json({
      success: true,
      data: {
        address: formatted_address,
        latitude: geometry.location.lat,
        longitude: geometry.location.lng
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/location/reverse-geocode?latitude=...&longitude=...
 * Turns raw GPS coordinates into a human-readable address — used to
 * label the requester's current location before they've searched for
 * anything, so they see a real street address rather than a generic
 * "Current location" placeholder or raw numbers.
 */
const reverseGeocode = async (req, res, next) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ success: false, message: 'Location search is not configured on this server.' });
    }

    const { latitude, longitude } = req.query;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required.' });
    }

    const { data } = await axios.get(GEOCODE_URL, {
      params: { latlng: `${latitude},${longitude}`, key: GOOGLE_MAPS_API_KEY }
    });

    if (data.status !== 'OK' || !data.results?.length) {
      return res.status(502).json({ success: false, message: `Geocoding error: ${data.status}` });
    }

    return res.json({ success: true, data: { address: data.results[0].formatted_address } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/location/directions?originLat=&originLng=&destLat=&destLng=
 * Real road route between two points — used to draw an actual routed
 * line on a driver's map instead of a straight line drawn directly
 * between two coordinates, which ignores roads entirely.
 */
const getDirections = async (req, res, next) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ success: false, message: 'Directions are not configured on this server.' });
    }

    const { originLat, originLng, destLat, destLng } = req.query;
    if ([originLat, originLng, destLat, destLng].some((v) => v == null)) {
      return res.status(400).json({ success: false, message: 'origin and destination coordinates are required.' });
    }

    const { data } = await axios.get(DIRECTIONS_URL, {
      params: {
        origin: `${originLat},${originLng}`,
        destination: `${destLat},${destLng}`,
        key: GOOGLE_MAPS_API_KEY
      }
    });

    if (data.status !== 'OK' || !data.routes?.length) {
      return res.status(502).json({ success: false, message: `Directions error: ${data.status}` });
    }

    const route = data.routes[0];
    return res.json({
      success: true,
      data: {
        encodedPolyline: route.overview_polyline.points,
        distanceMeters: route.legs?.[0]?.distance?.value,
        durationSeconds: route.legs?.[0]?.duration?.value
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/location/geocode?address=...
 * Forward geocoding — address text to coordinates. The reverse of
 * reverseGeocode above, same underlying Google Geocoding API endpoint,
 * just the `address` param instead of `latlng`. Needed because
 * Delivery.js only ever stores dropoffAddress as free text, with no
 * coordinates captured anywhere — this is what lets a delivery's
 * tracking screen compute a real ETA/route to that address at all.
 */
const geocodeAddress = async (req, res, next) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ success: false, message: 'Location search is not configured on this server.' });
    }

    const { address } = req.query;
    if (!address || !address.trim()) {
      return res.status(400).json({ success: false, message: 'An address is required.' });
    }

    const { data } = await axios.get(GEOCODE_URL, {
      params: { address, key: GOOGLE_MAPS_API_KEY }
    });

    if (data.status !== 'OK' || !data.results?.length) {
      return res.status(502).json({ success: false, message: `Geocoding error: ${data.status}` });
    }

    const location = data.results[0].geometry.location;
    return res.json({
      success: true,
      data: { latitude: location.lat, longitude: location.lng, formattedAddress: data.results[0].formatted_address }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { searchPlaces, getPlaceDetails, reverseGeocode, getDirections, geocodeAddress };
