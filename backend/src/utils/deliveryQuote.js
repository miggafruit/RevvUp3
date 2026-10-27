const User = require('../models/User');
const httpClient = require('./httpClient');
const { getDistanceAndDuration } = require('./distance');
const { calculateDeliveryFee } = require('../config/deliveryPricing');
const { reportSilentFailure } = require('./reportSilentFailure');

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

class QuoteError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const geocode = async (address) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new QuoteError('Delivery pricing is temporarily unavailable. Please try again later.', 503);
  const { data } = await httpClient.get(GEOCODE_URL, { params: { address, region: 'za', key } });
  if (data.status !== 'OK' || !data.results?.length) {
    throw new QuoteError(`We couldn't find "${address}". Please pick a full street address from the suggestions.`);
  }
  const loc = data.results[0].geometry.location;
  return { latitude: loc.lat, longitude: loc.lng };
};

/**
 * Prices delivery for a set of cart/order items. `items` must carry the
 * product docs (with weightKg) and quantities. Throws QuoteError (with an
 * HTTP status) when it cannot price honestly — never guesses a distance.
 */
const getDeliveryQuote = async ({ productLines, shopId, deliveryAddress }) => {
  if (productLines.length === 0) {
    return { deliveryFee: 0, distanceKm: 0, tier: null, totalWeightKg: 0 };
  }

  // Products listed before weights existed have none; counted as 0 so they
  // fall in Tier 1 rather than blocking the order.
  const totalWeightKg = productLines.reduce((sum, l) => sum + (l.product.weightKg || 0) * l.quantity, 0);

  const shop = await User.findById(shopId).select('businessAddress businessCoords addressVerified');
  if (!shop?.businessAddress) throw new QuoteError('This shop has no pickup address set, so delivery cannot be priced.');

  try {
    const shopCoords = shop.addressVerified && shop.businessCoords?.latitude != null
      ? { latitude: shop.businessCoords.latitude, longitude: shop.businessCoords.longitude }
      : null;
    const [from, to] = await Promise.all([shopCoords || geocode(shop.businessAddress), geocode(deliveryAddress)]);
    const { distanceKm } = await getDistanceAndDuration(from, to);
    const rounded = Math.round(distanceKm * 10) / 10;
    const calc = calculateDeliveryFee(totalWeightKg, rounded);
    return {
      deliveryFee: calc.fee,
      distanceKm: rounded,
      tier: calc.tier,
      tierLabel: calc.tierLabel,
      baseFee: calc.baseFee,
      perKm: calc.perKm,
      totalWeightKg: Math.round(totalWeightKg * 100) / 100
    };
  } catch (err) {
    if (err instanceof QuoteError) throw err;
    reportSilentFailure(err, 'delivery-quote', { shopId: String(shopId) });
    throw new QuoteError('Could not calculate delivery right now. Please try again.', 503);
  }
};

module.exports = { getDeliveryQuote, QuoteError };
