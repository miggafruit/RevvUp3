import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    // @ts-ignore — react-navigation's generic overloads don't line up
    // cleanly with a single generic wrapper function like this, but the
    // runtime call is correct for any route/params pair actually passed in.
    navigationRef.navigate(name, params);
  }
}
