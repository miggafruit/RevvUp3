const tp = () => {
  jest.resetModules();
  return require('../src/utils/testPayments');
};

describe('test payments gate', () => {
  afterEach(() => {
    delete process.env.ALLOW_TEST_PAYMENTS;
    delete process.env.TEST_PAYMENT_EMAILS;
  });

  test('off by default', () => {
    expect(tp().isTestPaymentsEnabled()).toBe(false);
    expect(tp().isTestPaymentAllowedFor({ email: 'a@b.com' })).toBe(false);
  });

  test('flag without allowlist stays off', () => {
    process.env.ALLOW_TEST_PAYMENTS = 'true';
    expect(tp().isTestPaymentsEnabled()).toBe(false);
  });

  test('only allowlisted emails (case-insensitive) are allowed', () => {
    process.env.ALLOW_TEST_PAYMENTS = 'true';
    process.env.TEST_PAYMENT_EMAILS = 'Me@Gmail.com, other@x.com';
    const m = tp();
    expect(m.isTestPaymentAllowedFor({ email: 'me@gmail.com' })).toBe(true);
    expect(m.isTestPaymentAllowedFor({ email: 'stranger@gmail.com' })).toBe(false);
    expect(m.isTestPaymentAllowedFor(null)).toBe(false);
  });

  test('builds a verification matching amount and metadata', () => {
    const v = tp().buildTestVerification('orderId', 'abc', 150.5);
    expect(v).toEqual({ status: 'success', amount: 15050, metadata: { orderId: 'abc' } });
    expect(tp().isTestReference('TEST_123')).toBe(true);
    expect(tp().isTestReference('T123')).toBe(false);
  });
});
