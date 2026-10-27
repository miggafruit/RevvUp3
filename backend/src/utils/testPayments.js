// TEMPORARY testing aid — lets specific tester accounts "pay" without a real
// Paystack charge, so the full flow (accept -> pay -> dispatch -> tracking)
// can be exercised on the live deployment without money moving.
//
// Safe by construction: it is OFF unless BOTH env vars are set on the server:
//   ALLOW_TEST_PAYMENTS=true
//   TEST_PAYMENT_EMAILS=you@gmail.com,tester2@gmail.com   (allowlist)
// Only logged-in users whose email is on that list can use it, and only with
// a reference starting "TEST_". Everyone else always goes through real
// Paystack verification. To go to production: delete both env vars on Render
// (the feature disappears instantly; the app button hides itself).
const TEST_PREFIX = 'TEST_';

const allowedEmails = () =>
  (process.env.TEST_PAYMENT_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const isTestPaymentsEnabled = () =>
  process.env.ALLOW_TEST_PAYMENTS === 'true' && allowedEmails().length > 0;

const isTestPaymentAllowedFor = (user) =>
  isTestPaymentsEnabled() && !!user?.email && allowedEmails().includes(user.email.toLowerCase());

const isTestReference = (ref) => typeof ref === 'string' && ref.startsWith(TEST_PREFIX);

// Mimics the shape of a successful Paystack verification so the existing
// metadata + amount checks in the controllers still run unchanged.
const buildTestVerification = (metadataKey, id, amountRand) => ({
  status: 'success',
  amount: Math.round(amountRand * 100),
  metadata: { [metadataKey]: String(id) }
});

module.exports = {
  isTestPaymentsEnabled,
  isTestPaymentAllowedFor,
  isTestReference,
  buildTestVerification
};
