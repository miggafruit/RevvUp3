// Mirrors backend/src/utils/geo.js exactly, so distance/ETA read the
// same way on both ends. Straight-line distance, not a real routed
// distance — good enough for a live "roughly how far" estimate that
// recalculates every few seconds as the driver moves, not meant to
// replace a real Directions-API route.
const toRad = (deg: number) => (deg * Math.PI) / 180;

export const haversineDistanceKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number => {
  const EARTH_RADIUS_KM = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

// Same average-speed assumption as the backend's haversine fallback in
// distance.js, so an ETA shown here is at least internally consistent
// with fare estimates computed server-side.
const ASSUMED_AVERAGE_SPEED_KMH = 40;

export const estimateEtaMinutes = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number => {
  const distanceKm = haversineDistanceKm(from, to);
  return Math.max(1, Math.round((distanceKm / ASSUMED_AVERAGE_SPEED_KMH) * 60));
};
