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

const isNativeApp = typeof window !== 'undefined' && (
  (typeof window.Capacitor !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.())) ||
  window.location.protocol === 'capacitor:' ||
  (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && window.location.hostname === 'localhost')
);

const isLocalBrowser = typeof window !== 'undefined' && !isNativeApp && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')
);

export const SERVER_URL_KEY = 'sms_server_url';
export const LOCAL_WIFI_SERVER_URL = 'http://172.25.8.130:5000';
export const CLOUD_SERVER_URL = 'https://schoolmanagementwebapp-pf7m.onrender.com';

export const DEFAULT_SERVER_URL = isLocalBrowser
  ? ''
  : (import.meta.env.VITE_API_URL || CLOUD_SERVER_URL || LOCAL_WIFI_SERVER_URL);

export function normalizeApiUrl(rawUrl) {
  if (!rawUrl) return isLocalBrowser ? '/api' : `${DEFAULT_SERVER_URL.replace(/\/+$/, '')}/api`;
  let url = rawUrl.trim().replace(/\/+$/, '');
  // Strip any trailing /api (even multiple times) so we have a clean base
  while (url.endsWith('/api')) {
    url = url.slice(0, -4).replace(/\/+$/, '');
  }
  return url ? `${url}/api` : '/api';
}

export function getBaseURL() {
  const saved = localStorage.getItem(SERVER_URL_KEY);
  if (isLocalBrowser && saved && (saved.includes('onrender.com') || saved.includes(':5000'))) {
    // In local browser, use relative /api proxy by default
    return '/api';
  }
  if (!saved && isLocalBrowser) {
    return '/api';
  }
  return normalizeApiUrl(saved || DEFAULT_SERVER_URL);
}

const AuthContext = createContext(null);

// Pre-configured axios instance that attaches the JWT to every request.
export const api = axios.create({ baseURL: getBaseURL() });

export function updateApiBaseUrl(newServerUrl) {
  if (newServerUrl) {
    const clean = normalizeApiUrl(newServerUrl);
    localStorage.setItem(SERVER_URL_KEY, clean);
    api.defaults.baseURL = clean;
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
      let message = err.response?.data?.message;
      if (!message) {
        if (err.message === 'Network Error' || err.code === 'ERR_NETWORK' || !err.response) {
          message = `Cannot reach backend server at ${api.defaults.baseURL || 'configured URL'}. Check Wi-Fi or tap Server Endpoint Settings below.`;
        } else {
          message = 'Login failed. Please try again.';
        }
      }
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
