import apiClient from './client';

// Asks the server whether this logged-in user may use the temporary
// "Test payment" button. Any failure means "no" — the real card flow
// is always the safe default.
export const isTestPaymentEnabled = async (): Promise<boolean> => {
  try {
    const { data } = await apiClient.get('/payments/test-mode');
    return data?.enabled === true;
  } catch {
    return false;
  }
};

export const makeTestReference = () =>
  `TEST_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
