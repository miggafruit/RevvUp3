import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Sentry } from '../config/sentry';

// Production reads from EXPO_PUBLIC_API_BASE_URL (set this in Vercel's
// environment variables and in eas.json's production build profile).
// Falls back to local-dev convenience values below ONLY when that's
// not set — the LAN IP still needs manually updating to your own
// machine's address when testing on a physical device, same as
// before, this just doesn't override the deployed environment anymore.
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.198.69.195:5000/api';
  }
  return 'http://localhost:5000/api';
};

export const BASE_URL = getBaseUrl();
// Socket.IO connects to the server root, not an API path — same host,
// just without the /api suffix. Derived from BASE_URL so there's one
// place that defines "where the backend is," not two that can drift
// out of sync.
export const SOCKET_URL = BASE_URL.replace(/\/api\/?$/, '');

export const ACCESS_TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // A breadcrumb trail of recent API calls is exactly what's missing
  // when a bug report shows up as "user X hit an error" with no
  // context — this means whatever Sentry event eventually gets
  // captured (from anywhere in the app, not just from here) carries
  // the last several API calls leading up to it. No bodies/tokens
  // included, just method + path, which is enough to reconstruct what
  // the user was doing.
  Sentry.addBreadcrumb({
    category: 'http.request',
    message: `${config.method?.toUpperCase()} ${config.url}`,
    level: 'info'
  });
  return config;
});

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

apiClient.interceptors.response.use(
  (response) => {
    Sentry.addBreadcrumb({
      category: 'http.response',
      message: `${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
      level: 'info'
    });
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Deliberately selective about what gets reported here:
    //  - No response at all (offline, DNS failure, request timeout) is
    //    just normal mobile connectivity — reporting every one of
    //    these would flood Sentry with noise that isn't actionable on
    //    the backend, so this only adds a breadcrumb, not a captured
    //    event.
    //  - 4xx responses are the server correctly rejecting a bad
    //    request (validation, auth, etc.) — expected behavior, not a
    //    bug to alert on.
    //  - 5xx responses ARE a real backend bug affecting a real user
    //    right now, and those get captured so they show up in Sentry
    //    even if nobody happens to be looking at the server logs at
    //    that exact moment.
    if (!error.response) {
      Sentry.addBreadcrumb({
        category: 'http.error',
        message: `Network error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        level: 'warning'
      });
    } else if (error.response.status >= 500) {
      Sentry.captureException(error, {
        tags: { area: 'api-client' },
        extra: {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response.status
        }
      });
    }

    const isTokenExpired =
      error.response?.status === 401 &&
      (error.response.data as any)?.code === 'TOKEN_EXPIRED';

    if (isTokenExpired && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Wait for the in-flight refresh to finish, then retry
        return new Promise((resolve, reject) => {
          pendingRequests.push(() => {
            apiClient(originalRequest).then(resolve).catch(reject);
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) throw new Error('No refresh token available');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });

        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);

        pendingRequests.forEach((cb) => cb());
        pendingRequests = [];

        return apiClient(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
        await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
        pendingRequests = [];
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
