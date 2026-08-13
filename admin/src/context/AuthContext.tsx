import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser } from '../types/admin';
import { loginAdmin } from '../api/authApi';
import { setToken, clearToken, getToken } from '../api/client';
import apiClient from '../api/client';

interface AuthContextValue {
  user: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // No /auth/me round trip needed here — the login response already
    // carries the full user object, and this admin tool has exactly one
    // real account type to deal with, so it's simplest to just trust
    // the stored value rather than re-fetch it on every page load.
    const stored = localStorage.getItem('revvup_admin_user');
    const token = getToken();
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('revvup_admin_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await loginAdmin(email, password);
    if (data.user.role !== 'admin') {
      throw new Error('This account does not have admin access.');
    }
    setToken(data.accessToken);
    localStorage.setItem('revvup_admin_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem('revvup_admin_user');
    setUser(null);
    apiClient.post('/auth/logout').catch(() => {});
  };

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
