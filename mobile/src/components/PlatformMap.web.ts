// On web, react-native-maps doesn't run (it's native-only under the hood).
// This wrapper mimics the same MapView/Marker/Polyline API using the Google
// Maps JS SDK, so screens that import from './PlatformMap' don't need any
// platform branching themselves.
// mobile/src/components/PlatformMap.web.ts
// react-native-web-maps' compiled JS exports MapView as a named export
// (exports.MapView = MapView) with __esModule set — meaning a default
// import here genuinely resolves to undefined at runtime (that's what
// was crashing every screen using this map on web). Importing the
// whole namespace and pulling .MapView off it directly sidesteps the
// default/named ambiguity entirely rather than depending on whichever
// way a re-export happens to get interpreted.
import * as MapViewModule from '@teovilla/react-native-web-maps/dist/commonjs/components/map-view';
const MapView = (MapViewModule as any).MapView;
export default MapView;
export { Marker } from '@teovilla/react-native-web-maps/dist/commonjs/components/marker.web';
export { Polyline } from '@teovilla/react-native-web-maps/dist/commonjs/components/polyline';
export const PROVIDER_GOOGLE = 'google';