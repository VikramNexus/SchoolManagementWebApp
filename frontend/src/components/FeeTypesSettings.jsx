/**
 * FeeTypesSettings — School Management System (Frontend)
 *
 * Day 4: Settings, Fees & Application Shell.
 *
 * Manage custom fee types (Admission, Exam, Transport, Hostel, etc.)
 */

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Loader2, Recycle, Calendar } from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './FeeTypesSettings.css';

export default function FeeTypesSettings() {
  const { toast } = useToast();
  const [feeTypes, setFeeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_recurring: false,
    is_active: true,
  });
  const [showForm, setShowForm] = useState(false);

  const fetchFeeTypes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/fee-types');
      if (res.data.success) {
        setFeeTypes(res.data.fee_types);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load fee types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeTypes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      is_recurring: formData.is_recurring,
      is_active: formData.is_active,
    };

    try {
      setSaving(editingId || 'new');
      if (editingId) {
        await api.put(`/settings/fee-types/${editingId}`, payload);
        toast.success('Fee type updated');
      } else {
        await api.post('/settings/fee-types', payload);
        toast.success('Fee type created');
      }
      setEditingId(null);
      setShowForm(false);
      resetForm();
      fetchFeeTypes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save fee type');
    } finally {
      setSaving(null);
    }
  };

  const handleEdit = (ft) => {
    setEditingId(ft.id);
    setFormData({
      name: ft.name,
      description: ft.description || '',
      is_recurring: Boolean(ft.is_recurring),
      is_active: Boolean(ft.is_active),
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this fee type? This cannot be undone.')) return;
    try {
      await api.delete(`/settings/fee-types/${id}`);
      toast.success('Fee type deleted');
      fetchFeeTypes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete fee type');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', is_recurring: false, is_active: true });
    setEditingId(null);
    setShowForm(false);
  };

  const startNew = () => {
    resetForm();
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="fee-types-loading">
        <Loader2 size={24} className="spin" />
        <span>Loading fee types…</span>
      </div>
    );
  }

  return (
    <div className="fee-types">
      <div className="section-header">
        <h2>Fee Types</h2>
        <p className="section-desc">Custom charges (Admission, Exam, Transport, Hostel, Lab, Library, Sports, Uniform)</p>
      </div>

      {showForm && (
        <form className="fee-form" onSubmit={handleSubmit}>
          <h3>{editingId ? 'Edit Fee Type' : 'Add Fee Type'}</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Fee Type Name <span className="required">*</span></label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Admission Fee, Transport Fee"
                maxLength="80"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Optional description"
                maxLength="255"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                />
                <span className="checkmark"></span>
                Recurring (charged monthly/termly)
              </label>
            </div>
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <span className="checkmark"></span>
                Active
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              <X size={16} /> Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <> <Loader2 size={16} className="spin" /> Saving… </>
              ) : (
                <> <Save size={16} /> {editingId ? 'Update' : 'Create'} </>
              )}
            </button>
          </div>
        </form>
      )}

      {!showForm && (
        <button className="btn btn-primary add-btn" onClick={startNew}>
          <Plus size={18} /> Add Fee Type
        </button>
      )}

      <div className="fee-table-wrapper">
        <table className="fee-table" role="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {feeTypes.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">No fee types configured. Click "Add Fee Type" to create one.</td>
              </tr>
            ) : (
              feeTypes.map((ft) => (
                <tr key={ft.id}>
                  <td>
                    <span className="fee-name">{ft.name}</span>
                  </td>
                  <td>
                    <span className="fee-desc">{ft.description || <em className="text-muted">—</em>}</span>
                  </td>
                  <td>
                    <span className={`type-badge ${ft.is_recurring ? 'recurring' : 'one-time'}`}>
                      {ft.is_recurring ? (
                        <> <Recycle size={14} /> Recurring </>
                      ) : (
                        <> <Calendar size={14} /> One-time </>
                      )}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${ft.is_active ? 'active' : 'inactive'}`}>
                      {ft.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="icon-btn edit"
                        onClick={() => handleEdit(ft)}
                        aria-label="Edit"
                        disabled={saving === ft.id}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="icon-btn delete"
                        onClick={() => handleDelete(ft.id)}
                        aria-label="Delete"
                        disabled={saving === ft.id}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}