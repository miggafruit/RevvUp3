import axios from 'axios';
import { Sentry } from '../config/sentry';

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'revvup_admin_access_token';

// No timeout was previously set — axios has no default, so a hung
// backend request (rather than an outright error) would leave an
// admin staring at a stuck loading state indefinitely with no
// feedback at all.
const apiClient = axios.create({ baseURL: BASE_URL, timeout: 15000 });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 here means the session is genuinely invalid (expired/revoked) —
// unlike the mobile app, this admin tool doesn't attempt a silent
// refresh-and-retry; it just sends the admin back to login, since an
// admin re-authenticating is a low-friction, infrequent action, not
// something worth the complexity of token refresh for.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (error.response?.status >= 500) {
      // Same reasoning as the mobile client: a genuine backend bug
      // affecting a real admin action (approving KYC, marking a
      // payout paid, cancelling a ride) right now, worth an alert —
      // 4xx and network errors are either expected or too noisy to be
      // worth reporting individually.
      Sentry.captureException(error, {
        tags: { area: 'admin-api-client' },
        extra: { url: error.config?.url, method: error.config?.method, status: error.response?.status }
      });
    }
    return Promise.reject(error);
  }
);

export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const getToken = () => localStorage.getItem(TOKEN_KEY);

export default apiClient;
