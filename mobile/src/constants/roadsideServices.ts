// Must match User.roadsideServices' enum in the backend model exactly
// (backend/src/models/User.js). Shared between RegisterScreen.tsx and
// RegisterDriverScreen.tsx so there's exactly one place to update if
// these ever change — a duplicated copy of this list is what caused a
// real bug earlier (one copy still had a stale 'towing' value after
// the sling/rollback split, silently breaking registration for it).
export const ROADSIDE_SERVICE_OPTIONS: { value: string; label: string }[] = [
  { value: 'tow_sling', label: 'Towing (Sling)' },
  { value: 'tow_rollback', label: 'Towing (Rollback)' },
  { value: 'jump_start', label: 'Jump Start' },
  { value: 'tire_change', label: 'Tire Change' },
  { value: 'fuel_delivery', label: 'Fuel Delivery' },
  { value: 'lockout', label: 'Lockout Service' },
  { value: 'other', label: 'Other' }
];

// A ride is still "in flight" — not yet completed or cancelled — for
// any of these statuses. Shared between the history screen (deciding
// which items are tappable) and the client screen (auto-detecting an
// existing active request on mount).
export const LIVE_RIDE_STATUSES = ['pending', 'accepted', 'in_progress'];
