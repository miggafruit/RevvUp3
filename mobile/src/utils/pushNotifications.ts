import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import apiClient from '../api/client';
import { navigate } from '../navigation/navigationRef';

// Confirmed against the installed expo-notifications version's actual
// types before writing this — shouldShowAlert is deprecated in favor of
// the two separate fields below, using the old field alone would have
// silently done nothing on a newer OS.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests permission and returns a real Expo push token, or null if
 * unavailable. Returns null (not an error) on a simulator/emulator,
 * when permission is denied, or when no EAS project ID is configured
 * yet (see app.json — this project hasn't run `eas init`, so this will
 * return null until that's done; the rest of the app works fine either
 * way, this just means push notifications won't actually arrive yet).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[push] Skipping — simulators/emulators cannot receive real push tokens.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[push] Permission denied.');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.log('[push] No EAS project ID configured yet (app.json extra.eas.projectId) — run `eas init` first.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch (err) {
    console.warn('[push] Failed to get push token:', err);
    return null;
  }
}

/**
 * Gets a token (if possible) and sends it to the backend. Safe to call
 * on every login/app-start — registering the same token twice is a
 * no-op, and failing silently here should never block anything else.
 */
export async function syncPushTokenWithBackend(): Promise<void> {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return;
    await apiClient.post('/auth/push-token', { pushToken: token });
  } catch (err) {
    console.warn('[push] Failed to sync push token with backend:', err);
  }
}

/**
 * Navigates based on a notification's data payload — same routes a
 * user would reach manually, just triggered by tapping a notification
 * instead. Unrecognized/missing data types are ignored rather than
 * guessed at.
 */
function handleNotificationTap(data: any) {
  switch (data?.type) {
    case 'new_request':
      // The notification payload only carries {type, rideId} — not a
      // full ride object (serviceType, location, vehicleDetails, etc.),
      // so there's nothing complete enough to pre-seed the pending
      // list with. Just navigate there and let the screen's existing
      // getPendingRequests() fetch-on-mount pick up the real thing.
      navigate('EHailingDriver');
      break;
    case 'request_accepted':
    case 'driver_arrived':
    case 'request_completed':
      // EHailingClient already auto-detects and resumes into whatever
      // live ride exists on mount (no resumeRideId needed) — more
      // direct than sending them to History and making them tap in.
      navigate('EHailingClient');
      break;
    case 'request_cancelled':
      // Nothing live left to show — the history record is what's
      // actually useful here.
      navigate('EHailingHistory');
      break;
    case 'kyc_reviewed':
      navigate('KycStatus');
      break;
    default:
      break;
  }
}

/**
 * Call once near the app root. Sets up the listener for when a user
 * taps a notification (foreground or from a cold start) and tears it
 * down on unmount.
 */
export function useNotificationResponseListener() {
  const listenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    listenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(response.notification.request.content.data);
    });

    // Cold start — the app was fully closed and opened by tapping a
    // notification, so there's no "response received" event to catch;
    // check for this explicitly instead.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationTap(response.notification.request.content.data);
      }
    });

    return () => {
      listenerRef.current?.remove();
    };
  }, []);
}
