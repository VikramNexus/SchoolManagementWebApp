/**
 * AuthContext — School Management System (Frontend)
 *
 * Day 3: Authentication & Security.
 *
 * Holds the authenticated user + JWT, persists them in localStorage so a
 * page refresh keeps the admin signed in, and exposes login/logout helpers.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const TOKEN_KEY = 'sms_token';
const USER_KEY = 'sms_user';
export const SERVER_URL_KEY = 'sms_server_url';
export const DEFAULT_SERVER_URL = import.meta.env.VITE_API_URL || 'https://schoolmanagementwebapp-pf7m.onrender.com';

export function getBaseURL() {
  const saved = localStorage.getItem(SERVER_URL_KEY);
  if (saved) {
    return `${saved.replace(/\/$/, '')}/api`;
  }
  return `${DEFAULT_SERVER_URL.replace(/\/$/, '')}/api`;
}

const AuthContext = createContext(null);

// Pre-configured axios instance that attaches the JWT to every request.
export const api = axios.create({ baseURL: getBaseURL() });

export function updateApiBaseUrl(newServerUrl) {
  if (newServerUrl) {
    localStorage.setItem(SERVER_URL_KEY, newServerUrl.trim());
    api.defaults.baseURL = `${newServerUrl.trim().replace(/\/$/, '')}/api`;
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Don't auto-redirect if checking auth/login itself
      const isLoginReq = error.config && error.config.url && error.config.url.includes('/auth/login');
      if (!isLoginReq && localStorage.getItem(TOKEN_KEY)) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        if (window.location.hash !== '#/login' && window.location.pathname !== '/login') {
          window.location.hash = '#/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Re-hydrate the session from a stored JWT on first load.
  useEffect(() => {
    let active = true;
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) return;

    setLoading(true);
    api
      .get('/auth/me')
      .then((res) => {
        if (!active) return;
        setUser(res.data.user);
        setToken(storedToken);
      })
      .catch(() => {
        if (!active) return;
        // Stored token invalid/expired → clear session.
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      const { token: newToken, user: newUser } = res.data;
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      return newUser;
    } catch (err) {
      const message =
        err.response?.data?.message || 'Login failed. Please try again.';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser, newToken) => {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
    }
    if (updatedUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  }, []);

  const value = {
    token,
    user,
    isAuthenticated: Boolean(token && user),
    loading,
    error,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
