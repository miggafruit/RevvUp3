const validateEnv = require('../src/config/validateEnv');

describe('validateEnv', () => {
  const REQUIRED = {
    MONGO_URI: 'mongodb://localhost/test',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    PAYSTACK_SECRET_KEY: 'sk_test_abc123'
  };

  let originalEnv;
  let exitSpy;
  let errorSpy;
  let warnSpy;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Never actually let this test suite kill the Jest process.
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test('exits the process when a required var is missing', () => {
    process.env = { ...REQUIRED };
    delete process.env.MONGO_URI;

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  test('does not exit when every required var is present', () => {
    process.env = { ...REQUIRED };

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('warns (but does not exit) when a Paystack key does not look real', () => {
    // This is the server-side twin of the mobile Paystack fix — a key
    // that doesn't start with sk_test_/sk_live_ silently breaks every
    // payment verification without anyone necessarily noticing until a
    // customer complains that payments "aren't reflecting."
    process.env = { ...REQUIRED, PAYSTACK_SECRET_KEY: 'not-a-real-key' };

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    const warnedAboutKey = warnSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('PAYSTACK_SECRET_KEY'))
    );
    expect(warnedAboutKey).toBe(true);
  });

  test('warns but does not exit when only recommended vars are missing', () => {
    process.env = { ...REQUIRED }; // RESEND_API_KEY, GOOGLE_MAPS_API_KEY, etc. absent

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
