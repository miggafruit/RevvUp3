import * as Sentry from '@sentry/react-native';

// Same pattern as every other optional third-party integration in
// this app (Maps, Paystack): gated by an env var, no-ops cleanly if
// it isn't set, rather than crashing or silently doing nothing with
// no way to tell. Previously there was no error reporting anywhere in
// the mobile app at all — a crash on a real user's device was
// invisible unless they happened to report it themselves.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) {
    if (__DEV__) {
      console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — error monitoring is OFF.');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,
    // Session Replay is opt-in and off by default here — it captures
    // screen recordings on error, which is powerful for debugging but
    // means being deliberate about privacy (this app shows ID photos,
    // banking details, KYC documents). Turn on only after masking
    // sensitive screens explicitly, not as a default.
    enableAutoSessionTracking: true,
    debug: false
  });
}

export { Sentry };
