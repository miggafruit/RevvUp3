const { amountMatchesExpected } = require('../src/utils/paymentVerification');

describe('amountMatchesExpected', () => {
  test('matches when the Paystack cents amount exactly equals the expected Rand amount', () => {
    // R1100.00 -> 110000 cents, matching the payout-mismatch bug this
    // whole audit started from (driver credited R350 for an R1100 job).
    expect(amountMatchesExpected(110000, 1100)).toBe(true);
  });

  test('rejects an underpayment', () => {
    // The exact fraud scenario this check exists to prevent: paying
    // R1 for a job that should cost R1100.
    expect(amountMatchesExpected(100, 1100)).toBe(false);
  });

  test('rejects an overpayment too, not just underpayment', () => {
    expect(amountMatchesExpected(999999, 1100)).toBe(false);
  });

  test('handles Rand amounts with cents correctly, not just whole Rand', () => {
    expect(amountMatchesExpected(35050, 350.5)).toBe(true);
    expect(amountMatchesExpected(35049, 350.5)).toBe(false);
  });

  test('does not fall prey to floating-point rounding errors', () => {
    // Classic float trap: 0.1 + 0.2 !== 0.3 in IEEE754. A naive
    // Math.round(rand * 100) can drift by a cent on certain values if
    // not handled carefully — this locks in that it doesn't.
    expect(amountMatchesExpected(10, 0.1)).toBe(true);
    expect(amountMatchesExpected(30, 0.1 + 0.2)).toBe(true);
  });
});
