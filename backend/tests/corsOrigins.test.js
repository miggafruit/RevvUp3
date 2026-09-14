// corsOrigins.js reads process.env at module-load time (not inside a
// function), so each test needs a fresh module instance via
// jest.resetModules() + re-require after setting env vars — otherwise
// every test after the first would see whatever the first test's env
// happened to be, from Node's module cache.
describe('corsOrigins', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('parses a comma-separated list into an array of trimmed origins', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://admin.example.com, https://app.example.com';
    process.env.NODE_ENV = 'production';

    const { allowedOrigins } = require('../src/config/corsOrigins');

    expect(allowedOrigins).toEqual(['https://admin.example.com', 'https://app.example.com']);
  });

  test('falls back to allow-all outside production when nothing is configured', () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    process.env.NODE_ENV = 'development';

    const { allowedOrigins } = require('../src/config/corsOrigins');

    expect(allowedOrigins).toBe(true);
  });

  test('still falls back to allow-all in production if unset, rather than crashing', () => {
    // This is a deliberate safety-over-strictness choice (see the
    // comment in corsOrigins.js) — the previous behavior (wildcard,
    // unconditionally) is the same/no worse than before if someone
    // forgets to set this, just now with a loud warning instead of
    // silence.
    delete process.env.CORS_ALLOWED_ORIGINS;
    process.env.NODE_ENV = 'production';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { allowedOrigins } = require('../src/config/corsOrigins');

    expect(allowedOrigins).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
