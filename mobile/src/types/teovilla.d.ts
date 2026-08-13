// @teovilla/react-native-web-maps doesn't ship TypeScript declarations
// for these specific subpath imports (only used by PlatformMap.web.ts,
// the web-only fallback for react-native-maps). Untyped as `any` since
// we only ever use them as passthrough re-exports, never touch their
// internals directly.
declare module '@teovilla/react-native-web-maps/dist/commonjs/components/map-view' {
  const MapView: any;
  export default MapView;
}

declare module '@teovilla/react-native-web-maps/dist/commonjs/components/marker.web' {
  export const Marker: any;
}

declare module '@teovilla/react-native-web-maps/dist/commonjs/components/polyline' {
  export const Polyline: any;
}
