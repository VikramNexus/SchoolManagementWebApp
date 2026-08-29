/**
 * BackupSettings Component — School Management System (Frontend)
 *
 * Ultra-Clean, Eye-Comfort, Elevated Design matching Payments & Receipts suite:
 * 1. 1-Click System Database Snapshot & Disaster Recovery (.sql)
 * 2. 1-Click Send Snapshot to Cloud Email (Defaulted to Admin Email ID)
 * 3. Master Multi-Sheet Excel Financial & Demographic Archive (.xlsx) — Desktop View Only
 * 4. Safe Rollback Restore Modal with double-confirmation ("RESTORE")
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Calendar,
  Layers,
  Database,
  FileText,
  Mail,
  Send,
  X,
  Sparkles,
  DollarSign,
  FileCode,
} from 'lucide-react';
import { api, useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { saveFileToDeviceStorage } from '../utils/fileDownloader';
import './BackupSettings.css';

export default function BackupSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // States
  const [info, setInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [sendingCloud, setSendingCloud] = useState(false);
  const [cloudEmail, setCloudEmail] = useState(user?.email || 'admin@school.com');
  const [uploadingBackup, setUploadingBackup] = useState(false);

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Delete Confirmation Modal State
  const [deletingBackup, setDeletingBackup] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch initial info & backups
  const fetchData = async () => {
    try {
      setLoading(true);
      const [infoRes, listRes, schoolRes] = await Promise.all([
        api.get('/backup/info'),
        api.get('/backup/list'),
        api.get('/settings/school'),
      ]);

      if (infoRes.data.success) setInfo(infoRes.data.info);
      if (listRes.data.success) setBackups(listRes.data.backups || []);
      
      // Default to logged in user email, fallback to school email
      const defaultEmail = user?.email || schoolRes.data.school?.email || 'admin@school.com';
      if (defaultEmail) {
        setCloudEmail(defaultEmail);
      }
    } catch (err) {
      console.error('[BackupSettings.fetchData]', err);
      toast.error('Failed to load backup system status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format file size
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 1-Click Create & Download System Database Backup (.sql)
  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true);
      const res = await api.post('/backup/create');
      if (res.data.success) {
        toast.success('✓ Database snapshot generated successfully!');
        const filename = res.data.backup.filename;
        
        // Trigger download
        await handleDownloadBackup(filename);
        fetchData();
      }
    } catch (err) {
      console.error('[handleCreateBackup]', err);
      toast.error(err.response?.data?.message || 'Failed to create system backup.');
    } finally {
      setCreatingBackup(false);
    }
  };

  // Download specific backup file
  const handleDownloadBackup = async (filename) => {
    try {
      const res = await api.get(`/backup/download/${filename}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/sql' });
      await saveFileToDeviceStorage({
        data: blob,
        filename,
        mimeType: 'application/sql',
      });
      toast.success(`✓ Downloaded: ${filename}`);
    } catch (err) {
      console.error('[handleDownloadBackup]', err);
      toast.error('Failed to download backup file.');
    }
  };

  // 1-Click Export Master Multi-Sheet Excel Archive (.xlsx) — Desktop View Only
  const handleExportMasterExcel = async () => {
    try {
      setExportingExcel(true);
      const res = await api.get('/backup/export-excel', {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const filename = `School_Master_Archive_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await saveFileToDeviceStorage({
        data: blob,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      toast.success('✓ Master Excel Archive exported successfully!');
    } catch (err) {
      console.error('[handleExportMasterExcel]', err);
      toast.error('Failed to export Master Excel archive.');
    } finally {
      setExportingExcel(false);
    }
  };

  // 1-Click Dispatch Backup to Cloud Email Vault (Admin Email)
  const handleSendCloudEmail = async (e) => {
    if (e) e.preventDefault();
    const target = (cloudEmail && cloudEmail.trim()) || user?.email || 'admin@school.com';
    try {
      setSendingCloud(true);
      const res = await api.post('/backup/send-cloud', {
        target_email: target,
      });
      if (res.data.success) {
        toast.success(res.data.message || `✓ Backup snapshot sent to ${target}!`);
        fetchData();
      }
    } catch (err) {
      console.error('[handleSendCloudEmail]', err);
      toast.error(err.response?.data?.message || 'Failed to dispatch cloud email.');
    } finally {
      setSendingCloud(false);
    }
  };

  // Upload custom .sql backup file from computer
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.sql')) {
      toast.error('Please select a valid .sql database backup file.');
      return;
    }

    const formData = new FormData();
    formData.append('backup', file);

    try {
      setUploadingBackup(true);
      const res = await api.post('/backup/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        toast.success('✓ Backup file uploaded successfully!');
        fetchData();
      }
    } catch (err) {
      console.error('[handleFileUpload]', err);
      toast.error(err.response?.data?.message || 'Failed to upload backup file.');
    } finally {
      setUploadingBackup(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open Restore Modal
  const handleOpenRestoreModal = (backup) => {
    setSelectedBackupForRestore(backup);
    setRestoreConfirmText('');
    setRestoreModalOpen(true);
  };

  // Execute Safe Database Restore
  const handleExecuteRestore = async () => {
    if (restoreConfirmText.trim().toUpperCase() !== 'RESTORE') {
      toast.error('Please type RESTORE to confirm system rollback.');
      return;
    }
    if (!selectedBackupForRestore) return;

    try {
      setRestoring(true);
      const res = await api.post(`/backup/restore/${selectedBackupForRestore.filename}`);
      if (res.data.success) {
        toast.success('✓ Database successfully restored to snapshot state!');
        setRestoreModalOpen(false);
        setSelectedBackupForRestore(null);
        setRestoreConfirmText('');
        fetchData();
      }
    } catch (err) {
      console.error('[handleExecuteRestore]', err);
      toast.error(err.response?.data?.message || 'Failed to restore database.');
    } finally {
      setRestoring(false);
    }
  };

  // Delete Backup File
  const handleDeleteBackup = async () => {
    if (!deletingBackup) return;
    try {
      setIsDeleting(true);
      const res = await api.delete(`/backup/${deletingBackup.filename}`);
      if (res.data.success) {
        toast.success('✓ Backup file deleted.');
        setDeletingBackup(null);
        fetchData();
      }
    } catch (err) {
      console.error('[handleDeleteBackup]', err);
      toast.error('Failed to delete backup file.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="backup-desk-container">
      {/* Top Header Card (Eye-Comfort Modern Theme) */}
      <div className="backup-header-card">
        <div className="header-left-info">
          <div className="backup-icon-badge">
            <Database size={24} />
          </div>
          <div>
            <h1 className="backup-title">Database Backup &amp; Disaster Recovery</h1>
            <p className="backup-subtitle">
              Safeguard student ledgers, fee receipts, and database tables with instant 1-click snapshots and cloud email vault.
            </p>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="btn-backup-refresh"
            onClick={fetchData}
            disabled={loading}
            title="Refresh Status"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      {info && (
        <div className="backup-stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrap icon-blue">
              <Database size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Protected Tables</span>
              <h3 className="stat-value">{info.table_count || 19} Tables</h3>
              <span className="stat-sub">100% schema integrity</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap icon-green">
              <Layers size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Enrolled Students</span>
              <h3 className="stat-value">{info.student_count || 0} Students</h3>
              <span className="stat-sub">Active demographic records</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap icon-purple">
              <Calendar size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Last Snapshot</span>
              <h3 className="stat-value" style={{ fontSize: '0.95rem' }}>
                {info.last_backup
                  ? new Date(info.last_backup.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'No backups yet'}
              </h3>
              <span className="stat-sub">Safe recovery checkpoint</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap icon-amber">
              <ShieldCheck size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Stored Snapshots</span>
              <h3 className="stat-value">{backups.length} Available</h3>
              <span className="stat-sub">Instant restore points</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Feature Cards Grid */}
      <div className="backup-features-grid">
        {/* Card 1: 1-Click Database Disaster Recovery */}
        <div className="feature-card">
          <div className="feature-card-header">
            <div className="feature-title-wrap">
              <div className="feature-mini-icon blue">
                <HardDrive size={18} />
              </div>
              <div>
                <h3 className="feature-title">1-Click Full System Backup</h3>
                <span className="feature-badge blue">Complete SQL Dump (.sql)</span>
              </div>
            </div>
          </div>

          <p className="feature-desc">
            Instantly generates and downloads a native SQL snapshot containing all 19 database tables (students, fee ledgers, payments, receipts, and settings).
          </p>

          <div className="feature-btn-stack">
            <button
              type="button"
              className="btn-action-primary"
              onClick={handleCreateBackup}
              disabled={creatingBackup}
            >
              {creatingBackup ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
              <span>{creatingBackup ? 'Generating Snapshot…' : 'Download System Backup (.sql)'}</span>
            </button>

            <div className="upload-btn-wrap">
              <input
                type="file"
                ref={fileInputRef}
                accept=".sql"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn-action-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingBackup}
              >
                {uploadingBackup ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                <span>{uploadingBackup ? 'Uploading…' : 'Upload Existing .sql File'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Master Multi-Sheet Excel Archive (DESKTOP VIEW ONLY) */}
        <div className="feature-card desktop-only-excel-vault">
          <div className="feature-card-header">
            <div className="feature-title-wrap">
              <div className="feature-mini-icon green">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <h3 className="feature-title">Master Excel Data Vault</h3>
                <span className="feature-badge green">Desktop View Only (.xlsx)</span>
              </div>
            </div>
          </div>

          <p className="feature-desc">
            Export a complete, human-readable 5-sheet formatted Excel workbook containing Student Directory, Fee Ledgers, Dues Register, and Class Rates for offline auditing in Microsoft Excel.
          </p>

          <div className="excel-pills-row">
            <span className="pill-tag">✓ 5 Color Sheets</span>
            <span className="pill-tag">✓ Student Directory</span>
            <span className="pill-tag">✓ Fee Ledger</span>
            <span className="pill-tag">✓ Dues Register</span>
          </div>

          <div className="feature-btn-stack">
            <button
              type="button"
              className="btn-action-green"
              onClick={handleExportMasterExcel}
              disabled={exportingExcel}
            >
              {exportingExcel ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />}
              <span>{exportingExcel ? 'Generating Master Excel…' : 'Export Master School Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: Cloud Email Backup Vault */}
      <div className="email-vault-card">
        <div className="email-card-header">
          <div className="feature-title-wrap">
            <div className="feature-mini-icon indigo">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="feature-title">Cloud Email Backup Vault</h3>
              <span className="feature-badge indigo">Direct Email Dispatch</span>
            </div>
          </div>
        </div>

        <p className="feature-desc">
          Dispatch an encrypted backup snapshot directly to your Admin / School email address with 1-click.
        </p>

        <form className="email-form-layout" onSubmit={handleSendCloudEmail}>
          <div className="email-input-container">
            <label className="email-input-label">Recipient Admin Email:</label>
            <div className="email-input-wrap">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                className="email-input-field"
                value={cloudEmail}
                onChange={(e) => setCloudEmail(e.target.value)}
                placeholder="e.g. admin@school.com"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-action-indigo"
            disabled={sendingCloud}
          >
            {sendingCloud ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            <span>{sendingCloud ? 'Dispatching Backup…' : '🚀 Send Snapshot to Cloud Email'}</span>
          </button>
        </form>
      </div>

      {/* Section 4: Stored Backup Snapshots Archive Table */}
      <div className="history-table-card">
        <div className="table-header-row">
          <div className="table-title-wrap">
            <h3 className="table-main-title">Stored Backup Snapshots</h3>
            <span className="table-badge-count">{backups.length} Snapshots Saved</span>
          </div>
        </div>

        {loading ? (
          <div className="table-state-box">
            <Loader2 size={24} className="spin text-primary" />
            <p>Loading database backup repository…</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="table-state-box">
            <Database size={36} className="text-muted" />
            <h4>No Stored Backups Yet</h4>
            <p>Click "Download System Backup" above to generate your first snapshot.</p>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="backup-table">
              <thead>
                <tr>
                  <th>Backup File</th>
                  <th>Size</th>
                  <th>Created Date</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="file-name-cell">
                        <FileCode size={16} className="file-code-icon" />
                        <code className="file-code-name">{b.filename}</code>
                      </div>
                    </td>
                    <td>
                      <strong>{formatBytes(b.file_size)}</strong>
                    </td>
                    <td>
                      {new Date(b.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <span className={`status-pill ${b.status === 'restored' ? 'restored' : 'completed'}`}>
                        {b.status === 'restored' ? 'Restored' : 'Available'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="row-action-btns">
                        <button
                          type="button"
                          className="btn-row-action download"
                          onClick={() => handleDownloadBackup(b.filename)}
                          title="Download SQL File"
                        >
                          <Download size={13} />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          className="btn-row-action restore"
                          onClick={() => handleOpenRestoreModal(b)}
                          title="Rollback database to this snapshot"
                        >
                          <RefreshCw size={13} />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          className="btn-row-action delete"
                          onClick={() => setDeletingBackup(b)}
                          title="Delete snapshot"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safety Restore Modal */}
      {restoreModalOpen && selectedBackupForRestore && (
        <div className="modal-overlay" onClick={() => !restoring && setRestoreModalOpen(false)}>
          <div className="modal backup-safety-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-danger">
                <AlertTriangle size={22} />
                <h2>Restore Database Snapshot</h2>
              </div>
              {!restoring && (
                <button className="modal-close" onClick={() => setRestoreModalOpen(false)} aria-label="Close">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="modal-body">
              <div className="safety-alert-banner">
                <AlertTriangle size={24} className="banner-icon" />
                <div>
                  <strong>CRITICAL WARNING: System Rollback</strong>
                  <p>
                    Restoring this snapshot will replace current student, fee, and payment records with data from{' '}
                    <strong>{selectedBackupForRestore.filename}</strong>.
                  </p>
                </div>
              </div>

              <div className="safety-info-card">
                <div className="info-row">
                  <span>Target Snapshot:</span>
                  <code>{selectedBackupForRestore.filename}</code>
                </div>
                <div className="info-row">
                  <span>Created Date:</span>
                  <strong>
                    {new Date(selectedBackupForRestore.created_at).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="info-row">
                  <span>File Size:</span>
                  <span>{formatBytes(selectedBackupForRestore.file_size)}</span>
                </div>
              </div>

              <div className="confirm-input-wrap">
                <label htmlFor="restoreConfirm">
                  To confirm, type <strong style={{ color: '#dc2626' }}>RESTORE</strong> below:
                </label>
                <input
                  type="text"
                  id="restoreConfirm"
                  className="confirm-text-input"
                  placeholder="Type RESTORE to proceed"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  disabled={restoring}
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRestoreModalOpen(false)}
                disabled={restoring}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ background: '#dc2626', color: '#fff' }}
                disabled={restoreConfirmText.trim().toUpperCase() !== 'RESTORE' || restoring}
                onClick={handleExecuteRestore}
              >
                {restoring ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                <span>{restoring ? 'Restoring System Database…' : 'Execute Database Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBackup && (
        <div className="modal-overlay" onClick={() => !isDeleting && setDeletingBackup(null)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Backup Snapshot</h2>
              {!isDeleting && (
                <button className="modal-close" onClick={() => setDeletingBackup(null)} aria-label="Close">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete <code>{deletingBackup.filename}</code>? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingBackup(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteBackup}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                <span>{isDeleting ? 'Deleting…' : 'Delete Snapshot'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
