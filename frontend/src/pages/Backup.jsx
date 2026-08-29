/**
 * Backup Page — School Management System (Frontend)
 *
 * Dedicated Backup & Disaster Recovery Desk.
 * Unified with the enhanced BackupSettings suite:
 * - 1-Click Full System Database Snapshot (.sql)
 * - 1-Click Google Drive / Cloud Storage Upload
 * - Master Multi-Sheet Excel Financial & Demographic Archive (Desktop Only)
 * - Cloud Email Backup Vault
 * - Guarded Multi-Step Safe Database Restore
 */

import React from 'react';
import BackupSettings from '../components/BackupSettings';
import './Backup.css';

export default function Backup() {
  return (
    <div className="backup-page-wrapper">
      <BackupSettings />
    </div>
  );
}
