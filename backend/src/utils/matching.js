const User = require('../models/User');

const TEST_MODE = process.env.MATCHING_TEST_MODE === 'true';

const SELECT_FIELDS = 'name phone vehicleDetails currentLocation roadsideServices pushToken';

/**
 * Shared geo-search core — finds User documents matching baseFilter
 * within radiusKm of a point, with an expanding-radius fallback (if
 * nobody's within the requested radius, try progressively wider before
 * giving up), and a TEST_MODE bypass that skips geo-filtering entirely.
 * Both roadside and delivery matching build on this; only the
 * eligibility filter (roadsideServices vs. isDriver) differs between
 * them.
 */
const findNearbyMatching = async (baseFilter, point, radiusKm) => {
  if (TEST_MODE) {
    // TESTING ONLY — skips geo-filtering entirely, matching any capable,
    // available driver regardless of distance. This exists because
    // realistic GPS positions are hard to simulate on a laptop (your
    // driver and client accounts are probably in the same room, or one
    // of them is on an emulator with a default/fake location that isn't
    // anywhere near the other). Enabled by MATCHING_TEST_MODE=true in
    // .env — remove that line before publishing. server.js prints a
    // loud warning on every boot while it's set, so it's hard to ship
    // by accident.
    return User.find(baseFilter).select(SELECT_FIELDS);
  }

  // Real geo search, with an expanding-radius fallback: if nobody's
  // within the requested radius, try progressively wider before giving
  // up entirely. This isn't a testing-only concern — a legitimate
  // request shouldn't die just because the nearest capable driver
  // happens to be 16km away when the default search was 15km.
  const radiiToTry = [...new Set([radiusKm, 50, 150])];
  for (const radius of radiiToTry) {
    const results = await User.find({
      ...baseFilter,
      currentLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
          $maxDistance: radius * 1000
        }
      }
    }).select(SELECT_FIELDS);

    if (results.length > 0) return results;
  }

  return [];
};

/**
 * Finds online, available roadside responders who actually offer the
 * requested service type. Deliberately checks roadsideServices, NOT
 * isDriver — isDriver means "delivers shop orders," a different job
 * with different equipment. A delivery driver has no business being
 * dispatched to tow someone; this keeps the two pools separate even
 * though both live on the same User model and share the same
 * currentLocation/isOnline/isAvailable fields.
 */
const findNearbyAvailableDrivers = async (point, radiusKm = 15, serviceType) => {
  const baseFilter = { isOnline: true, isAvailable: true, kycStatus: 'approved' };
  baseFilter.roadsideServices = serviceType
    ? serviceType
    : { $exists: true, $not: { $size: 0 } };
  return findNearbyMatching(baseFilter, point, radiusKm);
};

/**
 * Finds online, available delivery drivers (isDriver: true) near a
 * point — the delivery equivalent of findNearbyAvailableDrivers above.
 * Not currently used by deliveryController — Delivery.js has no
 * pickup coordinates at all (pickupAddress is free text), so there's
 * no point to search from yet. Capturing real shop coordinates would
 * be its own separate task. Kept here, ready for when that exists.
 */
const findNearbyAvailableDeliveryDrivers = async (point, radiusKm = 15) => {
  const baseFilter = { isOnline: true, isAvailable: true, isDriver: true, kycStatus: 'approved' };
  return findNearbyMatching(baseFilter, point, radiusKm);
};

/**
 * What deliveryController actually uses today — every online,
 * available delivery driver, with no distance filtering (there's no
 * shop location to filter by). Still meaningfully narrower than
 * broadcasting to the whole "drivers" socket room, which also includes
 * roadside-only responders who have no business getting notified about
 * a delivery job they can't accept.
 */
const findAvailableDeliveryDrivers = async () => {
  return User.find({ isOnline: true, isAvailable: true, isDriver: true, kycStatus: 'approved' }).select(SELECT_FIELDS);
};

module.exports = {
  findNearbyAvailableDrivers,
  findNearbyAvailableDeliveryDrivers,
  findAvailableDeliveryDrivers,
  TEST_MODE
};
