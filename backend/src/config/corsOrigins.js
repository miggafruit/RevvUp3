// Both Express's cors() and Socket.IO's own CORS config previously
// allowed every origin unconditionally (cors() with no options, and
// io's cors: { origin: '*' } — the comment literally said "tighten to
// your frontend URL in production" and nothing ever did). Native mobile
// apps don't send an Origin header the way browsers do, so this mattered
// specifically for the two browser-based surfaces this backend serves:
// the admin dashboard and the Expo web build of the mobile app. A
// wildcard origin means any website anywhere could make authenticated
// requests against this API using a logged-in user's token if it were
// ever stolen via XSS elsewhere, or embed the admin dashboard's API in
// a malicious page.
//
// CORS_ALLOWED_ORIGINS is a comma-separated list, e.g.:
//   CORS_ALLOWED_ORIGINS=https://admin.revvup.app,https://app.revvup.app
//
// Falls back to allowing everything ONLY when NODE_ENV isn't
// 'production' — local dev (Vite/Expo web on arbitrary localhost
// ports) still works out of the box, but a production deploy without
// this var set gets a loud warning instead of a silent wildcard.
const isProduction = process.env.NODE_ENV === 'production';

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (isProduction && configuredOrigins.length === 0) {
  console.warn('');
  console.warn('⚠️  CORS_ALLOWED_ORIGINS is not set in production — falling back to');
  console.warn('   allowing all origins. Set it to your admin dashboard and web app URLs,');
  console.warn('   comma-separated, e.g.:');
  console.warn('   CORS_ALLOWED_ORIGINS=https://admin.revvup.co.za,https://www.revvup.co.za,https://app.example.com');
  console.warn('');
}

// true (allow-all) when not in production or nothing configured yet —
// matches previous behavior as a safe fallback rather than breaking
// existing deployments outright; the warning above is what pushes
// toward actually setting it.
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : true;

module.exports = { allowedOrigins };
