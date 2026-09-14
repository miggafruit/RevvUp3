// Previously this exact same check was duplicated inline in both
// orderController.payOrder and ehailingController.payRide — this is
// the single most important fraud check in the app (it's what stops
// someone from paying R1 for a R1100 tow and having it accepted as
// paid), and duplicated logic is a bug waiting to happen: fix it in
// one place, forget the other, and one payment path silently loses
// its protection. Extracting it also makes it directly unit-testable
// without needing to mock Mongoose models for what's really a pure
// arithmetic comparison.
//
// Paystack amounts are always integer cents (avoids the classic
// floating-point cents bug — R11.005 not being reliably representable
// as a float), so both sides of the comparison are rounded to cents
// before comparing, never compared as raw Rand floats.
const amountMatchesExpected = (paystackAmountInCents, expectedRandAmount) => {
  const expectedCents = Math.round(expectedRandAmount * 100);
  return paystackAmountInCents === expectedCents;
};

module.exports = { amountMatchesExpected };
