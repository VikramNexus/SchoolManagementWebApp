/**
 * EditPaymentModal — School Management System (Frontend)
 *
 * Allows Admin to edit a recorded payment (student, amount, date, notes)
 * if accidentally entered for the wrong student or wrong amount.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, DollarSign, Search, User } from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './RecordPaymentModal.css';

export default function EditPaymentModal({ payment, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState(
    payment ? `${payment.student_admission_no || payment.admission_no || ''} - ${payment.student_name || payment.full_name || ''}` : ''
  );
  const [selectedStudent, setSelectedStudent] = useState({
    id: payment?.student_id,
    full_name: payment?.student_name || payment?.full_name,
    admission_no: payment?.student_admission_no || payment?.admission_no,
  });
  const [showDropdown, setShowDropdown] = useState(false);

  const [formData, setFormData] = useState({
    amount: payment?.amount ? String(payment.amount) : '',
    payment_date: payment?.payment_date ? payment.payment_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: payment?.notes || '',
  });

  // Fetch active students list
  const fetchStudents = useCallback(async () => {
    try {
      const res = await api.get('/students?limit=1000');
      if (res.data.success) {
        const activeStudents = (res.data.students || []).filter(s => s.status === 'active');
        setStudents(activeStudents);
        setFilteredStudents(activeStudents);
      }
    } catch (err) {
      toast.error('Failed to load students.');
    }
  }, [toast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Filter student list
  useEffect(() => {
    const filtered = students.filter(s =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredStudents(filtered);
  }, [searchQuery, students]);

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSearchQuery(`${student.admission_no} - ${student.full_name}`);
    setShowDropdown(false);
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({ ...prev, amount: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent?.id) {
      toast.error('Please select a student.');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        student_id: selectedStudent.id,
        amount: Number(formData.amount),
        payment_date: formData.payment_date,
        notes: formData.notes || '',
      };

      const res = await api.put(`/payments/${payment.id || payment.payment_id}`, payload);
      if (res.data.success) {
        toast.success(`Payment updated & re-allocated successfully.`);
        if (onSaved) onSaved();
        onClose();
      }
    } catch (err) {
      console.error('[EditPaymentModal.handleSubmit]', err);
      toast.error(err.response?.data?.message || 'Failed to update payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal record-payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Payment ({payment?.receipt_number || payment?.receipt_no || `ID: ${payment?.id}`})</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Student Selector */}
          <div className="form-group">
            <label htmlFor="student_select">Assigned Student <span className="required">*</span></label>
            <div className="student-selector">
              <div className="selector-input-wrapper">
                <Search size={18} className="selector-icon" />
                <input
                  type="text"
                  id="student_select"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => !selectedStudent && setShowDropdown(true)}
                  placeholder="Search by Student Name or Admission No…"
                  autoComplete="off"
                />
                {selectedStudent && (
                  <button
                    type="button"
                    className="clear-selection"
                    onClick={() => {
                      setSelectedStudent(null);
                      setSearchQuery('');
                    }}
                    aria-label="Clear selection"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {showDropdown && filteredStudents.length > 0 && !selectedStudent && (
                <div className="student-dropdown" role="listbox">
                  {filteredStudents.slice(0, 10).map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleStudentSelect(student)}
                      role="option"
                    >
                      <User size={16} />
                      <div className="dropdown-item-info">
                        <span className="dropdown-name">{student.full_name}</span>
                        <span className="dropdown-meta">{student.admission_no} • {student.class_name || 'Class'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Amount & Date */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="amount">Corrected Payment Amount (₹) <span className="required">*</span></label>
              <div className="input-with-icon">
                <DollarSign size={18} className="input-icon" />
                <input
                  type="text"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleAmountChange}
                  required
                  placeholder="Enter corrected amount"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="payment_date">Payment Date</label>
              <input
                type="date"
                id="payment_date"
                name="payment_date"
                value={formData.payment_date}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="notes">Remarks / Edit Reason</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder="e.g. Amount corrected by Admin"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <X size={16} /> Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !selectedStudent || Number(formData.amount) <= 0}>
              {saving ? (
                <>
                  <Loader2 size={16} className="spin" /> Re-allocating…
                </>
              ) : (
                <>
                  <Save size={16} /> Save &amp; Re-allocate Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
