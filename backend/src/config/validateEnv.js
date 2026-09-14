// Fails fast on boot if required production config is missing, instead
// of starting successfully and then behaving wrong in ways that are
// hard to trace back to a missing env var (the Paystack live-key
// fallback found during the codebase audit is exactly this kind of
// bug — "starts fine, quietly does the wrong thing"). This is the
// server-side equivalent of that fix: refuse to start rather than run
// in a broken, hard-to-diagnose state.
//
// Split into two tiers:
//   REQUIRED  — the app cannot function at all without these; the
//               process exits immediately with a clear message.
//   RECOMMENDED — features that already degrade gracefully when
//               missing (see distance.js/locationController.js for
//               GOOGLE_MAPS_API_KEY, sendEmail.js for RESEND_API_KEY)
//               but silently losing them in production is still worth
//               a loud warning, not silence.
const REQUIRED_VARS = [
  { name: 'MONGO_URI', why: 'the database connection string' },
  { name: 'JWT_ACCESS_SECRET', why: 'signs access tokens — without it, no login can work' },
  { name: 'JWT_REFRESH_SECRET', why: 'signs refresh tokens' },
  { name: 'PAYSTACK_SECRET_KEY', why: 'verifies every payment server-side — without it, no payment can ever be confirmed as real' }
];

const RECOMMENDED_VARS = [
  { name: 'RESEND_API_KEY', why: 'password reset emails will silently fail to send without it' },
  { name: 'GOOGLE_MAPS_API_KEY', why: 'address autocomplete/geocoding falls back to straight-line distance without it — works, but degraded' },
  { name: 'APP_RESET_URL', why: 'password reset emails will omit the deep link without it' },
  { name: 'SENTRY_DSN', why: 'errors and crashes will only ever show up in server logs, with no alerting, until this is set' }
];

function validateEnv() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v.name] || !process.env[v.name].trim());

  if (missing.length > 0) {
    console.error('');
    console.error('❌ Cannot start — missing required environment variable(s):');
    missing.forEach((v) => console.error(`   ${v.name} — ${v.why}`));
    console.error('');
    console.error('Set these in your .env file (or your deployment platform\'s environment');
    console.error('variable settings) and restart.');
    console.error('');
    process.exit(1);
  }

  // Same live/test-key mismatch class of bug fixed on the mobile side
  // (see mobile/src/utils/paystackConfig.ts) — catch it here too, since
  // a backend running with a test secret key while the mobile app uses
  // a live public key (or vice versa) means every payment verification
  // silently fails, which looks exactly like "payments aren't
  // reflecting" from the report this whole audit started from.
  const paystackKey = process.env.PAYSTACK_SECRET_KEY || '';
  if (paystackKey && !paystackKey.startsWith('sk_test_') && !paystackKey.startsWith('sk_live_')) {
    console.warn('');
    console.warn('⚠️  PAYSTACK_SECRET_KEY doesn\'t look like a real Paystack secret key');
    console.warn('   (expected it to start with sk_test_ or sk_live_). Payment verification');
    console.warn('   will fail for every transaction until this is corrected.');
    console.warn('');
  }

  const missingRecommended = RECOMMENDED_VARS.filter((v) => !process.env[v.name] || !process.env[v.name].trim());
  if (missingRecommended.length > 0) {
    console.warn('');
    console.warn('⚠️  Starting without recommended environment variable(s):');
    missingRecommended.forEach((v) => console.warn(`   ${v.name} — ${v.why}`));
    console.warn('');
  }
}

module.exports = validateEnv;
