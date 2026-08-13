const axios = require('axios');
const { haversineDistanceKm } = require('./geo');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

const fallback = (origin, destination) => {
  const distanceKm = haversineDistanceKm(origin, destination);
  const durationMinutes = (distanceKm / 40) * 60; // rough average speed assumption
  return { distanceKm, durationMinutes, source: 'haversine_fallback' };
};

/**
 * Real road distance/ETA via Google Maps, falling back to straight-line
 * distance if GOOGLE_MAPS_API_KEY isn't set or the request fails — so
 * ride requests keep working even without a Maps key configured.
 */
const getDistanceAndDuration = async (origin, destination) => {
  if (!GOOGLE_MAPS_API_KEY) {
    return fallback(origin, destination);
  }

  const params = new URLSearchParams({
    origins: `${origin.latitude},${origin.longitude}`,
    destinations: `${destination.latitude},${destination.longitude}`,
    units: 'metric',
    key: GOOGLE_MAPS_API_KEY
  });

  try {
    const response = await axios.get(`${DISTANCE_MATRIX_URL}?${params.toString()}`);
    const data = response.data;

    const element = data?.rows?.[0]?.elements?.[0];
    if (data.status !== 'OK' || !element || element.status !== 'OK') {
      console.warn('[distance] Distance Matrix returned no route, using fallback', {
        status: data.status,
        elementStatus: element?.status
      });
      return fallback(origin, destination);
    }

    return {
      distanceKm: element.distance.value / 1000,
      durationMinutes: element.duration.value / 60,
      source: 'google_maps'
    };
  } catch (err) {
    console.warn('[distance] Distance Matrix request failed, using fallback', err.message);
    return fallback(origin, destination);
  }
};

module.exports = { getDistanceAndDuration };
