import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);
  useEffect(() => {
    window.addEventListener('velox:logout', logout);
    return () => window.removeEventListener('velox:logout', logout);
  }, [logout]);

  const enter = useCallback(async (mode, handle, password) => {
    const d = await api(`/auth/${mode}`, { method: 'POST', body: { handle, password } });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const refresh = useCallback(() => api('/auth/me').then((d) => setUser(d.user)), []);

  const value = useMemo(() => ({ user, setUser, ready, enter, logout, refresh }), [user, ready, enter, logout, refresh]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
