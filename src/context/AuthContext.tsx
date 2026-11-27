import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { RecruiterSubscription, User, UserRole } from '../types';
import { api, ApiError } from '../services/api';

interface AuthContextValue {
  user: User | null;
  subscription: RecruiterSubscription | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { email: string; password: string; role: UserRole; fullName: string; phone?: string; company?: string }) => Promise<User>;
  demoLogin: (role: UserRole) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<RecruiterSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.auth.me();
      setUser(data.user);
      setSubscription(data.subscription ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setSubscription(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    setUser(res.user);
    await refresh();
    return res.user;
  }, [refresh]);

  const register = useCallback(
    async (input: { email: string; password: string; role: UserRole; fullName: string; phone?: string; company?: string }) => {
      const res = await api.auth.register(input);
      setUser(res.user);
      await refresh();
      return res.user;
    },
    [refresh],
  );

  const demoLogin = useCallback(async (role: UserRole) => {
    const res = await api.auth.demoLogin(role);
    setUser(res.user);
    await refresh();
    return res.user;
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setSubscription(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, subscription, loading, refresh, login, register, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
