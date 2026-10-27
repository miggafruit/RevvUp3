const { getWeightTier, calculateDeliveryFee } = require('../src/config/deliveryPricing');

describe('delivery tiers', () => {
  test('tier boundaries', () => {
    expect(getWeightTier(0.5).tier).toBe(1);
    expect(getWeightTier(7.99).tier).toBe(1);
    expect(getWeightTier(8).tier).toBe(2);
    expect(getWeightTier(35).tier).toBe(2);
    expect(getWeightTier(35.01).tier).toBe(3);
  });

  test('tier 1: R35 + R5/km', () => {
    expect(calculateDeliveryFee(3, 10).fee).toBe(85);
  });
  test('tier 2: R50 + R7/km', () => {
    expect(calculateDeliveryFee(20, 10).fee).toBe(120);
  });
  test('tier 3: R80 + R10/km', () => {
    expect(calculateDeliveryFee(50, 10).fee).toBe(180);
  });
  test('rounds to the cent', () => {
    expect(calculateDeliveryFee(1, 3.33).fee).toBe(51.65);
  });
});
