// Centralizes the "is a real Maps key configured" check so every map
// screen uses the same logic instead of five separate ad-hoc reads of
// the same env var. Also catches the specific case of the app.json
// plugin config still containing the literal placeholder string
// ("YOUR_GOOGLE_MAPS_API_KEY") that ships in this repo by default —
// that string being present and non-empty would otherwise pass a naive
// "is it set" check while still being completely non-functional.
const PLACEHOLDER_VALUES = ['YOUR_GOOGLE_MAPS_API_KEY', 'your_google_maps_api_key'];

export function hasGoogleMapsKey(): boolean {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || !key.trim()) return false;
  if (PLACEHOLDER_VALUES.includes(key.trim())) return false;
  return true;
}
