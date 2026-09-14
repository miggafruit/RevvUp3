import * as Sentry from '@sentry/react';

// Same optional, env-gated pattern as the backend and mobile app.
// Previously there was no error reporting anywhere in the admin
// dashboard — an admin hitting a broken page (e.g. while reviewing
// KYC or processing a payout) had no way to report exactly what broke
// beyond describing it after the fact.
const dsn = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!dsn) {
    console.warn('[Sentry] VITE_SENTRY_DSN not set — error monitoring is OFF.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    sendDefaultPii: false
  });
}

export { Sentry };
