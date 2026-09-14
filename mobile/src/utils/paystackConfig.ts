// All three payment screens (orders, ride fares, promotions) previously
// each hardcoded their own fallback of a LIVE Paystack public key
// ("pk_live_...") to use whenever EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY wasn't
// set. That's a serious problem two different ways:
//   1. In a dev/testing build without the env var configured, it
//      silently switches to processing real, live payments instead of
//      failing loudly — the opposite of what you want while testing.
//   2. If the *backend*'s Paystack secret key is a TEST key (as the
//      report's Ozow test-response screenshot indicates it was) while
//      the mobile app is using a LIVE public key, the checkout iframe
//      and the server-side verification are talking to two different
//      Paystack environments. The transaction reference the client gets
//      back would never verify against the backend's test-mode secret
//      key, and the payment would appear to succeed in the browser but
//      never actually mark the order/ride as paid — this matches the
//      "payments are not reflecting and orders remain uncompleted"
//      symptom in the report closely enough to be worth fixing on its
//      own, even without being able to confirm it was the exact cause.
// This exports a getter instead of a bare constant so a missing key
// fails at the moment payment is attempted, with a clear message,
// rather than silently falling back to a real credential.
export function getPaystackPublicKey(): string {
  const key = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      'Payments are not configured — EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY is not set. Contact support.'
    );
  }
  return key.trim();
}
