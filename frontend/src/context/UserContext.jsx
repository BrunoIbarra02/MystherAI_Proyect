import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const UserContext = createContext(null);
const CACHE_KEY = 'mysther_user';

const getCached = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
};

// Bare axios call (no interceptor) to verify session on mount.
// Devuelve {user} si la sesión es válida, {expired:true} solo ante un 401 real,
// y {unreachable:true} si el backend falla o no responde. Tratar los tres casos
// igual hacía que un 500 momentáneo (o la BD caída) deslogueara a todo el mundo.
const checkSession = () =>
  axios.get('/api/auth/me/', { withCredentials: true })
    .then(r => ({ user: r.data }))
    .catch(err => (err.response?.status === 401
      ? { expired: true }
      : { unreachable: true }));

// Pide la cookie csrftoken. Sin ella, todo POST/PUT/DELETE autenticado se
// rechaza con 403 (Django solo la emite si alguien llama a get_token()).
const primeCsrf = () =>
  axios.get('/api/auth/csrf/', { withCredentials: true }).catch(() => {});

export const UserProvider = ({ children }) => {
  const [user, _setUser]  = useState(getCached);  // hydrate instantly from cache
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u) => {
    _setUser(u);
    if (u) localStorage.setItem(CACHE_KEY, JSON.stringify(u));
    else   localStorage.removeItem(CACHE_KEY);
  }, []);

  useEffect(() => {
    primeCsrf();
    checkSession().then(res => {
      if (res.user)        setUser(res.user);   // sesión válida: dato fresco del servidor
      else if (res.expired) setUser(null);      // 401 real: la sesión caducó
      // res.unreachable: backend caído — conservamos la caché local y no deslogueamos
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    // El token CSRF es obligatorio aquí: axios pelado no lo manda y la petición
    // se rechazaba con 403, dejando la sesión viva en el servidor.
    const csrf = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
    try {
      await axios.post('/api/auth/logout/', {}, {
        withCredentials: true,
        headers: csrf ? { 'X-CSRFToken': decodeURIComponent(csrf[1]) } : {},
      });
    } catch (_) {}
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
