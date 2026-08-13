import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
  return config;
});

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

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
