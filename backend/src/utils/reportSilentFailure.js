const Sentry = require('../config/sentry');

/**
 * For the specific class of bug this exists to prevent: code that
 * correctly decides a failure shouldn't crash the request it's
 * attached to (a push notification failing shouldn't block an order
 * from completing; a bookkeeping write failing shouldn't undo a
 * successful payment) — but where "don't crash" had, until now, also
 * quietly meant "don't tell anyone." console.warn/console.error alone
 * only exists in server logs nobody is watching in real time. This
 * reports the same error to Sentry (tagged so it's easy to filter to
 * "things that failed silently for users but need a human to go fix
 * the data") while still fully preserving the swallow-don't-throw
 * behavior at the call site — this never throws itself.
 *
 * @param {Error} error
 * @param {string} area - short tag, e.g. 'payouts', 'push-notifications', 'delivery-creation'
 * @param {object} [context] - extra structured data (ids, amounts, etc.) attached to the Sentry event
 */
function reportSilentFailure(error, area, context = {}) {
  try {
    Sentry.captureException(error, {
      tags: { silentFailure: true, area },
      extra: context
    });
  } catch {
    // If Sentry itself somehow throws (misconfigured DSN, network
    // issue reaching Sentry's own servers), that must never become a
    // second failure on top of the first — this function's entire
    // reason to exist is to never be the thing that breaks a request.
  }
}

module.exports = { reportSilentFailure };
