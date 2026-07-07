import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const UserContext = createContext(null);
const CACHE_KEY = 'mysther_user';

const getCached = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
};

// Bare axios call (no interceptor) to verify session on mount
const checkSession = () =>
  axios.get('/api/auth/me/', { withCredentials: true }).then(r => r.data).catch(() => null);

export const UserProvider = ({ children }) => {
  const [user, _setUser]  = useState(getCached);  // hydrate instantly from cache
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u) => {
    _setUser(u);
    if (u) localStorage.setItem(CACHE_KEY, JSON.stringify(u));
    else   localStorage.removeItem(CACHE_KEY);
  }, []);

  useEffect(() => {
    checkSession().then(u => {
      setUser(u);        // authoritative update from server (includes latest avatar)
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    try { await axios.post('/api/auth/logout/', {}, { withCredentials: true }); } catch (_) {}
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
