const { clearanceOkFilter, hasValidClearance, requiresPoliceClearance } = require('../config/clearance');

// ONE definition of "this seller may be seen and bought from", used by every
// browse, detail, cart, checkout and inquiry path so nothing can drift.
const visibleShopFilter = () => ({ role: 'shop', kycStatus: 'approved' });

const visibleProviderFilter = () => ({
  role: 'service_provider',
  kycStatus: 'approved',
  ...clearanceOkFilter()
});

// Same rule for an already-loaded user document.
const isSellerVisible = (user) => {
  if (!user || user.kycStatus !== 'approved') return false;
  if (user.role === 'shop') return true;
  if (user.role === 'service_provider') return !requiresPoliceClearance(user) || hasValidClearance(user);
  return false;
};

module.exports = { visibleShopFilter, visibleProviderFilter, isSellerVisible };
