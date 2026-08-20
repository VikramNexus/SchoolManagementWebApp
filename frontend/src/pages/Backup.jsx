/**
 * Backup Page — School Management System (Frontend)
 * Eye-Comfort, Receipt-Themed Database Backup & Disaster Recovery
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HardDrive,
  FileArchive,
  Server,
  X,
  Eye,
  Calendar,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './Backup.css';

export default function Backup() {
  const { toast } = useToast();
  const [backups, setBackups] = useState([]);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await api.get('/backup/list');
      if (res.data.success) {
        setBackups(res.data.backups || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load backups');
    }
  }, [toast]);

  const fetchInfo = useCallback(async () => {
    try {
      const res = await api.get('/backup/info');
      if (res.data.success) {
        setInfo(res.data.info);
      }
    } catch (err) {
      console.error('Failed to load backup info:', err);
    }
  }, [toast]);

  useEffect(() => {
    Promise.all([fetchBackups(), fetchInfo()]).finally(() => setLoading(false));
  }, [fetchBackups, fetchInfo]);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const res = await api.post('/backup/create');
      if (res.data.success) {
        toast.success('Database backup created successfully');
        fetchBackups();
        fetchInfo();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      const response = await api.get(`/backup/download/${filename}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download backup');
    }
  };

  const handleDelete = async (filename) => {
    if (
      !window.confirm(
        `Are you sure you want to delete backup "${filename}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const res = await api.delete(`/backup/${filename}`);
      if (res.data.success) {
        toast.success('Backup snapshot deleted');
        fetchBackups();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete backup');
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      setRestoring(restoreTarget.filename);
      const res = await api.post(`/backup/restore/${restoreTarget.filename}`);
      if (res.data.success) {
        toast.success('Database restored successfully');
        setShowRestoreModal(false);
        setRestoreTarget(null);
        fetchInfo();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore backup');
    } finally {
      setRestoring(null);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.sql')) {
      toast.error('Please select a valid .sql backup file');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('backup', file);

      const res = await api.post('/backup/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        toast.success('Backup uploaded successfully');
        fetchBackups();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload backup');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColors = {
    completed: 'success',
    failed: 'danger',
    restored: 'info',
  };

  return (
    <div className="backup-container">
      {/* Header Card (Eye-Comfort Theme) */}
      <div className="backup-header-card">
        <div className="header-left-wrap">
          <div className="backup-icon-badge">
            <Database size={26} />
          </div>
          <div>
            <h1 className="backup-heading">Database Backup &amp; Disaster Recovery</h1>
            <p className="backup-subheading">
              Safeguard student ledgers, fee structures, and receipt payment histories with instant SQL database snapshots.
            </p>
          </div>
        </div>

        <div className="backup-header-actions">
          <label className="btn-upload-secondary">
            {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            <span>{uploading ? 'Uploading...' : 'Upload SQL File'}</span>
            <input
              type="file"
              accept=".sql"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>

          <button
            type="button"
            className="btn-create-backup-primary"
            onClick={handleCreateBackup}
            disabled={creating}
          >
            {creating ? <Loader2 size={17} className="spin" /> : <Plus size={17} />}
            <span>{creating ? 'Creating Snapshot...' : '+ Create SQL Snapshot'}</span>
          </button>

          <button
            type="button"
            className="btn-backup-refresh"
            onClick={() => {
              fetchBackups();
              fetchInfo();
            }}
            disabled={loading}
            title="Refresh Backups"
            aria-label="Refresh backups"
          >
            <RefreshCw size={17} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Info Health Summary Cards (Receipt Style) */}
      {info && (
        <div className="backup-summary-grid">
          {/* Current Database Size */}
          <div className="backup-stat-card primary">
            <div className="stat-card-top">
              <span className="stat-card-tag primary">Live Storage</span>
              <div className="stat-card-icon primary">
                <Database size={20} />
              </div>
            </div>
            <span className="stat-card-label">Database Footprint</span>
            <span className="stat-card-value">{info.database_size_mb || 0} MB</span>
            <span className="stat-card-subtext">MySQL school database size</span>
          </div>

          {/* Last Backup Snapshot */}
          <div className="backup-stat-card success">
            <div className="stat-card-top">
              <span className="stat-card-tag success">Safe Snapshot</span>
              <div className="stat-card-icon success">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <span className="stat-card-label">Last Saved Backup</span>
            <span className="stat-card-value font-md">
              {info.last_backup ? formatDate(info.last_backup.created_at) : 'No snapshots yet'}
            </span>
            <span className="stat-card-subtext">Recent automated or manual snapshot</span>
          </div>

          {/* Disk Available */}
          <div className="backup-stat-card blue">
            <div className="stat-card-top">
              <span className="stat-card-tag blue">Disk Partition</span>
              <div className="stat-card-icon blue">
                <HardDrive size={20} />
              </div>
            </div>
            <span className="stat-card-label">Available Server Space</span>
            <span className="stat-card-value">
              {info.disk_space?.available || 'Optimal'}
            </span>
            <span className="stat-card-subtext">
              {info.disk_space?.use_percent ? `Disk usage: ${info.disk_space.use_percent}` : 'Storage healthy'}
            </span>
          </div>

          {/* System Safety Status */}
          <div className="backup-stat-card emerald">
            <div className="stat-card-top">
              <span className="stat-card-tag emerald">Integrity</span>
              <div className="stat-card-icon emerald">
                <ShieldCheck size={20} />
              </div>
            </div>
            <span className="stat-card-label">Data Redundancy</span>
            <span className="stat-card-value">{backups.length} Snapshots</span>
            <span className="stat-card-subtext">Safe restore points available</span>
          </div>
        </div>
      )}

      {/* Backups Master Table Card */}
      <div className="backup-table-card">
        <div className="table-header-bar">
          <div className="table-header-left">
            <span className="table-header-title">Backup Snapshots Archive</span>
            <span className="table-count-pill">{backups.length} Snapshots Saved</span>
          </div>
        </div>

        {loading ? (
          <div className="table-loading-cell">
            <div className="cell-loader-wrap">
              <Loader2 size={24} className="spin text-primary" />
              <span>Loading database backup archives...</span>
            </div>
          </div>
        ) : backups.length === 0 ? (
          <div className="table-empty-cell">
            <div className="empty-state-box">
              <Database size={40} className="text-muted" />
              <p className="empty-title">No Backup Snapshots Found</p>
              <p className="empty-desc">
                Click "+ Create SQL Snapshot" above to take your first full database backup.
              </p>
              <button
                type="button"
                className="btn-create-first-backup"
                onClick={handleCreateBackup}
                disabled={creating}
              >
                + Create Snapshot Now
              </button>
            </div>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="backup-ledger-table" role="table">
              <thead>
                <tr>
                  <th>Snapshot File</th>
                  <th>Archive Size</th>
                  <th>Timestamp Created</th>
                  <th>Status</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.filename} className="backup-data-row">
                    <td>
                      <div className="backup-file-cell">
                        <FileArchive size={16} className="text-primary" />
                        <code className="backup-filename-code">{backup.filename}</code>
                      </div>
                    </td>
                    <td>
                      <strong className="backup-size-txt">{formatSize(backup.file_size)}</strong>
                    </td>
                    <td>
                      <span className="backup-date-txt">{formatDate(backup.created_at)}</span>
                    </td>
                    <td>
                      <span className={`backup-status-pill ${statusColors[backup.status] || 'info'}`}>
                        {backup.status?.toUpperCase() || 'COMPLETED'}
                      </span>
                    </td>
                    <td className="td-actions">
                      <div className="backup-action-buttons">
                        <button
                          type="button"
                          className="btn-backup-download"
                          onClick={() => handleDownload(backup.filename)}
                          title="Download SQL File"
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          className="btn-backup-restore"
                          onClick={() => {
                            setRestoreTarget(backup);
                            setShowRestoreModal(true);
                          }}
                          title="Restore Database from Snapshot"
                          disabled={backup.status === 'restored'}
                        >
                          <RotateCcw size={14} />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          className="btn-backup-delete"
                          onClick={() => handleDelete(backup.filename)}
                          title="Delete Snapshot"
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

      {/* Restore Confirmation Modal */}
      {showRestoreModal && (
        <div className="restore-modal-overlay" onClick={() => setShowRestoreModal(false)}>
          <div className="restore-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="restore-modal-header">
              <div className="restore-modal-title-wrap">
                <div className="warning-icon-box">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="modal-title">Confirm Database Restoration</h3>
                  <p className="modal-subtitle">Overwrite live data from backup archive</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowRestoreModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="restore-modal-body">
              <div className="restore-alert-box">
                <p>
                  <strong>Caution:</strong> Restoring will replace the current active MySQL database with the exact data snapshot stored in <code>{restoreTarget?.filename}</code>.
                </p>
              </div>

              <div className="restore-meta-box">
                <div className="meta-item">
                  <span className="meta-label">Snapshot Date:</span>
                  <span className="meta-val">{restoreTarget && formatDate(restoreTarget.created_at)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Archive Size:</span>
                  <span className="meta-val">{restoreTarget && formatSize(restoreTarget.file_size)}</span>
                </div>
              </div>
            </div>

            <div className="restore-modal-footer">
              <button
                type="button"
                className="btn-restore-cancel"
                onClick={() => setShowRestoreModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-restore-confirm"
                onClick={handleRestore}
                disabled={restoring === restoreTarget?.filename}
              >
                {restoring === restoreTarget?.filename ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <RotateCcw size={16} />
                )}
                <span>
                  {restoring === restoreTarget?.filename ? 'Restoring Database...' : 'Confirm & Restore'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
