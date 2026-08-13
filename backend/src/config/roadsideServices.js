// Single source of truth — the User schema's roadsideServices enum and
// every place that validates incoming roadsideServices values (registration,
// profile updates) all import this instead of hardcoding their own copy.
// A duplicated copy of this exact list going stale after the sling/rollback
// split is what caused a real bug earlier (one copy still said 'towing').
const VALID_ROADSIDE_SERVICES = [
  'tow_sling',
  'tow_rollback',
  'jump_start',
  'tire_change',
  'fuel_delivery',
  'lockout',
  'other'
];

module.exports = { VALID_ROADSIDE_SERVICES };
