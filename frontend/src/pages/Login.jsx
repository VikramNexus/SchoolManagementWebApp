/**
 * Login Component — Aryavart School Management System
 * Ultra-Modern Glassmorphism UI with Cloud & Local Connectivity
 */

import { useState, useEffect } from 'react';
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
  RefreshCw,
  Cloud,
  Laptop,
  Globe,
  Activity,
  HelpCircle,
  KeyRound,
} from 'lucide-react';
import { useAuth, SERVER_URL_KEY, DEFAULT_SERVER_URL, updateApiBaseUrl, normalizeApiUrl, api } from '../context/AuthContext';
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

  // Forgot password modal state (Security Question Recovery)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Lookup Question, 2: Answer & Reset
  const [forgotForm, setForgotForm] = useState({
    identifier: '',
    question: '',
    has_question: true,
    available_questions: [],
    chosen_question: '',
    security_answer: '',
    new_password: '',
    confirm_password: '',
  });
  const [showForgotAnswer, setShowForgotAnswer] = useState(false);
  const [showForgotNewPass, setShowForgotNewPass] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState({ type: '', text: '' });

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) {
      errs.username = 'Username or email is required';
    }
    if (!form.password) {
      errs.password = 'Password is required';
    }
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

  // Step 1: Lookup admin account and fetch security question
  const handleLookupQuestion = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setForgotMsg({ type: '', text: '' });

    if (!forgotForm.identifier.trim()) {
      setForgotMsg({ type: 'error', text: 'Please enter your username or registered email address.' });
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post('/auth/get-security-question', {
        identifier: forgotForm.identifier.trim(),
      });

      if (res.data.success) {
        setForgotForm((prev) => ({
          ...prev,
          question: res.data.question || '',
          has_question: res.data.has_question,
          available_questions: res.data.available_questions || [],
          chosen_question: res.data.question || res.data.available_questions?.[0] || "What is your father's name?",
        }));
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

  // Step 2: Verify secret answer and reset password
  const handleResetWithSecurityAnswer = async (e) => {
    e.preventDefault();
    setForgotMsg({ type: '', text: '' });

    if (!forgotForm.security_answer.trim()) {
      setForgotMsg({ type: 'error', text: 'Please enter your secret answer.' });
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
      const res = await api.post('/auth/reset-password-security-question', {
        identifier: forgotForm.identifier.trim(),
        security_answer: forgotForm.security_answer.trim(),
        new_password: forgotForm.new_password,
        confirm_password: forgotForm.confirm_password,
        chosen_question: forgotForm.chosen_question,
      });

      if (res.data.success) {
        setForgotMsg({
          type: 'success',
          text: 'Password reset successfully! Logging you in...',
        });
        setForm({
          username: forgotForm.identifier.trim(),
          password: forgotForm.new_password,
        });
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep(1);
          setForgotForm({
            identifier: '',
            question: '',
            has_question: true,
            available_questions: [],
            chosen_question: '',
            security_answer: '',
            new_password: '',
            confirm_password: '',
          });
          setForgotMsg({ type: '', text: '' });
        }, 1800);
      }
    } catch (err) {
      setForgotMsg({
        type: 'error',
        text: err.response?.data?.message || 'Incorrect secret answer. Please try again.',
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const [pingLatency, setPingLatency] = useState(null);

  const handleTestServer = async (targetUrl = serverUrl) => {
    setServerTestStatus('testing');
    setPingLatency(null);
    const start = performance.now();
    try {
      const cleanUrl = normalizeApiUrl(targetUrl);
      const testUrl = `${cleanUrl}/health`;
      const res = await fetch(testUrl, { method: 'GET' });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        setServerTestStatus('success');
        setPingLatency(latency);
        setServerUrl(cleanUrl);
        updateApiBaseUrl(cleanUrl);
      } else {
        setServerTestStatus('error');
      }
    } catch {
      setServerTestStatus('error');
    }
  };

  const handleSelectPreset = (url) => {
    const cleanUrl = normalizeApiUrl(url);
    setServerUrl(cleanUrl);
    setServerTestStatus(null);
    setPingLatency(null);
    handleTestServer(cleanUrl);
  };

  const handleSaveServer = (e) => {
    e.preventDefault();
    const cleanUrl = normalizeApiUrl(serverUrl);
    updateApiBaseUrl(cleanUrl);
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
          <div className="genz-alert" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
            {(error.includes('server') || error.includes('connect') || error.includes('reach') || error.includes('Network')) && (
              <button
                type="button"
                className="btn-server-config"
                style={{ marginTop: '0.25rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' }}
                onClick={() => {
                  setServerTestStatus(null);
                  setShowServerModal(true);
                }}
              >
                <Server size={12} />
                <span>Change Server IP / Connect to Cloud</span>
              </button>
            )}
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
            title="Configure and switch between Cloud and Local backend server"
          >
            <span className="server-icon-dot" />
            <Server size={14} />
            <span>Server Endpoint Settings</span>
          </button>
        </div>
      </div>

      {/* Server IP / Cloud Endpoint Config Modal */}
      {showServerModal && (
        <div className="forgot-modal-overlay" onClick={() => setShowServerModal(false)}>
          <div className="forgot-modal-card server-endpoint-modal" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <div className="forgot-header-title">
                <div className="forgot-icon-badge server-badge-glow">
                  <Globe size={22} />
                </div>
                <div>
                  <h3 className="modal-title">API Server Connection</h3>
                  <p className="modal-subtitle">Configure backend cloud or local connection for this device.</p>
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

            {/* Quick Preset Selector */}
            <div className="server-presets-section">
              <label className="preset-label">Choose Server Preset</label>
              <div className="preset-grid" style={{ gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`preset-card ${serverUrl.includes('172.25.8.130') ? 'active' : ''}`}
                  onClick={() => handleSelectPreset('http://172.25.8.130:5000/api')}
                >
                  <div className="preset-card-icon local-icon">
                    <Wifi size={18} />
                  </div>
                  <div className="preset-card-info">
                    <div className="preset-name">Local Wi-Fi PC Server (Fast)</div>
                    <div className="preset-url">http://172.25.8.130:5000/api</div>
                  </div>
                  {serverUrl.includes('172.25.8.130') && <span className="preset-check">✓</span>}
                </button>

                <button
                  type="button"
                  className={`preset-card ${serverUrl.includes('onrender.com') ? 'active' : ''}`}
                  onClick={() => handleSelectPreset('https://schoolmanagementwebapp-pf7m.onrender.com/api')}
                >
                  <div className="preset-card-icon cloud-icon">
                    <Cloud size={18} />
                  </div>
                  <div className="preset-card-info">
                    <div className="preset-name">Render Cloud 24/7 (Anywhere)</div>
                    <div className="preset-url">schoolmanagementwebapp-pf7m.onrender.com</div>
                  </div>
                  {serverUrl.includes('onrender.com') && <span className="preset-check">✓</span>}
                </button>

                <button
                  type="button"
                  className={`preset-card ${serverUrl.includes('localhost') ? 'active' : ''}`}
                  onClick={() => handleSelectPreset('http://localhost:5000/api')}
                >
                  <div className="preset-card-icon local-icon">
                    <Laptop size={18} />
                  </div>
                  <div className="preset-card-info">
                    <div className="preset-name">Localhost (PC Browser)</div>
                    <div className="preset-url">http://localhost:5000/api</div>
                  </div>
                  {serverUrl.includes('localhost') && <span className="preset-check">✓</span>}
                </button>
              </div>
            </div>

            <form className="forgot-form" onSubmit={handleSaveServer}>
              <div className="genz-field">
                <label>Custom Endpoint URL</label>
                <div className="input-wrap">
                  <input
                    type="url"
                    placeholder="https://your-server-url.com/api"
                    value={serverUrl}
                    onChange={(e) => {
                      setServerUrl(e.target.value);
                      setServerTestStatus(null);
                      setPingLatency(null);
                    }}
                    required
                  />
                </div>
              </div>

              {/* Status & Latency Badge */}
              {serverTestStatus === 'testing' && (
                <div className="server-status-pill testing">
                  <Loader2 size={15} className="spin" />
                  <span>Pinging server &amp; testing health check…</span>
                </div>
              )}

              {serverTestStatus === 'success' && (
                <div className="server-status-pill success">
                  <CheckCircle2 size={16} />
                  <span>
                    Server Online &bull; <strong>{pingLatency ? `${pingLatency}ms latency` : 'Connected'}</strong>
                  </span>
                </div>
              )}

              {serverTestStatus === 'error' && (
                <div className="server-status-pill error">
                  <AlertCircle size={16} />
                  <span>Cannot reach server. Verify connection and URL.</span>
                </div>
              )}

              <div className="modal-btn-row">
                <button
                  type="button"
                  className="modal-sec-btn"
                  onClick={() => handleTestServer()}
                  disabled={serverTestStatus === 'testing'}
                >
                  <Activity size={15} />
                  <span>Ping &amp; Test</span>
                </button>
                <button type="submit" className="modal-pri-btn">
                  Save &amp; Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Recovery Modal (Security Question Recovery Flow) */}
      {showForgotModal && (
        <div className="forgot-modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="forgot-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <div className="forgot-header-title">
                <div className="forgot-icon-badge">
                  {forgotStep === 1 ? <KeyRound size={20} /> : <HelpCircle size={20} />}
                </div>
                <div>
                  <h3 className="modal-title">
                    {forgotStep === 1 ? 'Find Admin Account' : 'Security Question Verification'}
                  </h3>
                  <p className="modal-subtitle">
                    {forgotStep === 1
                      ? 'Enter your username or email to retrieve your security question.'
                      : 'Answer your secret question to reset your password instantly.'}
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

            {/* STEP 1: Enter Username/Email */}
            {forgotStep === 1 && (
              <form className="forgot-form" onSubmit={handleLookupQuestion}>
                <div className="genz-field">
                  <label>Admin Username or Registered Email</label>
                  <div className="input-wrap">
                    <input
                      type="text"
                      placeholder="e.g. Vikram or admin"
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
                      <Loader2 size={16} className="spin" /> Finding Account…
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} /> Continue to Security Question
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Answer Security Question & Set New Password */}
            {forgotStep === 2 && (
              <form className="forgot-form" onSubmit={handleResetWithSecurityAnswer}>
                {/* Display Security Question */}
                <div className="security-question-banner">
                  <span className="sq-label">Security Question:</span>
                  {forgotForm.has_question ? (
                    <strong className="sq-question-text">❓ {forgotForm.question}</strong>
                  ) : (
                    <div className="sq-select-wrap">
                      <select
                        className="sq-select"
                        value={forgotForm.chosen_question}
                        onChange={(e) => setForgotForm({ ...forgotForm, chosen_question: e.target.value })}
                      >
                        {forgotForm.available_questions.map((q, idx) => (
                          <option key={idx} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Secret Answer */}
                <div className="genz-field">
                  <label>Your Secret Answer</label>
                  <div className="input-wrap">
                    <input
                      type={showForgotAnswer ? 'text' : 'password'}
                      placeholder="Enter your secret answer"
                      value={forgotForm.security_answer}
                      onChange={(e) => setForgotForm({ ...forgotForm, security_answer: e.target.value })}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowForgotAnswer(!showForgotAnswer)}
                      tabIndex={-1}
                    >
                      {showForgotAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="field-hint-text">Secret answer is case-insensitive.</span>
                </div>

                {/* New Password */}
                <div className="genz-field">
                  <label>New Password</label>
                  <div className="input-wrap">
                    <input
                      type={showForgotNewPass ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={forgotForm.new_password}
                      onChange={(e) => setForgotForm({ ...forgotForm, new_password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowForgotNewPass(!showForgotNewPass)}
                      tabIndex={-1}
                    >
                      {showForgotNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="genz-field">
                  <label>Confirm New Password</label>
                  <div className="input-wrap">
                    <input
                      type={showForgotNewPass ? 'text' : 'password'}
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
                      'Reset Password & Login'
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
