/**
 * Login Component — Aryavart School Management System
 * Ultra-Modern Glassmorphism UI with Cloud & Local Connectivity
 */

import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  GraduationCap,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Zap,
  Key,
  X,
  Server,
  Wifi,
  Mail,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { useAuth, SERVER_URL_KEY, DEFAULT_SERVER_URL, updateApiBaseUrl, api } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const { login, isAuthenticated, loading, error } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Server IP config modal state (for Android APK & Cloud backend)
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem(SERVER_URL_KEY) || DEFAULT_SERVER_URL);
  const [serverTestStatus, setServerTestStatus] = useState(null); // 'testing' | 'success' | 'error'

  // Forgot password modal state (2-Step Email Verification)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Send OTP to Email, 2: Enter OTP & New Password
  const [forgotForm, setForgotForm] = useState({
    identifier: '',
    otp_code: '',
    new_password: '',
    confirm_password: '',
  });
  const [maskedEmail, setMaskedEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState({ type: '', text: '' });

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = 'Username or Admin ID is required';
    if (!form.password) errs.password = 'Password is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const ok = await login(form.username.trim(), form.password);
      if (ok) {
        navigate('/dashboard', { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1: Send 6-digit OTP code to registered admin email
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setForgotMsg({ type: '', text: '' });

    if (!forgotForm.identifier.trim()) {
      setForgotMsg({ type: 'error', text: 'Please enter your username or registered email address.' });
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post('/auth/forgot-password-otp', {
        identifier: forgotForm.identifier.trim(),
      });

      if (res.data.success) {
        setMaskedEmail(res.data.masked_email || 'your registered email');
        setForgotMsg({
          type: 'success',
          text: res.data.message || 'Verification code sent to your email!',
        });
        setForgotStep(2);
      }
    } catch (err) {
      setForgotMsg({
        type: 'error',
        text: err.response?.data?.message || 'No account found with this username or email.',
      });
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: Verify OTP and set new password
  const handleVerifyAndReset = async (e) => {
    e.preventDefault();
    setForgotMsg({ type: '', text: '' });

    if (!forgotForm.otp_code.trim() || forgotForm.otp_code.trim().length !== 6) {
      setForgotMsg({ type: 'error', text: 'Please enter the 6-digit verification code sent to your email.' });
      return;
    }
    if (forgotForm.new_password.length < 6) {
      setForgotMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (forgotForm.new_password !== forgotForm.confirm_password) {
      setForgotMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post('/auth/verify-otp-reset', {
        identifier: forgotForm.identifier.trim(),
        otp_code: forgotForm.otp_code.trim(),
        new_password: forgotForm.new_password,
        confirm_password: forgotForm.confirm_password,
      });

      if (res.data.success) {
        setForgotMsg({
          type: 'success',
          text: 'Password reset successfully! You can now log in with your new password.',
        });
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep(1);
          setForgotForm({ identifier: '', otp_code: '', new_password: '', confirm_password: '' });
          setForgotMsg({ type: '', text: '' });
        }, 2200);
      }
    } catch (err) {
      setForgotMsg({
        type: 'error',
        text: err.response?.data?.message || 'Invalid or expired code. Please try again.',
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleTestServer = async () => {
    setServerTestStatus('testing');
    try {
      const testUrl = `${serverUrl.trim().replace(/\/$/, '')}/api/health`;
      const res = await fetch(testUrl, { method: 'GET' });
      if (res.ok) {
        setServerTestStatus('success');
        updateApiBaseUrl(serverUrl.trim());
      } else {
        setServerTestStatus('error');
      }
    } catch {
      setServerTestStatus('error');
    }
  };

  const handleSaveServer = (e) => {
    e.preventDefault();
    updateApiBaseUrl(serverUrl.trim());
    setShowServerModal(false);
  };

  return (
    <div className="login-genz-wrapper">
      <div className="glow-blob blob-1" />
      <div className="glow-blob blob-2" />
      <div className="glow-blob blob-3" />

      <div className="login-genz-card">
        <div className="genz-badge">
          <Zap size={13} className="zap-icon" />
          <span>ARYAVART SHIKSHAN SANSTHAN</span>
        </div>

        <div className="genz-brand">
          <div className="genz-logo-wrap">
            <GraduationCap size={32} />
          </div>
          <h1 className="genz-title">Admin Sign In</h1>
          <p className="genz-subtitle">School &amp; Fee Management Suite</p>
        </div>

        {error && (
          <div className="genz-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form className="genz-form" onSubmit={handleSubmit} noValidate>
          <div className="genz-field">
            <label htmlFor="username">Username / Admin ID</label>
            <div className="input-wrap">
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Enter admin username"
                value={form.username}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>
            {fieldErrors.username && (
              <span className="genz-error-text">{fieldErrors.username}</span>
            )}
          </div>

          <div className="genz-field">
            <div className="label-with-forgot">
              <label htmlFor="password">Password</label>
              <button
                type="button"
                className="forgot-pw-btn"
                onClick={() => {
                  setForgotMsg({ type: '', text: '' });
                  setForgotStep(1);
                  setForgotForm({ identifier: '', otp_code: '', new_password: '', confirm_password: '' });
                  setShowForgotModal(true);
                }}
              >
                Forgot Password?
              </button>
            </div>
            <div className="input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter password"
                value={form.password}
                onChange={handleChange}
                disabled={submitting}
              />
              <button
                type="button"
                className="eye-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="genz-error-text">{fieldErrors.password}</span>
            )}
          </div>

          <button type="submit" className="genz-submit-btn" disabled={submitting || loading}>
            {submitting ? (
              <>
                <Loader2 size={18} className="spin" /> Authenticating…
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>
        </form>

        {/* Server Endpoint Settings Button (For Mobile APK & Remote Server) */}
        <div className="login-footer-actions">
          <button
            type="button"
            className="btn-server-config"
            onClick={() => {
              setServerTestStatus(null);
              setShowServerModal(true);
            }}
          >
            <Server size={14} />
            <span>Server Endpoint Settings</span>
          </button>
        </div>
      </div>

      {/* Server IP Config Modal */}
      {showServerModal && (
        <div className="forgot-modal-overlay" onClick={() => setShowServerModal(false)}>
          <div className="forgot-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <div className="forgot-header-title">
                <div className="forgot-icon-badge">
                  <Server size={20} />
                </div>
                <div>
                  <h3 className="modal-title">API Server Connection</h3>
                  <p className="modal-subtitle">Configure cloud or local server address for this device.</p>
                </div>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setShowServerModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className="forgot-form" onSubmit={handleSaveServer}>
              <div className="genz-field">
                <label>Backend Server URL</label>
                <div className="input-wrap">
                  <input
                    type="url"
                    placeholder="https://schoolmanagementwebapp-pf7m.onrender.com/api"
                    value={serverUrl}
                    onChange={(e) => {
                      setServerUrl(e.target.value);
                      setServerTestStatus(null);
                    }}
                    required
                  />
                </div>
                <span className="field-hint">
                  Default Cloud: <code>https://schoolmanagementwebapp-pf7m.onrender.com/api</code>
                </span>
              </div>

              {serverTestStatus === 'success' && (
                <div className="genz-alert success">
                  <CheckCircle2 size={16} />
                  <span>Server reached successfully! Connected &amp; ready.</span>
                </div>
              )}
              {serverTestStatus === 'error' && (
                <div className="genz-alert">
                  <AlertCircle size={16} />
                  <span>Cannot reach server. Please verify your internet connection.</span>
                </div>
              )}

              <div className="modal-btn-row">
                <button
                  type="button"
                  className="modal-sec-btn"
                  onClick={handleTestServer}
                  disabled={serverTestStatus === 'testing'}
                >
                  {serverTestStatus === 'testing' ? <Loader2 size={15} className="spin" /> : <Wifi size={15} />}
                  <span>Test Server</span>
                </button>
                <button type="submit" className="modal-pri-btn">
                  Save &amp; Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Recovery Modal (Email Verification Flow) */}
      {showForgotModal && (
        <div className="forgot-modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="forgot-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <div className="forgot-header-title">
                <div className="forgot-icon-badge">
                  {forgotStep === 1 ? <Mail size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div>
                  <h3 className="modal-title">
                    {forgotStep === 1 ? 'Email Password Reset' : 'Verify Code & Set Password'}
                  </h3>
                  <p className="modal-subtitle">
                    {forgotStep === 1
                      ? 'We will send a 6-digit verification code to your registered admin email.'
                      : `Enter the code sent to ${maskedEmail || 'your email'}.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {forgotMsg.text && (
              <div className={`genz-alert ${forgotMsg.type === 'success' ? 'success' : ''}`}>
                {forgotMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{forgotMsg.text}</span>
              </div>
            )}

            {/* STEP 1: Enter Username/Email and Request OTP */}
            {forgotStep === 1 && (
              <form className="forgot-form" onSubmit={handleSendOtp}>
                <div className="genz-field">
                  <label>Admin Username or Registered Email</label>
                  <div className="input-wrap">
                    <input
                      type="text"
                      placeholder="e.g. admin or admin@school.local"
                      value={forgotForm.identifier}
                      onChange={(e) => setForgotForm({ ...forgotForm, identifier: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="genz-submit-btn"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 size={16} className="spin" /> Sending Code…
                    </>
                  ) : (
                    <>
                      <Mail size={16} /> Send 6-Digit Email Code
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Enter 6-Digit OTP & Set New Password */}
            {forgotStep === 2 && (
              <form className="forgot-form" onSubmit={handleVerifyAndReset}>
                <div className="genz-field">
                  <label>6-Digit Email Verification Code</label>
                  <div className="input-wrap">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      className="otp-input-box"
                      value={forgotForm.otp_code}
                      onChange={(e) => setForgotForm({ ...forgotForm, otp_code: e.target.value.replace(/\D/g, '') })}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="genz-field">
                  <label>New Password</label>
                  <div className="input-wrap">
                    <input
                      type="password"
                      placeholder="Min 6 characters"
                      value={forgotForm.new_password}
                      onChange={(e) => setForgotForm({ ...forgotForm, new_password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="genz-field">
                  <label>Confirm New Password</label>
                  <div className="input-wrap">
                    <input
                      type="password"
                      placeholder="Repeat new password"
                      value={forgotForm.confirm_password}
                      onChange={(e) => setForgotForm({ ...forgotForm, confirm_password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="modal-btn-row">
                  <button
                    type="button"
                    className="modal-sec-btn"
                    onClick={() => {
                      setForgotStep(1);
                      setForgotMsg({ type: '', text: '' });
                    }}
                  >
                    <RotateCcw size={14} /> Back
                  </button>
                  <button
                    type="submit"
                    className="modal-pri-btn"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={16} className="spin" /> Verifying…
                      </>
                    ) : (
                      'Reset & Save'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
