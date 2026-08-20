/**
 * AssignFeeModal — School Management System (Frontend)
 *
 * Allows Admin to assign any custom / additional fee (Admission, Transport, Exam, Hostel, Sports, Uniform, etc.)
 * to a selected student or any student from search.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, DollarSign, Calendar, Search, User } from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './AssignFeeModal.css';

export default function AssignFeeModal({ student: initialStudent = null, feeTypes: initialFeeTypes = null, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState(
    initialStudent ? `${initialStudent.admission_no || ''} - ${initialStudent.full_name || ''}` : ''
  );
  const [selectedStudent, setSelectedStudent] = useState(initialStudent);
  const [showDropdown, setShowDropdown] = useState(false);

  const [availableFeeTypes, setAvailableFeeTypes] = useState(initialFeeTypes || []);

  const [formData, setFormData] = useState({
    fee_type_id: '',
    custom_title: '',
    amount: '',
    due_date: new Date().toISOString().slice(0, 10),
    description: '',
  });

  // Fetch active fee types if not provided
  const fetchFeeTypes = useCallback(async () => {
    if (initialFeeTypes && initialFeeTypes.length > 0) return;
    try {
      const res = await api.get('/settings/fee-types');
      if (res.data.success) {
        setAvailableFeeTypes(res.data.fee_types || []);
      }
    } catch (err) {
      console.error('Failed to load fee types:', err);
    }
  }, [initialFeeTypes]);

  // Fetch active students list if student not pre-selected
  const fetchStudents = useCallback(async () => {
    if (initialStudent) return;
    try {
      const res = await api.get('/students?limit=1000');
      if (res.data.success) {
        const active = (res.data.students || []).filter(s => s.status === 'active');
        setStudents(active);
        setFilteredStudents(active);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  }, [initialStudent]);

  useEffect(() => {
    fetchFeeTypes();
    fetchStudents();
  }, [fetchFeeTypes, fetchStudents]);

  // Filter students dropdown on search
  useEffect(() => {
    if (initialStudent) return;
    const filtered = students.filter(s =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admission_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery))
    );
    setFilteredStudents(filtered);
  }, [searchQuery, students, initialStudent]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStudentSelect = (std) => {
    setSelectedStudent(std);
    setSearchQuery(`${std.admission_no} - ${std.full_name}`);
    setShowDropdown(false);
  };

  const validate = () => {
    if (!selectedStudent) return 'Please select a student.';
    if (!formData.fee_type_id) return 'Please select a fee type.';
    if (!formData.amount || Number(formData.amount) <= 0) return 'Please enter a valid positive amount.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        student_id: selectedStudent.id,
        fee_type_id: Number(formData.fee_type_id),
        amount: Number(formData.amount),
        due_date: formData.due_date || undefined,
        description: formData.description || undefined,
      };

      const res = await api.post(`/students/${selectedStudent.id}/add-fee`, payload);
      if (res.data.success) {
        toast.success(`Custom fee (₹${Number(formData.amount).toLocaleString('en-IN')}) assigned to ${selectedStudent.full_name} successfully.`);
        if (onSaved) onSaved();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign fee.');
    } finally {
      setSaving(false);
    }
  };

  const activeFeeTypes = availableFeeTypes.filter(ft => ft.is_active !== 0);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="assign-fee-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="assign-fee-title">Assign Custom Fee to Student</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Student Selector */}
          <div className="form-group">
            <label htmlFor="student_search_assign">Select Student <span className="required">*</span></label>
            <div className="student-selector">
              <div className="selector-input-wrapper">
                <Search size={18} className="selector-icon" />
                <input
                  type="text"
                  id="student_search_assign"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => !initialStudent && setShowDropdown(true)}
                  placeholder="Search by Name or Admission No…"
                  autoComplete="off"
                  readOnly={!!initialStudent}
                />
                {selectedStudent && !initialStudent && (
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
                  {filteredStudents.slice(0, 10).map((std) => (
                    <button
                      key={std.id}
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleStudentSelect(std)}
                      role="option"
                    >
                      <User size={16} />
                      <div className="dropdown-item-info">
                        <span className="dropdown-name">{std.full_name}</span>
                        <span className="dropdown-meta">{std.admission_no} • {std.class_name || 'Class'}{std.section_name && `-${std.section_name}`}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fee Type Selection */}
          <div className="form-group">
            <label htmlFor="fee_type_id">Custom Fee Category / Type <span className="required">*</span></label>
            <select
              id="fee_type_id"
              name="fee_type_id"
              value={formData.fee_type_id}
              onChange={handleChange}
              required
            >
              <option value="">Select fee category (Admission, Transport, Exam, Hostel, Sports, etc.)</option>
              {activeFeeTypes.map((ft) => (
                <option key={ft.id} value={ft.id}>
                  {ft.name} {ft.is_recurring ? '(Recurring Charge)' : '(One-time Charge)'}
                </option>
              ))}
            </select>
          </div>

          {/* Amount & Due Date */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="amount">Custom Fee Amount (₹) <span className="required">*</span></label>
              <div className="input-with-icon">
                <DollarSign size={18} className="input-icon" />
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 2000"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="due_date">Due Date</label>
              <input
                type="date"
                id="due_date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Notes / Description */}
          <div className="form-group">
            <label htmlFor="description">Notes / Remarks</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="e.g. Annual Sports Kit fee / Term 1 Transport fee"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <X size={16} /> Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !selectedStudent}>
              {saving ? (
                <>
                  <Loader2 size={16} className="spin" /> Assigning…
                </>
              ) : (
                <>
                  <Save size={16} /> Assign Custom Fee
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}