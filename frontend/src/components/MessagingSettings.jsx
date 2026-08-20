/**
 * Messaging Settings Component — School Management System (Frontend)
 *
 * Day 8: Receipts & Messaging Foundation.
 *
 * Channel enablement and API-key management for SMS and WhatsApp.
 * Development Mock Mode logs messages to the database without external API costs.
 */

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  TestTube,
  Loader2,
  Save,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Key,
  ToggleLeft,
  ToggleRight,
  QrCode,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './MessagingSettings.css';

export default function MessagingSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    sms_enabled: 0,
    sms_provider: 'twilio',
    sms_api_key: '',
    sms_sender_id: '',
    sms_mock_mode: 1,
    whatsapp_enabled: 1,
    whatsapp_provider: 'local',
    whatsapp_api_key: '',
    whatsapp_phone_number_id: '',
    whatsapp_mock_mode: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSMS, setTestingSMS] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);

  // WhatsApp QR Code & Linked Device State
  const [qrState, setQrState] = useState({
    connected: false,
    status: 'connecting', // 'connecting' | 'qr_ready' | 'connected' | 'disconnected'
    qrCodeDataUrl: null,
    userPhone: null,
  });
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
    fetchWhatsAppQR();

    // Auto-poll QR status every 3.5 seconds
    const interval = setInterval(() => {
      fetchWhatsAppQR(true);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/messaging');
      if (res.data.success) {
        setSettings(res.data.settings);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load messaging settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsAppQR = async (isBackground = false) => {
    try {
      const res = await api.get('/settings/messaging/whatsapp-qr');
      if (res.data.success) {
        setQrState({
          connected: res.data.connected,
          status: res.data.status,
          qrCodeDataUrl: res.data.qrCodeDataUrl,
          userPhone: res.data.userPhone,
        });
      }
    } catch (err) {
      if (!isBackground) {
        console.error('[fetchWhatsAppQR]', err);
      }
    }
  };

  const handleRefreshQR = async () => {
    try {
      setRefreshingQr(true);
      const res = await api.post('/settings/messaging/whatsapp-restart');
      if (res.data.success) {
        setQrState({
          connected: res.data.connected,
          status: res.data.status,
          qrCodeDataUrl: res.data.qrCodeDataUrl,
          userPhone: res.data.userPhone,
        });
        toast.success('QR code refreshed. Scan with your phone.');
      }
    } catch (err) {
      toast.error('Failed to refresh QR code.');
    } finally {
      setRefreshingQr(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!window.confirm('Are you sure you want to disconnect this WhatsApp account?')) return;
    try {
      setDisconnecting(true);
      const res = await api.post('/settings/messaging/whatsapp-disconnect');
      if (res.data.success) {
        toast.success('WhatsApp disconnected. Scan a new QR code to reconnect.');
        fetchWhatsAppQR();
      }
    } catch (err) {
      toast.error('Failed to disconnect WhatsApp.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleChange = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [`${section}_${field}`]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        sms_enabled: settings.sms_enabled,
        sms_provider: settings.sms_provider,
        sms_api_key: settings.sms_api_key,
        sms_sender_id: settings.sms_sender_id,
        sms_mock_mode: settings.sms_mock_mode,
        whatsapp_enabled: settings.whatsapp_enabled,
        whatsapp_provider: settings.whatsapp_provider,
        whatsapp_api_key: settings.whatsapp_api_key,
        whatsapp_phone_number_id: settings.whatsapp_phone_number_id,
        whatsapp_mock_mode: settings.whatsapp_mock_mode,
      };

      const res = await api.put('/settings/messaging', payload);
      if (res.data.success) {
        toast.success('Messaging settings saved');
        setSettings(res.data.settings);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save messaging settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSMS = async () => {
    try {
      setTestingSMS(true);
      const phone = prompt('Enter phone number for test SMS:');
      if (!phone) return;

      const res = await api.post('/settings/messaging/test-sms', { phone_number: phone });
      if (res.data.success) {
        toast.success('Test SMS logged in mock mode');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test SMS');
    } finally {
      setTestingSMS(false);
    }
  };

  const handleTestWhatsApp = async () => {
    try {
      setTestingWhatsApp(true);
      const phone = prompt('Enter recipient WhatsApp number (with country code, e.g. 919876543210):');
      if (!phone) return;

      const res = await api.post('/settings/messaging/test-whatsapp', { phone_number: phone });
      if (res.data.success) {
        toast.success(res.data.message || 'Test WhatsApp message sent!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test WhatsApp');
    } finally {
      setTestingWhatsApp(false);
    }
  };

  if (loading) {
    return (
      <div className="messaging-loading">
        <Loader2 size={32} className="spin text-primary" />
        <span>Loading messaging settings...</span>
      </div>
    );
  }

  return (
    <div className="messaging-settings-container">
      {/* Header */}
      <div className="settings-section-header">
        <div>
          <h2>Messaging &amp; WhatsApp Integration</h2>
          <p>Link your school mobile phone via QR Code for 100% background WhatsApp receipt &amp; dues dispatch.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save Settings
        </button>
      </div>

      {/* Primary: QR Code Phone Linker Card */}
      <div className="qr-connector-card">
        <div className="qr-card-header">
          <div className="qr-header-left">
            <div className="qr-icon-pill">
              <Smartphone size={22} />
            </div>
            <div>
              <h3 className="qr-title">Link School Mobile Phone (100% Background Delivery)</h3>
              <p className="qr-subtitle">
                Scan once with your mobile phone. Your laptop will send WhatsApp fee receipts directly in the background!
              </p>
            </div>
          </div>
          <div className="qr-status-indicator">
            {qrState.connected ? (
              <span className="live-status-badge connected">
                <span className="pulse-dot green" /> Connected &amp; Active
              </span>
            ) : qrState.status === 'qr_ready' ? (
              <span className="live-status-badge qr-ready">
                <span className="pulse-dot orange" /> Ready to Scan
              </span>
            ) : (
              <span className="live-status-badge connecting">
                <Loader2 size={13} className="spin" /> Initializing Socket...
              </span>
            )}
          </div>
        </div>

        <div className="qr-card-body">
          {qrState.connected ? (
            /* Connected State */
            <div className="qr-connected-box">
              <div className="connected-avatar">
                <CheckCircle size={38} className="text-green" />
              </div>
              <div className="connected-info">
                <h4>WhatsApp Companion Device is Active</h4>
                <p className="phone-display">
                  Linked Account: <strong>{qrState.userPhone || 'School Mobile'}</strong>
                </p>
                <p className="connected-desc">
                  All fee receipts, dues notices, and admission receipts will be dispatched automatically through your WhatsApp account in the background with zero popups or redirects.
                </p>
              </div>
              <div className="connected-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleTestWhatsApp}
                  disabled={testingWhatsApp}
                >
                  {testingWhatsApp ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                  <span>Send Test Receipt</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm btn-disconnect"
                  onClick={handleDisconnectWhatsApp}
                  disabled={disconnecting}
                  title="Disconnect account and link another phone"
                >
                  {disconnecting ? <Loader2 size={14} className="spin" /> : <LogOut size={14} />}
                  <span>Switch / Unlink Phone</span>
                </button>
              </div>
            </div>
          ) : qrState.status === 'qr_ready' && qrState.qrCodeDataUrl ? (
            /* QR Ready State */
            <div className="qr-scan-grid">
              <div className="qr-code-frame">
                <img src={qrState.qrCodeDataUrl} alt="WhatsApp QR Code" className="qr-image" />
                <button
                  type="button"
                  className="btn-refresh-qr"
                  onClick={handleRefreshQR}
                  disabled={refreshingQr}
                  title="Refresh QR Code"
                >
                  <RefreshCw size={14} className={refreshingQr ? 'spin' : ''} />
                  <span>{refreshingQr ? 'Refreshing...' : 'Refresh QR'}</span>
                </button>
              </div>

              <div className="qr-instructions">
                <h4>How to Link Your Phone in 3 Simple Steps:</h4>
                <ol className="qr-steps-list">
                  <li>
                    <span className="step-num">1</span>
                    <span>Open <strong>WhatsApp</strong> on your mobile phone.</span>
                  </li>
                  <li>
                    <span className="step-num">2</span>
                    <span>Tap <strong>Settings (or ⋮ menu)</strong> &rarr; <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong>.</span>
                  </li>
                  <li>
                    <span className="step-num">3</span>
                    <span>Point your phone camera at the QR code on the left to scan it.</span>
                  </li>
                </ol>
                <div className="qr-security-note">
                  <ShieldCheck size={16} />
                  <span>Encrypted end-to-end. Session credentials stay stored locally on your laptop only.</span>
                </div>
              </div>
            </div>
          ) : (
            /* Loading / Initializing State */
            <div className="qr-initializing-box">
              <Loader2 size={32} className="spin text-primary" />
              <span>Generating fresh WhatsApp QR code for your laptop...</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleRefreshQR}
                style={{ marginTop: '0.8rem' }}
              >
                <RefreshCw size={14} /> Force Generate QR
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SMS Configuration Card */}
      <div className="channel-card">
        <div className="channel-header">
          <div className="channel-title">
            <MessageSquare size={20} />
            <h3>SMS Gateway Settings</h3>
          </div>
          <div className="channel-status">
            {settings.sms_enabled ? (
              <span className="status-badge active">
                <ToggleRight size={16} /> Enabled
              </span>
            ) : (
              <span className="status-badge inactive">
                <ToggleLeft size={16} /> Disabled
              </span>
            )}
          </div>
        </div>

        <div className="channel-body">
          <label className="toggle-row">
            <span>Enable SMS Channel</span>
            <input
              type="checkbox"
              checked={Boolean(settings.sms_enabled)}
              onChange={(e) => handleChange('sms', 'enabled', e.target.checked ? 1 : 0)}
            />
          </label>

          {settings.sms_enabled && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Provider</label>
                  <select
                    value={settings.sms_provider}
                    onChange={(e) => handleChange('sms', 'provider', e.target.value)}
                  >
                    <option value="twilio">Twilio</option>
                    <option value="msg91">MSG91</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sender ID</label>
                  <input
                    type="text"
                    value={settings.sms_sender_id || ''}
                    onChange={(e) => handleChange('sms', 'sender_id', e.target.value)}
                    placeholder="e.g., ARYAVT"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  <Key size={14} /> API Key / Auth Token
                </label>
                <input
                  type="password"
                  value={settings.sms_api_key || ''}
                  onChange={(e) => handleChange('sms', 'api_key', e.target.value)}
                  placeholder={settings.sms_api_key ? '•••••••• (unchanged)' : 'Enter API key'}
                />
              </div>

              <button className="btn btn-secondary btn-sm" onClick={handleTestSMS} disabled={testingSMS}>
                {testingSMS ? <Loader2 size={14} className="spin" /> : <TestTube size={14} />} Send Test SMS
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
