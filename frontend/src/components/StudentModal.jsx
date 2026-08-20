/**
 * StudentModal — School Management System (Frontend)
 *
 * Create/Edit student modal with separate Father's Name & Mother's Name inputs,
 * per-student monthly fee rate, and optional initial admission charges.
 */

import { useState, useEffect } from 'react';
import { X, Save, Loader2, DollarSign, Tag, User } from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './StudentModal.css';

export default function StudentModal({ student, classes, sections, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    admission_no: '',
    full_name: '',
    class_id: '',
    section_id: '',
    category: 'day_scholar',
    father_name: '',
    mother_name: '',
    phone: '',
    whatsapp_number: '',
    address: '',
    admission_date: '',
    monthly_fee_rate: '3000',
    status: 'active',
  });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [availableSections, setAvailableSections] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [selectedInitialFees, setSelectedInitialFees] = useState([]);

  // Fetch active fee types for initial charges selection on admission
  useEffect(() => {
    async function fetchFeeTypes() {
      try {
        const res = await api.get('/settings/fee-types');
        if (res.data.success) {
          setFeeTypes(res.data.fee_types.filter(ft => ft.is_active));
        }
      } catch (err) {
        console.error('Failed to load fee types:', err);
      }
    }
    if (!student) {
      fetchFeeTypes();
    }
  }, [student]);

  // Initialize form when student prop changes
  useEffect(() => {
    if (student) {
      const currentRate = Number(student.monthly_fee_rate);
      const category = student.category || 'day_scholar';
      const defaultRate = category === 'hosteller' ? 5000 : 3000;
      const rateToUse = currentRate > 0 ? currentRate : defaultRate;

      setFormData({
        admission_no: student.admission_no || '',
        full_name: student.full_name || '',
        gender: student.gender || 'male',
        class_id: student.class_id?.toString() || '',
        section_id: student.section_id?.toString() || '',
        category: category,
        father_name: student.father_name || student.parent_name || '',
        mother_name: student.mother_name || '',
        phone: student.phone || '',
        whatsapp_number: student.whatsapp_number || '',
        address: student.address || '',
        admission_date: student.admission_date?.slice(0, 10) || '',
        monthly_fee_rate: rateToUse.toString(),
        status: student.status || 'active',
      });
      setWhatsappSameAsPhone(student.whatsapp_number === student.phone);
    } else {
      setFormData({
        admission_no: '',
        full_name: '',
        gender: 'male',
        class_id: '',
        section_id: '',
        category: 'day_scholar',
        father_name: '',
        mother_name: '',
        phone: '',
        whatsapp_number: '',
        address: '',
        admission_date: new Date().toISOString().slice(0, 10),
        monthly_fee_rate: '3000',
        status: 'active',
      });
      setWhatsappSameAsPhone(true);
      setSelectedInitialFees([]);
    }
  }, [student]);

  // Update default rate when category changes for new student
  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setFormData((prev) => ({
      ...prev,
      category: newCategory,
      monthly_fee_rate: !student
        ? (newCategory === 'hosteller' ? '5000' : '3000')
        : prev.monthly_fee_rate,
    }));
  };

  // Update available sections when class changes
  useEffect(() => {
    if (formData.class_id) {
      const filtered = sections.filter((s) => s.class_id === Number(formData.class_id));
      setAvailableSections(filtered);
      if (formData.section_id && !filtered.find((s) => s.id === Number(formData.section_id))) {
        setFormData((prev) => ({ ...prev, section_id: '' }));
      }
    } else {
      setAvailableSections([]);
      setFormData((prev) => ({ ...prev, section_id: '' }));
    }
  }, [formData.class_id, sections]);

  const handlePhoneChange = (value) => {
    setFormData((prev) => ({ ...prev, phone: value }));
    if (whatsappSameAsPhone) {
      setFormData((prev) => ({ ...prev, whatsapp_number: value }));
    }
  };

  const handleWhatsAppChange = (e) => {
    const checked = e.target.checked;
    setWhatsappSameAsPhone(checked);
    if (checked) {
      setFormData((prev) => ({ ...prev, whatsapp_number: prev.phone }));
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? e.target.checked : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));
  };

  const handleInitialFeeToggle = (feeTypeId) => {
    setSelectedInitialFees((prev) =>
      prev.includes(feeTypeId) ? prev.filter(id => id !== feeTypeId) : [...prev, feeTypeId]
    );
  };

  const validate = () => {
    if (!formData.admission_no.trim()) return 'Admission number is required.';
    if (!formData.full_name.trim()) return 'Full name is required.';
    if (!formData.class_id) return 'Class is required.';
    if (!formData.category) return 'Category is required.';
    if (!formData.monthly_fee_rate || Number(formData.monthly_fee_rate) <= 0) {
      return 'Valid monthly fee rate is required.';
    }
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
        ...formData,
        parent_name: formData.father_name || formData.mother_name || undefined,
        monthly_fee_rate: Number(formData.monthly_fee_rate),
        initial_fee_type_ids: !student ? selectedInitialFees : undefined,
      };

      Object.keys(payload).forEach((key) => {
        if (payload[key] === '') payload[key] = undefined;
      });

      if (student) {
        await api.put(`/students/${student.id}`, payload);
        toast.success('Student details updated.');
      } else {
        await api.post('/students', payload);
        toast.success('Student admitted successfully with custom fee structure.');
      }

      onSaved();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save student.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title">{student ? 'Edit Student Profile' : 'Student Admission Form'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="admission_no">Admission No. <span className="required">*</span></label>
              <input
                type="text"
                id="admission_no"
                name="admission_no"
                value={formData.admission_no}
                onChange={handleChange}
                required
                disabled={!!student}
              />
            </div>
            <div className="form-group">
              <label htmlFor="full_name">Student Full Name <span className="required">*</span></label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group" style={{ maxWidth: '140px' }}>
              <label htmlFor="gender">Gender <span className="required">*</span></label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
              >
                <option value="male">Male (♂)</option>
                <option value="female">Female (♀)</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="father_name">Father's Name</label>
              <input
                type="text"
                id="father_name"
                name="father_name"
                value={formData.father_name}
                onChange={handleChange}
                placeholder="Father's full name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="mother_name">Mother's Name</label>
              <input
                type="text"
                id="mother_name"
                name="mother_name"
                value={formData.mother_name}
                onChange={handleChange}
                placeholder="Mother's full name"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="class_id">Class <span className="required">*</span></label>
              <select
                id="class_id"
                name="class_id"
                value={formData.class_id}
                onChange={handleChange}
                required
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="section_id">Section</label>
              <select
                id="section_id"
                name="section_id"
                value={formData.section_id}
                onChange={handleChange}
              >
                <option value="">Select section</option>
                {availableSections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category <span className="required">*</span></label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleCategoryChange}
                required
              >
                <option value="day_scholar">Day Scholar</option>
                <option value="hosteller">Hosteller</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="monthly_fee_rate">Custom Monthly Fee Rate (₹) <span className="required">*</span></label>
              <input
                type="number"
                id="monthly_fee_rate"
                name="monthly_fee_rate"
                value={formData.monthly_fee_rate}
                onChange={handleChange}
                min="0"
                step="50"
                required
                placeholder="Monthly rate (e.g. 3500)"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Primary contact number"
              />
            </div>
            <div className="form-group">
              <label htmlFor="whatsapp_number">WhatsApp Number</label>
              <input
                type="tel"
                id="whatsapp_number"
                name="whatsapp_number"
                value={formData.whatsapp_number}
                onChange={handleChange}
                placeholder="WhatsApp number"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={whatsappSameAsPhone}
                  onChange={handleWhatsAppChange}
                />
                <span className="checkmark"></span>
                Same as Phone (auto-copy)
              </label>
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive (Left/TC)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="admission_date">Admission Date</label>
              <input
                type="date"
                id="admission_date"
                name="admission_date"
                value={formData.admission_date}
                onChange={handleChange}
              />
            </div>
          </div>

          {!student && feeTypes.length > 0 && (
            <div className="form-section initial-fees-section">
              <label className="section-label">
                <Tag size={16} /> Initial Admission Charges (Optional)
              </label>
              <div className="fee-types-checkbox-grid">
                {feeTypes.map((ft) => (
                  <label key={ft.id} className="fee-checkbox-card">
                    <input
                      type="checkbox"
                      checked={selectedInitialFees.includes(ft.id)}
                      onChange={() => handleInitialFeeToggle(ft.id)}
                    />
                    <span>{ft.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group full-width">
              <label htmlFor="address">Address</label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                placeholder="Full residential address"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <X size={16} /> Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <> <Loader2 size={16} className="spin" /> Saving… </>
              ) : (
                <> <Save size={16} /> {student ? 'Update Details' : 'Complete Admission'} </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}