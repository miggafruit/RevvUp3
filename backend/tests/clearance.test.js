const {
  requiresPoliceClearance,
  hasValidClearance,
  validateIssueDate,
  clearanceOkFilter
} = require('../src/config/clearance');
const { isSellerVisible } = require('../src/utils/sellerVisibility');

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe('who needs a police clearance', () => {
  test('individual service provider: yes (default when providerType missing)', () => {
    expect(requiresPoliceClearance({ role: 'service_provider' })).toBe(true);
    expect(requiresPoliceClearance({ role: 'service_provider', providerType: 'individual' })).toBe(true);
  });
  test('registered business that does not drive: no', () => {
    expect(requiresPoliceClearance({ role: 'service_provider', providerType: 'business', isDriver: false, roadsideServices: [] })).toBe(false);
  });
  test('any delivery driver or tow/roadside responder: yes, even a business', () => {
    expect(requiresPoliceClearance({ role: 'service_provider', providerType: 'business', isDriver: true })).toBe(true);
    expect(requiresPoliceClearance({ role: 'service_provider', providerType: 'business', roadsideServices: ['tow_sling'] })).toBe(true);
  });
  test('shops and clients: no', () => {
    expect(requiresPoliceClearance({ role: 'shop' })).toBe(false);
    expect(requiresPoliceClearance({ role: 'client' })).toBe(false);
  });
});

describe('clearance validity', () => {
  test('rejects missing, future and stale issue dates', () => {
    expect(validateIssueDate(undefined)).toBeTruthy();
    expect(validateIssueDate(new Date(Date.now() + 86400000))).toBeTruthy();
    expect(validateIssueDate(daysAgo(200))).toBeTruthy();
    expect(validateIssueDate(daysAgo(10))).toBeNull();
  });
  test('must be admin-verified AND within 365 days of issue', () => {
    expect(hasValidClearance({ policeClearance: { issuedOn: daysAgo(10) } })).toBe(false); // not verified
    expect(hasValidClearance({ policeClearance: { issuedOn: daysAgo(10), verifiedAt: new Date() } })).toBe(true);
    expect(hasValidClearance({ policeClearance: { issuedOn: daysAgo(400), verifiedAt: new Date() } })).toBe(false);
  });
  test('mongo filter always offers the business-non-driver route or a verified, recent clearance', () => {
    const f = clearanceOkFilter();
    expect(f.$or).toHaveLength(2);
    expect(f.$or[1]['policeClearance.verifiedAt']).toEqual({ $exists: true });
  });
});

describe('isSellerVisible (admin approval gate)', () => {
  const verified = { issuedOn: daysAgo(5), verifiedAt: new Date() };
  test('unapproved shop is never visible', () => {
    for (const kycStatus of ['not_submitted', 'pending', 'rejected']) {
      expect(isSellerVisible({ role: 'shop', kycStatus })).toBe(false);
    }
    expect(isSellerVisible({ role: 'shop', kycStatus: 'approved' })).toBe(true);
  });
  test('unapproved provider is never visible', () => {
    for (const kycStatus of ['not_submitted', 'pending', 'rejected']) {
      expect(isSellerVisible({ role: 'service_provider', kycStatus, providerType: 'business', policeClearance: verified })).toBe(false);
    }
  });
  test('approved individual without verified clearance is hidden; with it, visible', () => {
    expect(isSellerVisible({ role: 'service_provider', kycStatus: 'approved' })).toBe(false);
    expect(isSellerVisible({ role: 'service_provider', kycStatus: 'approved', policeClearance: verified })).toBe(true);
  });
  test('approved non-driving business is visible without clearance', () => {
    expect(isSellerVisible({ role: 'service_provider', kycStatus: 'approved', providerType: 'business', roadsideServices: [] })).toBe(true);
  });
  test('other roles are never sellers', () => {
    expect(isSellerVisible({ role: 'client', kycStatus: 'approved' })).toBe(false);
    expect(isSellerVisible(null)).toBe(false);
  });
});
