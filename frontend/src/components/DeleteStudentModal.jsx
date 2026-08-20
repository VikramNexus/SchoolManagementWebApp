/**
 * DeleteStudentModal — School Management System (Frontend)
 *
 * Modal for student deletion with choices:
 *   1. Soft Delete ("Mark as Left / TC Issued") — preserves receipts for audit.
 *   2. Permanent Delete — purges record from DB (with optional force parameter).
 */

import { useState } from 'react';
import { X, Trash2, UserX, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './DeleteStudentModal.css';

export default function DeleteStudentModal({ student, onClose, onDeleted }) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [mode, setMode] = useState('soft'); // 'soft' or 'permanent'
  const [forceDelete, setForceDelete] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const url = `/students/${student.id}?mode=${mode}${mode === 'permanent' && forceDelete ? '&force=true' : ''}`;
      const res = await api.delete(url);
      if (res.data.success) {
        toast.success(res.data.message || 'Student processed successfully.');
        onDeleted();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to process student deletion.';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header danger-header">
          <h2>Student Departure / Deletion</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="warning-banner">
            <AlertTriangle size={24} className="warning-icon" />
            <div>
              <strong>Student: {student?.full_name}</strong>
              <p>Admission No. {student?.admission_no} • Class {student?.class_name || ''}</p>
            </div>
          </div>

          <p className="instruction-text">
            Choose how you would like to handle this student's departure:
          </p>

          <div className="delete-options">
            <label className={`option-card ${mode === 'soft' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="delete_mode"
                value="soft"
                checked={mode === 'soft'}
                onChange={() => setMode('soft')}
              />
              <div className="option-content">
                <div className="option-title">
                  <UserX size={18} className="text-warning" />
                  <strong>Mark as Left (TC Issued / Soft Delete)</strong>
                </div>
                <p className="option-desc">
                  Changes student status to Inactive. Preserves all historical financial receipts, ledger records, and audit logs. <em>(Recommended for accounting integrity)</em>
                </p>
              </div>
            </label>

            <label className={`option-card danger ${mode === 'permanent' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="delete_mode"
                value="permanent"
                checked={mode === 'permanent'}
                onChange={() => setMode('permanent')}
              />
              <div className="option-content">
                <div className="option-title">
                  <Trash2 size={18} className="text-danger" />
                  <strong>Permanently Delete from Database</strong>
                </div>
                <p className="option-desc">
                  Completely purges the student, monthly fee ledgers, and records from the database.
                </p>
              </div>
            </label>
          </div>

          {mode === 'permanent' && (
            <div className="force-delete-box">
              <label className="checkbox-label text-danger font-semibold">
                <input
                  type="checkbox"
                  checked={forceDelete}
                  onChange={(e) => setForceDelete(e.target.checked)}
                />
                <span className="checkmark"></span>
                <strong>Force delete and purge linked cash receipts/payment records</strong>
              </label>
              <p className="hint-text text-muted">
                <ShieldAlert size={14} /> Check this option if you want to permanently purge this student even if payment receipts have been issued.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={deleting}>
            <X size={16} /> Cancel
          </button>
          <button
            type="button"
            className={`btn ${mode === 'permanent' ? 'btn-danger' : 'btn-warning'}`}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <> <Loader2 size={16} className="spin" /> Processing… </>
            ) : mode === 'permanent' ? (
              <> <Trash2 size={16} /> Permanently Delete </>
            ) : (
              <> <UserX size={16} /> Mark as Left (TC) </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
