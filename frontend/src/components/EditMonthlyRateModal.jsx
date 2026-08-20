/**
 * EditMonthlyRateModal — School Management System (Frontend)
 *
 * Modal for revising a student's monthly fee rate and optionally updating future unpaid dues.
 */

import { useState } from 'react';
import { X, Save, Loader2, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './EditMonthlyRateModal.css';

export default function EditMonthlyRateModal({ student, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [newRate, setNewRate] = useState(student?.monthly_fee_rate || '3000');
  const [updateUnpaidFutureFees, setUpdateUnpaidFutureFees] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rateNumber = Number(newRate);
    if (isNaN(rateNumber) || rateNumber <= 0) {
      toast.error('Please enter a valid rate greater than 0.');
      return;
    }

    try {
      setSaving(true);
      const res = await api.patch(`/students/${student.id}/monthly-rate`, {
        new_monthly_rate: rateNumber,
        update_unpaid_future_fees: updateUnpaidFutureFees,
      });

      if (res.data.success) {
        toast.success(res.data.message || 'Monthly rate updated successfully.');
        onSaved();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update monthly rate.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Monthly Fee Rate</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="student-rate-summary">
            <p className="student-name-text">
              Student: <strong>{student?.full_name}</strong> ({student?.admission_no})
            </p>
            <p className="current-rate-text">
              Current Monthly Rate: <strong>{formatCurrency(student?.monthly_fee_rate)}</strong>
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="new_rate">New Monthly Fee Rate (₹) <span className="required">*</span></label>
            <div className="input-with-icon">
              <DollarSign size={18} className="input-icon" />
              <input
                type="number"
                id="new_rate"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                min="0"
                step="50"
                required
                placeholder="Enter new rate (e.g. 3500)"
              />
            </div>
          </div>

          <div className="form-group highlight-box">
            <p className="hint-text">
              <AlertCircle size={14} /> <strong>Historical Preservation Policy:</strong> Updating this rate sets the fee for future monthly fee calculations. Past monthly dues remain at their original historical rates.
            </p>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <X size={16} /> Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <> <Loader2 size={16} className="spin" /> Updating… </>
              ) : (
                <> <Save size={16} /> Update Monthly Rate </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
