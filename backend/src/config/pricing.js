// Tow truck pricing — sling and rollback are priced independently, and
// the client picks which one they want directly (sling isn't offered
// at all for automatic cars, since it physically can't tow one — see
// ehailingController.createRequest's transmission/service-type check).
// Distance is pickup-to-delivery-point, matching how a real tow is
// priced (what you're paying for is how far your car gets towed, not
// how far the truck had to drive to reach you).
const TOW_FARE_RULES = {
  tow_sling: { localFlatKm: 20, localFlatFare: 950, outsideBase: 1100, outsidePerKm: 25 },
  tow_rollback: { localFlatKm: 20, localFlatFare: 1100, outsideBase: 1400, outsidePerKm: 40 }
};

/**
 * serviceType must be 'tow_sling' or 'tow_rollback' — anything else
 * throws, since this function is only ever called for tow requests
 * (other roadside services use their own driver-to-client distance
 * logic in ehailingController, not a fixed price table).
 */
const estimateTowFare = (serviceType, distanceKm) => {
  const rule = TOW_FARE_RULES[serviceType];
  if (!rule) {
    throw new Error(`estimateTowFare called with a non-tow serviceType: "${serviceType}"`);
  }

  if (distanceKm <= rule.localFlatKm) {
    return { tier: 'local', fare: rule.localFlatFare };
  }

  const extraKm = distanceKm - rule.localFlatKm;
  const fare = rule.outsideBase + rule.outsidePerKm * extraKm;
  return { tier: 'outside', fare: Math.round(fare) };
};

// PLACEHOLDER — no real rates given yet for jump-starts/tire changes/
// fuel delivery/lockouts. Unlike towing, distance here is driver-to-
// client (how far the responder has to travel to reach you), not
// pickup-to-destination, since these are fixed-in-place "come to me"
// jobs with no destination at all. Replace with real numbers once
// they're defined — this only exists so acceptRequest doesn't crash
// on a service type that isn't towing.
const CALLOUT_FARE_RULES = { base: 350, perKm: 15 };
const estimateCalloutFare = (distanceKm) =>
  Math.round(CALLOUT_FARE_RULES.base + CALLOUT_FARE_RULES.perKm * distanceKm);

module.exports = { TOW_FARE_RULES, estimateTowFare, estimateCalloutFare };
