// Flat delivery fee, charged once per order whenever it contains at
// least one physical product (services never trigger delivery at all,
// so never carry this fee).
//
// This is a placeholder value — like TOW_FARE_RULES and
// CALLOUT_FARE_RULES elsewhere in this file, it needs a real number
// from the business, not one I've invented.
//
// It's deliberately flat, not distance-based: Delivery.js doesn't
// store pickup coordinates at all yet (only a free-text address —
// see the comment in deliveryController.createDeliveryForOrder), so a
// real per-km rate isn't something this can compute today. That would
// need capturing real shop coordinates first, which is a separate,
// larger change.
const DELIVERY_FEE = 50;

const getDeliveryFee = (hasProductItems) => (hasProductItems ? DELIVERY_FEE : 0);

module.exports = { DELIVERY_FEE, getDeliveryFee };
