const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// getSentryExpoConfig wraps expo/metro-config's getDefaultConfig and
// additionally annotates the build with debug IDs so stack traces
// reported to Sentry can be symbolicated back to real source lines
// instead of minified bundle positions. Safe to use even without a
// DSN configured — it only affects build output, not runtime
// behavior, so this doesn't couple Sentry being "on" to the app
// building at all.
const config = getSentryExpoConfig(__dirname);

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    // @teovilla/react-native-web-maps imports react-native-maps for TS types
    // only, but Metro's web bundler doesn't strip type-only imports the way
    // tsc does — so without this redirect, the real native package (which
    // uses codegenNativeComponent, native-only) gets pulled into the web
    // bundle and crashes on load. Since nothing on web actually needs the
    // real native types at runtime, point it at the web wrapper's own
    // exports instead.
    return context.resolveRequest(
      context,
      '@teovilla/react-native-web-maps',
      platform
    );
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;