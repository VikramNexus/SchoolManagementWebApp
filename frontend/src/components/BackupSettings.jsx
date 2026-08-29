/**
 * BackupSettings Component — School Management System (Frontend)
 *
 * Provides:
 * 1. 1-Click System Database Snapshot & Disaster Recovery (.sql) — Mobile & Desktop
 * 2. 1-Click Google Drive / Cloud Storage upload integration
 * 3. Master Multi-Sheet Excel Financial & Demographic Archive (.xlsx) — Desktop View Only
 * 4. Cloud Email Vault automated backup delivery
 * 5. Safe Rollback Restore Modal with double-confirmation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Cloud,
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
  ExternalLink,
  Lock,
  X,
  Sparkles,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from './Toast';
import { saveFileToDeviceStorage } from '../utils/fileDownloader';
import './BackupSettings.css';

export default function BackupSettings() {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  // States
  const [info, setInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [sendingCloud, setSendingCloud] = useState(false);
  const [cloudEmail, setCloudEmail] = useState('');
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
      if (schoolRes.data.success && schoolRes.data.school?.email) {
        setCloudEmail(schoolRes.data.school.email);
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
        
        // Trigger direct download
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

  // 1-Click Save to Google Drive / Cloud Storage
  const handleSaveToCloudDrive = async () => {
    try {
      setCreatingBackup(true);
      // Generate fresh snapshot
      const res = await api.post('/backup/create');
      if (!res.data.success) throw new Error('Could not create backup');
      
      const filename = res.data.backup.filename;
      const fileRes = await api.get(`/backup/download/${filename}`, { responseType: 'blob' });
      const fileBlob = new Blob([fileRes.data], { type: 'application/sql' });

      // Save locally first
      await saveFileToDeviceStorage({
        data: fileBlob,
        filename,
        mimeType: 'application/sql',
      });

      // If native Web Share API with files is supported (Mobile / Chrome Desktop)
      let shared = false;
      if (typeof navigator !== 'undefined' && typeof File !== 'undefined' && navigator.canShare) {
        try {
          const file = new File([fileBlob], filename, { type: 'application/sql' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'School Database Backup',
              text: `School System Snapshot: ${filename}`,
            });
            shared = true;
            toast.success('✓ Shared to Google Drive / Cloud successfully!');
          }
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            console.warn('[WebShare]', shareErr);
          }
        }
      }

      if (!shared) {
        toast.info('Backup file saved! Opening Google Drive in new tab to upload...');
        setTimeout(() => {
          window.open('https://drive.google.com/drive/my-drive', '_blank');
        }, 800);
      }

      fetchData();
    } catch (err) {
      console.error('[handleSaveToCloudDrive]', err);
      toast.error('Failed to save to cloud storage.');
    } finally {
      setCreatingBackup(false);
    }
  };

  // 1-Click Export Master Multi-Sheet Excel Archive (.xlsx) — Desktop View
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

  // Dispatch Backup to Cloud Email Vault
  const handleSendCloudEmail = async (e) => {
    e.preventDefault();
    if (!cloudEmail || !cloudEmail.trim()) {
      toast.error('Please enter a valid recipient email address.');
      return;
    }
    try {
      setSendingCloud(true);
      const res = await api.post('/backup/send-cloud', {
        target_email: cloudEmail.trim(),
      });
      if (res.data.success) {
        toast.success(res.data.message || '✓ Backup sent to Cloud Email Vault!');
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
        toast.success('✓ Backup file uploaded and registered successfully!');
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
    <div className="backup-vault-container">
      {/* Header Banner */}
      <div className="vault-header-card">
        <div className="vault-header-content">
          <div className="vault-icon-badge">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h2 className="vault-title">System Backup &amp; Data Vault</h2>
            <p className="vault-subtitle">
              Disaster recovery snapshots, Google Drive / Cloud upload, and Excel master financial archives.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-vault-refresh"
          onClick={fetchData}
          disabled={loading}
          title="Refresh Vault Status"
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      {info && (
        <div className="vault-stats-grid">
          <div className="vault-stat-item">
            <div className="stat-icon-wrap" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
              <Database size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Protected Tables</span>
              <h3 className="stat-value">{info.table_count || 19} Tables</h3>
            </div>
          </div>

          <div className="vault-stat-item">
            <div className="stat-icon-wrap" style={{ background: 'rgba(22, 163, 74, 0.15)', color: '#16a34a' }}>
              <Layers size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Enrolled Records</span>
              <h3 className="stat-value">{info.student_count || 0} Students</h3>
            </div>
          </div>

          <div className="vault-stat-item">
            <div className="stat-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
              <Calendar size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Last Backup Snapshot</span>
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
            </div>
          </div>

          <div className="vault-stat-item">
            <div className="stat-icon-wrap" style={{ background: 'rgba(217, 119, 6, 0.15)', color: '#d97706' }}>
              <Cloud size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Cloud Vault Status</span>
              <h3 className="stat-value" style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={16} /> Ready
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Main Actions Row */}
      <div className="vault-actions-grid">
        {/* Card 1: 1-Click Database Disaster Recovery (All Devices) */}
        <div className="vault-card primary-backup-card">
          <div className="card-header-row">
            <div className="card-title-wrap">
              <HardDrive size={22} className="card-icon" />
              <div>
                <h3 className="card-title">1-Click Full System Backup</h3>
                <span className="card-tag">Disaster Recovery (.sql)</span>
              </div>
            </div>
          </div>
          <p className="card-desc">
            Instantly generates a native SQL snapshot containing all 19 database tables (students, fee ledgers, payments, receipts, and settings).
          </p>

          <div className="card-btn-stack">
            <button
              type="button"
              className="btn-vault-action btn-primary-backup"
              onClick={handleCreateBackup}
              disabled={creatingBackup}
            >
              {creatingBackup ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
              <span>{creatingBackup ? 'Generating Snapshot…' : '⬇️ Download System Backup (.sql)'}</span>
            </button>

            <button
              type="button"
              className="btn-vault-action btn-cloud-drive"
              onClick={handleSaveToCloudDrive}
              disabled={creatingBackup}
            >
              <Cloud size={18} />
              <span>☁️ Save to Google Drive / Cloud</span>
            </button>

            <div className="upload-manual-wrap">
              <input
                type="file"
                ref={fileInputRef}
                accept=".sql"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn-vault-action btn-upload-backup"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingBackup}
              >
                {uploadingBackup ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <span>{uploadingBackup ? 'Uploading…' : 'Upload Existing .sql File'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Master Multi-Sheet Excel Archive (DESKTOP VIEW ONLY) */}
        <div className="vault-card excel-vault-card desktop-only-excel-vault">
          <div className="card-header-row">
            <div className="card-title-wrap">
              <FileSpreadsheet size={22} className="card-icon excel-icon" />
              <div>
                <h3 className="card-title">Master Excel Data Vault</h3>
                <span className="card-tag excel-tag">Desktop View Only (.xlsx)</span>
              </div>
            </div>
          </div>
          <p className="card-desc">
            Export a complete, human-readable 5-sheet Excel workbook containing Student Directory, Fee Ledgers, Dues Register, and Class Rates for offline auditing in Microsoft Excel.
          </p>

          <div className="excel-features-list">
            <div className="feature-pill">✓ 5 Color-Coded Sheets</div>
            <div className="feature-pill">✓ Student Directory</div>
            <div className="feature-pill">✓ Collections Ledger</div>
            <div className="feature-pill">✓ Outstanding Dues</div>
          </div>

          <div className="card-btn-stack">
            <button
              type="button"
              className="btn-vault-action btn-excel-export"
              onClick={handleExportMasterExcel}
              disabled={exportingExcel}
            >
              {exportingExcel ? <Loader2 size={18} className="spin" /> : <FileSpreadsheet size={18} />}
              <span>{exportingExcel ? 'Generating Master Excel…' : '📊 Export Master School Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: Cloud Email Backup Vault */}
      <div className="vault-card email-vault-card">
        <div className="card-header-row">
          <div className="card-title-wrap">
            <Mail size={22} className="card-icon" />
            <div>
              <h3 className="card-title">Cloud Email Backup Vault</h3>
              <span className="card-tag">Automated Storage Dispatch</span>
            </div>
          </div>
        </div>
        <p className="card-desc">
          Dispatch an encrypted backup snapshot directly to the Principal / School Google Drive storage email address.
        </p>

        <form className="email-dispatch-form" onSubmit={handleSendCloudEmail}>
          <div className="email-input-group">
            <input
              type="email"
              className="vault-email-input"
              value={cloudEmail}
              onChange={(e) => setCloudEmail(e.target.value)}
              placeholder="e.g. school.principal@gmail.com"
              required
            />
            <button
              type="submit"
              className="btn-vault-action btn-send-email"
              disabled={sendingCloud}
            >
              {sendingCloud ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              <span>{sendingCloud ? 'Dispatching…' : '🚀 Send Snapshot to Cloud Email'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Section 4: Server Backup History Table */}
      <div className="vault-card history-card">
        <div className="card-header-row">
          <div className="card-title-wrap">
            <Calendar size={20} className="card-icon" />
            <div>
              <h3 className="card-title">Stored Backup Snapshots</h3>
              <span className="card-tag">{backups.length} Available</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="vault-loading-state">
            <Loader2 size={28} className="spin" />
            <p>Loading backup repository…</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="vault-empty-state">
            <HardDrive size={40} />
            <h4>No Stored Backups Yet</h4>
            <p>Click "Download System Backup" above to generate your first snapshot.</p>
          </div>
        ) : (
          <div className="table-responsive vault-table-wrap">
            <table className="vault-table">
              <thead>
                <tr>
                  <th>Backup File</th>
                  <th>Size</th>
                  <th>Created Date</th>
                  <th>Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="file-cell">
                        <FileText size={16} className="file-icon" />
                        <code className="file-name">{b.filename}</code>
                      </div>
                    </td>
                    <td>{formatBytes(b.file_size)}</td>
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
                    <td className="text-center">
                      <div className="table-action-btns">
                        <button
                          type="button"
                          className="btn-table-action download"
                          onClick={() => handleDownloadBackup(b.filename)}
                          title="Download .sql snapshot"
                        >
                          <Download size={14} /> Download
                        </button>
                        <button
                          type="button"
                          className="btn-table-action restore"
                          onClick={() => handleOpenRestoreModal(b)}
                          title="Rollback database to this snapshot"
                        >
                          <RefreshCw size={14} /> Restore
                        </button>
                        <button
                          type="button"
                          className="btn-table-action delete"
                          onClick={() => setDeletingBackup(b)}
                          title="Delete snapshot"
                        >
                          <Trash2 size={14} />
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
          <div className="modal vault-safety-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-danger">
                <AlertTriangle size={24} />
                <h2>Restore Database Snapshot</h2>
              </div>
              {!restoring && (
                <button className="modal-close" onClick={() => setRestoreModalOpen(false)} aria-label="Close">
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="modal-body">
              <div className="safety-alert-banner">
                <AlertTriangle size={28} className="banner-icon" />
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
                {restoring ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
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
                  <X size={20} />
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
                {isDeleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                <span>{isDeleting ? 'Deleting…' : 'Delete Snapshot'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
