import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const UserContext = createContext(null);

// Bare axios call (no interceptor) to silently check session on mount
const checkSession = () =>
  axios.get('/api/auth/me/', { withCredentials: true }).then(r => r.data).catch(() => null);

export const UserProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession().then(u => { setUser(u); setLoading(false); });
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
