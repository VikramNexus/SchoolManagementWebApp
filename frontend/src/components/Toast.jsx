/**
 * Toast Notification System — School Management System (Frontend)
 *
 * Day 4: Settings, Fees & Application Shell.
 *
 * Lightweight, accessible toast notifications with auto-dismiss, progress bar,
 * and support for multiple concurrent toasts.
 */

import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
} from 'lucide-react';
import './Toast.css';

const ToastContext = createContext(null);

const TOAST_LIMIT = 5;
const DEFAULT_DURATION = 5000;

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const COLORS = {
  success: 'var(--toast-success)',
  error: 'var(--toast-error)',
  warning: 'var(--toast-warning)',
  info: 'var(--toast-info)',
  loading: 'var(--toast-info)',
};

let idCounter = 0;

function generateId() {
  return ++idCounter;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = generateId();
    const duration = options.duration ?? DEFAULT_DURATION;

    const toast = {
      id,
      message,
      type,
      duration,
      dismissible: options.dismissible !== false,
      action: options.action,
      createdAt: Date.now(),
    };

    setToasts((prev) => [...prev.slice(-TOAST_LIMIT + 1), toast]);

    // Auto-dismiss
    if (duration > 0 && type !== 'loading') {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  // Convenience methods
  const toast = useCallback(
    (message, options) => addToast(message, 'info', options),
    [addToast]
  );
  toast.success = useCallback(
    (message, options) => addToast(message, 'success', options),
    [addToast]
  );
  toast.error = useCallback(
    (message, options) => addToast(message, 'error', options),
    [addToast]
  );
  toast.warning = useCallback(
    (message, options) => addToast(message, 'warning', options),
    [addToast]
  );
  toast.info = useCallback(
    (message, options) => addToast(message, 'info', options),
    [addToast]
  );
  toast.loading = useCallback(
    (message, options) => addToast(message, 'loading', { ...options, duration: 0, dismissible: false }),
    [addToast]
  );

  // Update a loading toast to success/error
  const updateToast = useCallback((id, type, message, options = {}) => {
    setToasts((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, type, message, duration: options.duration ?? DEFAULT_DURATION, dismissible: true } : t
      )
    );
    if (options.duration !== 0) {
      setTimeout(() => removeToast(id), options.duration ?? DEFAULT_DURATION);
    }
  }, [removeToast]);

  const dismiss = useCallback(
    (id) => removeToast(id),
    [removeToast]
  );

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, updateToast, dismiss, dismissAll }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const Icon = ICONS[toast.type] || ICONS.info;

  useEffect(() => {
    if (toast.duration > 0 && toast.type !== 'loading') {
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        const pct = Math.max(0, 100 - (elapsed / toast.duration) * 100);
        setProgress(pct);
        if (pct <= 0) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [toast.duration, toast.type]);

  return (
    <div
      className={`toast toast-${toast.type}`}
      style={{ '--toast-color': COLORS[toast.type] }}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="toast-icon" aria-hidden="true">
        <Icon size={20} />
      </div>

      <div className="toast-content">
        <p className="toast-message">{toast.message}</p>
        {toast.action && (
          <button className="toast-action" onClick={toast.action.onClick}>
            {toast.action.label}
          </button>
        )}
      </div>

      {toast.dismissible && (
        <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
          <X size={16} />
        </button>
      )}

      {toast.duration > 0 && toast.type !== 'loading' && (
        <div className="toast-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="toast-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}