// Police clearance ("criminal record check") rules.
//
// WHO needs one:
//   - every driver: delivery (isDriver) and roadside/tow (roadsideServices)
//   - every service provider who lists as an INDIVIDUAL (providerType
//     'individual', which is also the default for older accounts)
// Registered businesses that don't drive are not asked for one; shops are not.
//
// HOW it works: the person uploads a police clearance certificate (SAPS, or a
// vetting-company report) plus its issue date and reference number. An admin
// reads the certificate and ticks "verified" when approving. This system does
// not query any criminal database itself — the human admin check is the check.
//
// VALIDITY: a certificate must be at most 180 days old when submitted, and an
// account is only visible / dispatchable for 365 days after the certificate's
// issue date. After that it drops out until a fresh one is verified.
const MAX_AGE_AT_SUBMISSION_DAYS = 180;
const VALID_FOR_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const requiresPoliceClearance = (user) => {
  if (!user || user.role !== 'service_provider') return false;
  const isDriver = !!user.isDriver || (user.roadsideServices?.length ?? 0) > 0;
  const isIndividual = user.providerType !== 'business';
  return isDriver || isIndividual;
};

const clearanceCutoff = (now = new Date()) => new Date(now.getTime() - VALID_FOR_DAYS * DAY_MS);

const hasValidClearance = (user, now = new Date()) => {
  const pc = user?.policeClearance;
  return !!(pc?.verifiedAt && pc?.issuedOn && new Date(pc.issuedOn) >= clearanceCutoff(now));
};

// Mongo filter fragment: "this service_provider may be shown / dispatched".
const clearanceOkFilter = (now = new Date()) => ({
  $or: [
    { providerType: 'business', isDriver: { $ne: true }, roadsideServices: { $size: 0 } },
    { 'policeClearance.verifiedAt': { $exists: true }, 'policeClearance.issuedOn': { $gte: clearanceCutoff(now) } }
  ]
});

// Validates the issue date a person submits. Returns an error string or null.
const validateIssueDate = (value, now = new Date()) => {
  const d = new Date(value);
  if (!value || isNaN(d.getTime())) return 'Please enter the date the police clearance was issued.';
  if (d > now) return 'The police clearance issue date cannot be in the future.';
  if (now.getTime() - d.getTime() > MAX_AGE_AT_SUBMISSION_DAYS * DAY_MS) {
    return `Your police clearance must be less than ${MAX_AGE_AT_SUBMISSION_DAYS} days old. Please apply for a fresh one.`;
  }
  return null;
};

module.exports = {
  MAX_AGE_AT_SUBMISSION_DAYS,
  VALID_FOR_DAYS,
  requiresPoliceClearance,
  hasValidClearance,
  clearanceOkFilter,
  clearanceCutoff,
  validateIssueDate
};
