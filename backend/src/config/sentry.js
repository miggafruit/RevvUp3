// Error monitoring — previously flagged as a production gap: nothing
// anywhere reported errors, so a payment silently failing or a crash
// on a specific code path would only ever be discovered if a user
// complained. This has to be required and initialized before
// anything else in the app (routes, express app itself), since
// Sentry's request/error instrumentation wraps Node's own http module.
//
// SENTRY_DSN is optional — same pattern as the rest of this codebase's
// third-party integrations (Paystack, Maps, Resend): if it's not set,
// this no-ops instead of crashing the server, so local dev and any
// environment that hasn't set up Sentry yet keeps working exactly as
// before. It's listed as a RECOMMENDED (not REQUIRED) var in
// validateEnv.js for the same reason.
const Sentry = require('@sentry/node');

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Fraction of requests to trace for performance monitoring, not
    // just errors. 0.2 (20%) is a reasonable default that gives real
    // signal without the cost/volume of tracing every single request
    // — tune via SENTRY_TRACES_SAMPLE_RATE once you have a sense of
    // actual traffic.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.2,
    // Never send request bodies — this API handles passwords, banking
    // details, and ID document images. Sentry gets stack traces and
    // request metadata (method, route, status), not payloads.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    }
  });
  console.log('[Sentry] Error monitoring enabled');
} else {
  console.warn('[Sentry] SENTRY_DSN not set — error monitoring is OFF. Set SENTRY_DSN to enable it.');
}

module.exports = Sentry;
