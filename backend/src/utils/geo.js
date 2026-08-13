const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Straight-line distance in kilometers between two coordinates. Used as
 * the fallback when GOOGLE_MAPS_API_KEY isn't configured (see distance.js)
 * and as the only method until you add real road-distance/ETA.
 */
const haversineDistanceKm = (a, b) => {
  const EARTH_RADIUS_KM = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

module.exports = { haversineDistanceKm };
