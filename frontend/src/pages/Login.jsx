import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  GraduationCap,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Key,
  CheckCircle2,
  X,
  Lock,
  Wifi,
  Server,
} from 'lucide-react';
import { useAuth, api, SERVER_URL_KEY, DEFAULT_SERVER_URL, updateApiBaseUrl } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const { login, isAuthenticated, loading, error } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Server IP config modal state (for Android APK)
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem(SERVER_URL_KEY) || DEFAULT_SERVER_URL);
  const [serverTestStatus, setServerTestStatus] = useState(null); // 'testing' | 'success' | 'error'

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotForm, setForgotForm] = useState({
    identifier: '',
    new_password: '',
    confirm_password: '',
  });
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState({ type: '', text: '' });
  const [showForgotPw, setShowForgotPw] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = 'Username is required.';
    if (!form.password) errs.password = 'Password is required.';
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
      await login(form.username.trim(), form.password);
      navigate('/dashboard', { replace: true });
    } catch {
      // Surfaced via auth context error
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotMsg({ type: '', text: '' });

    if (!forgotForm.identifier.trim()) {
      setForgotMsg({ type: 'error', text: 'Please enter your username or registered email.' });
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

    try {
      setForgotLoading(true);
      const res = await api.post('/auth/forgot-password', {
        identifier: forgotForm.identifier.trim(),
        new_password: forgotForm.new_password,
      });

      if (res.data.success) {
        setForgotMsg({ type: 'success', text: res.data.message });
        setForm((prev) => ({
          ...prev,
          username: forgotForm.identifier.trim(),
          password: forgotForm.new_password,
        }));
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotMsg({ type: '', text: '' });
          setForgotForm({ identifier: '', new_password: '', confirm_password: '' });
        }, 1800);
      }
    } catch (err) {
      setForgotMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to reset password. Please check your username/email.',
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
      {/* Animated ambient glow spheres */}
      <div className="glow-blob blob-1" />
      <div className="glow-blob blob-2" />
      <div className="glow-blob blob-3" />

      <div className="login-genz-card">
        {/* Top Tag */}
        <div className="genz-badge">
          <Zap size={14} className="zap-icon" />
          <span>ARYAVART PORTAL</span>
        </div>

        {/* Brand header */}
        <div className="genz-header">
          <div className="genz-icon-holder">
            <GraduationCap size={36} />
          </div>
          <h1 className="genz-title">Admin Sign In</h1>
          <p className="genz-subtitle">Aryavart Shikshan Sansthan • Management Suite</p>
        </div>

        {error && (
          <div className="genz-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form className="genz-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="username">Username / Admin ID</label>
            <div className="input-wrap">
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Enter username"
                value={form.username}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>
            {fieldErrors.username && (
              <span className="genz-error-text">{fieldErrors.username}</span>
            )}
          </div>

          <div className="form-group">
            <div className="label-with-action">
              <label htmlFor="password">Password</label>
              <button
                type="button"
                className="forgot-pw-link"
                onClick={() => {
                  setForgotMsg({ type: '', text: '' });
                  setForgotForm({ identifier: '', new_password: '', confirm_password: '' });
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
                <Loader2 size={20} className="spin" /> Authenticating…
              </>
            ) : (
              <span>Sign In to Dashboard →</span>
            )}
          </button>
        </form>

        <div className="genz-footer">
          <p>🔒 256-bit Encrypted Session • Authorized Admin Access Only</p>
          <button
            type="button"
            className="forgot-pw-link"
            style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}
            onClick={() => {
              setServerTestStatus(null);
              setShowServerModal(true);
            }}
          >
            ⚙️ Server Connection Settings
          </button>
        </div>
      </div>

      {/* Server IP Settings Modal (for APK / Remote Access) */}
      {showServerModal && (
        <div className="forgot-modal-overlay" onClick={() => setShowServerModal(false)}>
          <div className="forgot-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <div className="forgot-header-title">
                <div className="forgot-icon-badge">
                  <Server size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Backend Server Address</h3>
                  <p className="modal-subtitle">Configure the laptop IP address for this Android APK.</p>
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
              <div className="form-group">
                <label>Backend Server URL</label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => {
                    setServerUrl(e.target.value);
                    setServerTestStatus(null);
                  }}
                  placeholder="https://schoolmanagementwebapp-pf7m.onrender.com"
                  required
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  Default Cloud Server: <code>https://schoolmanagementwebapp-pf7m.onrender.com</code>
                </span>
              </div>

              {serverTestStatus === 'success' && (
                <div className="forgot-alert success">
                  <CheckCircle2 size={16} />
                  <span>✅ Connected to 24/7 Cloud Backend Successfully!</span>
                </div>
              )}
              {serverTestStatus === 'error' && (
                <div className="forgot-alert error">
                  <AlertCircle size={16} />
                  <span>❌ Cannot reach server. Please verify your internet connection.</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px' }}
                  onClick={handleTestServer}
                  disabled={serverTestStatus === 'testing'}
                >
                  {serverTestStatus === 'testing' ? <Loader2 size={16} className="spin" /> : <Wifi size={16} />}
                  <span>Test Connection</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Save &amp; Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Recovery Modal */}
      {showForgotModal && (
        <div className="forgot-modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="forgot-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <div className="forgot-header-title">
                <div className="forgot-icon-badge">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Reset Admin Password</h3>
                  <p className="modal-subtitle">Verify your account identifier and set a new password.</p>
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
              <div className={`forgot-alert ${forgotMsg.type}`}>
                {forgotMsg.type === 'error' ? (
                  <AlertCircle size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>{forgotMsg.text}</span>
              </div>
            )}

            <form className="forgot-form" onSubmit={handleForgotSubmit}>
              <div className="forgot-field">
                <label htmlFor="forgot_identifier">Username or Registered Email</label>
                <div className="forgot-input-wrap">
                  <input
                    id="forgot_identifier"
                    type="text"
                    placeholder="e.g. admin or aryavart@gmail.com"
                    value={forgotForm.identifier}
                    onChange={(e) =>
                      setForgotForm((prev) => ({ ...prev, identifier: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="forgot-field">
                <label htmlFor="forgot_new_password">New Password (Min 6 chars)</label>
                <div className="forgot-input-wrap">
                  <input
                    id="forgot_new_password"
                    type={showForgotPw ? 'text' : 'password'}
                    placeholder="Enter new strong password"
                    value={forgotForm.new_password}
                    onChange={(e) =>
                      setForgotForm((prev) => ({ ...prev, new_password: e.target.value }))
                    }
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="forgot-eye-btn"
                    onClick={() => setShowForgotPw(!showForgotPw)}
                  >
                    {showForgotPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="forgot-field">
                <label htmlFor="forgot_confirm_password">Confirm New Password</label>
                <div className="forgot-input-wrap">
                  <input
                    id="forgot_confirm_password"
                    type={showForgotPw ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={forgotForm.confirm_password}
                    onChange={(e) =>
                      setForgotForm((prev) => ({ ...prev, confirm_password: e.target.value }))
                    }
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="forgot-actions">
                <button
                  type="button"
                  className="btn-forgot-cancel"
                  onClick={() => setShowForgotModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-forgot-submit"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 size={16} className="spin" /> Resetting…
                    </>
                  ) : (
                    <>
                      <Key size={16} /> Reset Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
