const { estimateTowFare, estimateCalloutFare, TOW_FARE_RULES } = require('../src/config/pricing');

describe('estimateTowFare', () => {
  test('charges the flat local rate at or under the local distance threshold', () => {
    const { tier, fare } = estimateTowFare('tow_sling', TOW_FARE_RULES.tow_sling.localFlatKm);
    expect(tier).toBe('local');
    expect(fare).toBe(TOW_FARE_RULES.tow_sling.localFlatFare);
  });

  test('charges base + per-km once past the local threshold', () => {
    const rule = TOW_FARE_RULES.tow_rollback;
    const distanceKm = rule.localFlatKm + 10;
    const { tier, fare } = estimateTowFare('tow_rollback', distanceKm);
    expect(tier).toBe('outside');
    expect(fare).toBe(Math.round(rule.outsideBase + rule.outsidePerKm * 10));
  });

  test('rollback is always priced higher than sling for the same distance', () => {
    // Encodes a real business fact (rollback trucks cost more to run
    // than a sling tow) as a test, so a future edit that accidentally
    // inverts the two tables gets caught immediately instead of
    // silently undercharging or overcharging.
    for (const distanceKm of [5, 20, 50]) {
      const sling = estimateTowFare('tow_sling', distanceKm).fare;
      const rollback = estimateTowFare('tow_rollback', distanceKm).fare;
      expect(rollback).toBeGreaterThanOrEqual(sling);
    }
  });

  test('throws on a non-tow service type instead of silently mispricing it', () => {
    expect(() => estimateTowFare('jump_start', 10)).toThrow(/non-tow/);
  });
});

describe('estimateCalloutFare', () => {
  test('increases with distance', () => {
    const near = estimateCalloutFare(2);
    const far = estimateCalloutFare(20);
    expect(far).toBeGreaterThan(near);
  });

  test('never returns a negative or non-numeric fare', () => {
    expect(estimateCalloutFare(0)).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(estimateCalloutFare(0))).toBe(true);
  });
});
