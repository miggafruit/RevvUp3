import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../api/client';
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../api/authApi';
import { syncPushTokenWithBackend } from '../utils/pushNotifications';
import { LoginPayload, RegisterPayload, User } from '../types/auth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app start, check for a stored session and validate it against the backend.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
        if (!accessToken) {
          setIsLoading(false);
          return;
        }
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        syncPushTokenWithBackend();
      } catch (error) {
        // Token invalid/expired and refresh failed elsewhere — clear session
        await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
        await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const persistSession = async (accessToken: string, refreshToken: string) => {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  };

  const login = async (payload: LoginPayload): Promise<User> => {
    const data = await loginUser(payload);
    await persistSession(data.accessToken, data.refreshToken);
    setUser(data.user);
    syncPushTokenWithBackend();
    return data.user;
  };

  const register = async (payload: RegisterPayload): Promise<User> => {
    const data = await registerUser(payload);
    await persistSession(data.accessToken, data.refreshToken);
    setUser(data.user);
    syncPushTokenWithBackend();
    return data.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutUser();
    } catch {
      // proceed with local logout even if the server call fails (e.g. offline)
    }
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, register, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
