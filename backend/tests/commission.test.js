const { applyCommission, PLATFORM_COMMISSION_RATE } = require('../src/config/commission');

describe('applyCommission', () => {
  test('at the current 0% rate, payoutAmount equals grossAmount exactly', () => {
    // This is the test that would catch the exact class of bug this
    // whole audit started from: a driver/seller getting paid the wrong
    // amount. At 0% commission (today's real config), nobody should
    // ever be paid less than the full gross amount.
    expect(PLATFORM_COMMISSION_RATE).toBe(0);
    const result = applyCommission(1100);
    expect(result.payoutAmount).toBe(1100);
    expect(result.platformCut).toBe(0);
    expect(result.grossAmount).toBe(1100);
  });

  test('payoutAmount + platformCut always reconciles back to grossAmount', () => {
    // Guards against rounding-related drift — the ledger has to add
    // up exactly, or the platform's own numbers can't be trusted.
    const amounts = [1100, 350.5, 99.99, 1, 12345.67];
    for (const gross of amounts) {
      const { payoutAmount, platformCut } = applyCommission(gross);
      expect(Math.round((payoutAmount + platformCut) * 100) / 100).toBe(gross);
    }
  });

  test('handles zero gracefully', () => {
    const result = applyCommission(0);
    expect(result.payoutAmount).toBe(0);
    expect(result.platformCut).toBe(0);
  });
});
