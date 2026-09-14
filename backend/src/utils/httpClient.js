const axios = require('axios');

// None of this backend's outbound calls to Paystack/Google Maps had
// any timeout configured — axios has no default, which means a
// third-party API that hangs instead of erroring (not uncommon during
// a partial outage) would leave the request open indefinitely,
// holding the connection and the client waiting with no response at
// all, rather than failing fast into whatever fallback/error-handling
// already exists for that call site. 8 seconds is generous enough for
// a normal slow response but short enough that a genuinely hung
// upstream fails fast instead of piling up open connections under load.
const httpClient = axios.create({
  timeout: 8000
});

module.exports = httpClient;
