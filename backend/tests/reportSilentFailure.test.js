jest.mock('../src/config/sentry', () => ({
  captureException: jest.fn()
}));

const Sentry = require('../src/config/sentry');
const { reportSilentFailure } = require('../src/utils/reportSilentFailure');

describe('reportSilentFailure', () => {
  afterEach(() => jest.clearAllMocks());

  test('forwards the error to Sentry with the given area tag and context', () => {
    const error = new Error('payout write failed');
    reportSilentFailure(error, 'payouts', { recipient: 'user123', amount: 350 });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: { silentFailure: true, area: 'payouts' },
        extra: { recipient: 'user123', amount: 350 }
      })
    );
  });

  test('never throws, even if Sentry.captureException itself throws', () => {
    // This is the entire point of this function existing — a
    // best-effort reporting call must never become a second, worse
    // failure on top of the one it's trying to report.
    Sentry.captureException.mockImplementation(() => {
      throw new Error('Sentry SDK internal error');
    });

    expect(() => reportSilentFailure(new Error('original error'), 'push-notifications')).not.toThrow();
  });

  test('works with no context argument', () => {
    expect(() => reportSilentFailure(new Error('oops'), 'delivery-creation')).not.toThrow();
  });
});
