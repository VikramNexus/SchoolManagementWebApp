/**
 * Settings Page — School Management System (Frontend)
 *
 * Day 4: Settings, Fees & Application Shell.
 *
 * Tabbed interface for School Profile, Classes, Sections,
 * Fee Structures, and Fee Types management.
 */import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Users,
  GraduationCap,
  DollarSign,
  Settings as SettingsIcon,
  Save,
  Loader2,
  Edit2,
  Trash2,
  Plus,
  X,
  MessageSquare,
  Send,
  Calendar,
  MapPin,
  Phone,
  Mail,
  IndianRupee,
  Globe,
  CheckCircle2,
  Receipt,
  Sparkles,
  User,
  ShieldCheck,
  Key,
  Lock,
} from 'lucide-react';
import { api, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import FeeTypesSettings from '../components/FeeTypesSettings';
import MessagingSettings from '../components/MessagingSettings';
import './Settings.css';

const TABS = [
  { id: 'school', label: 'School Profile', icon: Building2 },
  { id: 'profile', label: 'Admin Profile & Security', icon: ShieldCheck },
  { id: 'classes', label: 'Classes & Sections', icon: GraduationCap },
  { id: 'fee-types', label: 'Custom Fee Types', icon: SettingsIcon },
  { id: 'messaging', label: 'Messaging', icon: MessageSquare },
];

export default function Settings() {
  const { toast } = useToast();
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'school');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Admin Profile state
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    username: '',
    email: '',
  });

  // Change Password state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        username: user.username || '',
        email: user.email || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (tabFromUrl && TABS.some((t) => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // School Profile
  const [school, setSchool] = useState({
    school_name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    currency_symbol: '₹',
    academic_year: '2025-2026',
  });

  // Classes
  const [classes, setClasses] = useState([]);
  const [classForm, setClassForm] = useState({ name: '', order_index: 0, is_active: true });
  const [editingClassId, setEditingClassId] = useState(null);
  const [showClassForm, setShowClassForm] = useState(false);

  // Sections
  const [sections, setSections] = useState([]);
  const [sectionForm, setSectionForm] = useState({ name: '', class_id: '', is_active: true });
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [showSectionForm, setShowSectionForm] = useState(false);

  // Fetch all data
  const fetchAll = async () => {
    try {
      setLoading(true);
      const [schoolRes, classesRes, sectionsRes] = await Promise.all([
        api.get('/settings/school'),
        api.get('/settings/classes'),
        api.get('/settings/sections'),
      ]);
      if (schoolRes.data.success && schoolRes.data.school) {
        setSchool({
          school_name: schoolRes.data.school.school_name || '',
          address: schoolRes.data.school.address || '',
          phone: schoolRes.data.school.phone || '',
          email: schoolRes.data.school.email || '',
          logo_url: schoolRes.data.school.logo_url || schoolRes.data.school.logo_path || '',
          currency_symbol: schoolRes.data.school.currency_symbol || '₹',
          academic_year: schoolRes.data.school.academic_year || '2025-2026',
        });
      }
      if (classesRes.data.success) setClasses(classesRes.data.classes || []);
      if (sectionsRes.data.success) setSections(sectionsRes.data.sections || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // School Profile handlers
  const handleSchoolChange = (e) => {
    const { name, value } = e.target;
    setSchool((prev) => ({ ...prev, [name]: value }));
  };

  const handleSchoolSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/settings/school', school);
      if (res.data.success) {
        toast.success('School profile updated successfully!');
        if (res.data.school) {
          setSchool({
            school_name: res.data.school.school_name || '',
            address: res.data.school.address || '',
            phone: res.data.school.phone || '',
            email: res.data.school.email || '',
            logo_url: res.data.school.logo_url || res.data.school.logo_path || '',
            currency_symbol: res.data.school.currency_symbol || '₹',
            academic_year: res.data.school.academic_year || '2025-2026',
          });
        }
      }
    } catch (err) {
      console.error('[Settings.handleSchoolSubmit]', err);
      toast.error(err.response?.data?.message || 'Failed to update school settings.');
    } finally {
      setSaving(false);
    }
  };

  // Admin Profile & Security handlers
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await api.put('/auth/profile', profileForm);
      if (res.data.success) {
        toast.success('Admin profile updated successfully!');
        if (res.data.user) {
          updateUser(res.data.user, res.data.token);
        }
      }
    } catch (err) {
      console.error('[Settings.handleProfileSubmit]', err);
      toast.error(err.response?.data?.message || 'Failed to update admin profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match.');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    try {
      setSavingPassword(true);
      const res = await api.put('/auth/change-password', passwordForm);
      if (res.data.success) {
        toast.success('Password changed successfully! Please keep it secure.');
        setPasswordForm({
          current_password: '',
          new_password: '',
          confirm_password: '',
        });
      }
    } catch (err) {
      console.error('[Settings.handlePasswordSubmit]', err);
      toast.error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Class handlers
  const handleClassSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingClassId) {
        await api.put(`/settings/classes/${editingClassId}`, classForm);
        toast.success('Class updated');
      } else {
        await api.post('/settings/classes', classForm);
        toast.success('Class created');
      }
      setShowClassForm(false);
      setEditingClassId(null);
      resetClassForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save class');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClass = (cls) => {
    setEditingClassId(cls.id);
    setClassForm({ name: cls.name, order_index: cls.order_index || 0, is_active: Boolean(cls.is_active) });
    setShowClassForm(true);
  };

  const handleDeleteClass = async (id) => {
    if (!window.confirm('Delete this class? This cannot be undone.')) return;
    try {
      await api.delete(`/settings/classes/${id}`);
      toast.success('Class deleted');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete class');
    }
  };

  const resetClassForm = () => {
    setClassForm({ name: '', order_index: 0, is_active: true });
    setEditingClassId(null);
    setShowClassForm(false);
  };

  // Section handlers
  const handleSectionSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingSectionId) {
        await api.put(`/settings/sections/${editingSectionId}`, sectionForm);
        toast.success('Section updated');
      } else {
        await api.post('/settings/sections', sectionForm);
        toast.success('Section created');
      }
      setShowSectionForm(false);
      setEditingSectionId(null);
      resetSectionForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save section');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSection = (sec) => {
    setEditingSectionId(sec.id);
    setSectionForm({ name: sec.name, class_id: sec.class_id, is_active: Boolean(sec.is_active) });
    setShowSectionForm(true);
  };

  const handleDeleteSection = async (id) => {
    if (!window.confirm('Delete this section? This cannot be undone.')) return;
    try {
      await api.delete(`/settings/sections/${id}`);
      toast.success('Section deleted');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete section');
    }
  };

  const resetSectionForm = () => {
    setSectionForm({ name: '', class_id: '', is_active: true });
    setEditingSectionId(null);
    setShowSectionForm(false);
  };

  if (loading && !school.school_name) {
    return (
      <div className="settings-loading">
        <Loader2 size={32} className="spin text-primary" />
        <span>Loading system settings…</span>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Header Card */}
      <div className="settings-header-card">
        <div className="header-left-info">
          <div className="settings-icon-badge">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="settings-title">School Configuration &amp; Settings</h1>
            <p className="settings-subtitle">
              Configure institution profile, classes, fee structures, and communication settings.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="settings-tabs" role="tablist" aria-label="Settings categories">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            id={`${tab.id}-tab`}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab Panels */}
      <div className="settings-panels">
        {/* School Profile */}
        <div
          role="tabpanel"
          id="school-panel"
          aria-labelledby="school-tab"
          hidden={activeTab !== 'school'}
          className="tab-panel"
        >
          <div className="school-profile-container">
            {/* Form Section */}
            <form className="settings-form school-form-card" onSubmit={handleSchoolSubmit}>
              <div className="section-title-wrap">
                <Building2 size={20} className="section-title-icon" />
                <div>
                  <h2 className="section-heading">Institution Identity &amp; Profile</h2>
                  <p className="section-subtext">These details are branded onto generated fee receipts, reports, and messages.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="school_name">
                    School / Institution Name <span className="required">*</span>
                  </label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><Building2 size={18} /></div>
                    <input
                      type="text"
                      id="school_name"
                      name="school_name"
                      className="styled-setting-input"
                      value={school.school_name}
                      onChange={handleSchoolChange}
                      required
                      placeholder="e.g. Aryavart Shikshan Sansthan"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="academic_year">
                    Academic Year / Session <span className="required">*</span>
                  </label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><Calendar size={18} /></div>
                    <input
                      type="text"
                      id="academic_year"
                      name="academic_year"
                      className="styled-setting-input"
                      value={school.academic_year}
                      onChange={handleSchoolChange}
                      required
                      placeholder="2025-2026"
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="address">Campus Address</label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon textarea-icon"><MapPin size={18} /></div>
                    <textarea
                      id="address"
                      name="address"
                      className="styled-setting-textarea"
                      value={school.address}
                      onChange={handleSchoolChange}
                      rows={2}
                      placeholder="e.g. Shastri Nagar, Bara Chakia, East Champaran, Bihar - 845412"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Official Contact Phone</label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><Phone size={18} /></div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className="styled-setting-input"
                      value={school.phone}
                      onChange={handleSchoolChange}
                      placeholder="+91-9876543210"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Official Email Address</label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><Mail size={18} /></div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      className="styled-setting-input"
                      value={school.email}
                      onChange={handleSchoolChange}
                      placeholder="info@school.edu.in"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="currency_symbol">Currency Symbol</label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><IndianRupee size={18} /></div>
                    <input
                      type="text"
                      id="currency_symbol"
                      name="currency_symbol"
                      className="styled-setting-input"
                      value={school.currency_symbol}
                      onChange={handleSchoolChange}
                      maxLength="5"
                      placeholder="₹"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="logo_url">Website / Portal URL</label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><Globe size={18} /></div>
                    <input
                      type="text"
                      id="logo_url"
                      name="logo_url"
                      className="styled-setting-input"
                      value={school.logo_url}
                      onChange={handleSchoolChange}
                      placeholder="https://aryavartshikshansansthan.co.in"
                    />
                  </div>
                </div>
              </div>

              {/* Receipt Header Live Preview Box */}
              <div className="receipt-preview-box">
                <div className="preview-badge-row">
                  <Receipt size={16} />
                  <span>Official Receipt Branding Live Preview</span>
                </div>
                <div className="preview-letterhead">
                  <h3 className="preview-school-name">{school.school_name || 'Aryavart Shikshan Sansthan'}</h3>
                  <p className="preview-school-address">{school.address || 'Campus Address, City, State - PIN'}</p>
                  <div className="preview-school-contact">
                    {school.phone && <span>📞 Phone: {school.phone}</span>}
                    {school.email && <span>✉️ Email: {school.email}</span>}
                    <span>🗓️ Academic Session: {school.academic_year || '2025-2026'}</span>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary btn-save-school" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spin" /> Saving Configuration…
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save School Configuration
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Admin Profile & Security */}
        <div
          role="tabpanel"
          id="profile-panel"
          aria-labelledby="profile-tab"
          hidden={activeTab !== 'profile'}
          className="tab-panel"
        >
          <div className="admin-profile-grid">
            {/* Profile Info Form */}
            <form className="settings-form admin-profile-card" onSubmit={handleProfileSubmit}>
              <div className="section-title-wrap">
                <User size={20} className="section-title-icon" />
                <div>
                  <h2 className="section-heading">Administrator Profile &amp; Account</h2>
                  <p className="section-subtext">Update your administrative name, username, and official email.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="admin_full_name">
                    Administrator Full Name <span className="required">*</span>
                  </label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><User size={18} /></div>
                    <input
                      type="text"
                      id="admin_full_name"
                      className="styled-setting-input"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
                      placeholder="e.g. Principal / Administrator"
                      required
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="admin_username">
                    Login Username <span className="required">*</span>
                  </label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><ShieldCheck size={18} /></div>
                    <input
                      type="text"
                      id="admin_username"
                      className="styled-setting-input"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
                      placeholder="e.g. admin"
                      required
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="admin_email">
                    Administrator Email (Gmail / School Email)
                  </label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><Mail size={18} /></div>
                    <input
                      type="email"
                      id="admin_email"
                      className="styled-setting-input"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="e.g. Aryavartshikshansansthan@gmail.com"
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary btn-save-school" disabled={savingProfile}>
                  {savingProfile ? (
                    <>
                      <Loader2 size={16} className="spin" /> Saving Profile…
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Admin Profile
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Change Password Form */}
            <form className="settings-form admin-profile-card" onSubmit={handlePasswordSubmit}>
              <div className="section-title-wrap">
                <Lock size={20} className="section-title-icon" />
                <div>
                  <h2 className="section-heading">Security &amp; Change Password</h2>
                  <p className="section-subtext">Update your login password to maintain complete account security.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="current_password">
                    Current Password <span className="required">*</span>
                  </label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><Key size={18} /></div>
                    <input
                      type="password"
                      id="current_password"
                      className="styled-setting-input"
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))}
                      placeholder="Enter existing password"
                      required
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="new_password">
                    New Password (Min 6 Characters) <span className="required">*</span>
                  </label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><Lock size={18} /></div>
                    <input
                      type="password"
                      id="new_password"
                      className="styled-setting-input"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
                      placeholder="Enter new password"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="confirm_password">
                    Confirm New Password <span className="required">*</span>
                  </label>
                  <div className="styled-input-wrapper">
                    <div className="input-prefix-icon"><CheckCircle2 size={18} /></div>
                    <input
                      type="password"
                      id="confirm_password"
                      className="styled-setting-input"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                      placeholder="Confirm new password"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary btn-save-school" disabled={savingPassword}>
                  {savingPassword ? (
                    <>
                      <Loader2 size={16} className="spin" /> Updating Password…
                    </>
                  ) : (
                    <>
                      <Key size={16} /> Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Classes & Sections */}
        <div
          role="tabpanel"
          id="classes-panel"
          aria-labelledby="classes-tab"
          hidden={activeTab !== 'classes'}
          className="tab-panel"
        >
          {/* Classes Section */}
          <section className="settings-section">
            <div className="section-header">
              <h2>Classes</h2>
              {!showClassForm && (
                <button className="btn btn-primary" onClick={() => setShowClassForm(true)}>
                  <Plus size={16} /> Add Class
                </button>
              )}
            </div>

            {showClassForm && (
              <form className="inline-form" onSubmit={handleClassSubmit}>
                <h3>{editingClassId ? 'Edit Class' : 'Add Class'}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="class_name">Class Name <span className="required">*</span></label>
                    <input
                      type="text"
                      id="class_name"
                      name="name"
                      value={classForm.name}
                      onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                      required
                      placeholder="e.g., 1, 2, 3… 12"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="class_order">Display Order</label>
                    <input
                      type="number"
                      id="class_order"
                      name="order_index"
                      value={classForm.order_index}
                      onChange={(e) => setClassForm({ ...classForm, order_index: Number(e.target.value) })}
                      min="0"
                    />
                  </div>
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={classForm.is_active}
                        onChange={(e) => setClassForm({ ...classForm, is_active: e.target.checked })}
                      />
                      <span className="checkmark"></span>
                      Active
                    </label>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={resetClassForm}>
                    <X size={16} /> Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <> <Loader2 size={16} className="spin" /> Saving… </>
                    ) : (
                      <> <Save size={16} /> {editingClassId ? 'Update' : 'Create'} </>
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Order</th>
                    <th>Sections</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.length === 0 ? (
                    <tr><td colSpan={5} className="empty">No classes yet. Click "Add Class" to create one.</td></tr>
                  ) : (
                    classes.map((cls) => (
                      <tr key={cls.id}>
                        <td><strong>{cls.name}</strong></td>
                        <td>{cls.order_index}</td>
                        <td>{cls.section_count || 0}</td>
                        <td>
                          <span className={`status-badge ${cls.is_active ? 'active' : 'inactive'}`}>
                            {cls.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="icon-btn edit" onClick={() => handleEditClass(cls)} disabled={saving}><Edit2 size={16} /></button>
                            <button className="icon-btn delete" onClick={() => handleDeleteClass(cls.id)} disabled={saving}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Sections Section */}
          <section className="settings-section">
            <div className="section-header">
              <h2>Sections</h2>
              {!showSectionForm && (
                <button className="btn btn-primary" onClick={() => setShowSectionForm(true)}>
                  <Plus size={16} /> Add Section
                </button>
              )}
            </div>

            {showSectionForm && (
              <form className="inline-form" onSubmit={handleSectionSubmit}>
                <h3>{editingSectionId ? 'Edit Section' : 'Add Section'}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="section_name">Section Name <span className="required">*</span></label>
                    <input
                      type="text"
                      id="section_name"
                      name="name"
                      value={sectionForm.name}
                      onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                      required
                      placeholder="e.g., A, B, C"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="section_class">Class <span className="required">*</span></label>
                    <select
                      id="section_class"
                      name="class_id"
                      value={sectionForm.class_id}
                      onChange={(e) => setSectionForm({ ...sectionForm, class_id: e.target.value })}
                      required
                    >
                      <option value="">Select class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={sectionForm.is_active}
                        onChange={(e) => setSectionForm({ ...sectionForm, is_active: e.target.checked })}
                      />
                      <span className="checkmark"></span>
                      Active
                    </label>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={resetSectionForm}>
                    <X size={16} /> Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <> <Loader2 size={16} className="spin" /> Saving… </>
                    ) : (
                      <> <Save size={16} /> {editingSectionId ? 'Update' : 'Create'} </>
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.length === 0 ? (
                    <tr><td colSpan={4} className="empty">No sections yet. Click "Add Section" to create one.</td></tr>
                  ) : (
                    sections.map((sec) => (
                      <tr key={sec.id}>
                        <td><strong>{sec.name}</strong></td>
                        <td>{sec.class_name || '—'}</td>
                        <td>
                          <span className={`status-badge ${sec.is_active ? 'active' : 'inactive'}`}>
                            {sec.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="icon-btn edit" onClick={() => handleEditSection(sec)} disabled={saving}><Edit2 size={16} /></button>
                            <button className="icon-btn delete" onClick={() => handleDeleteSection(sec.id)} disabled={saving}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>


        {/* Fee Types */}
        <div
          role="tabpanel"
          id="fee-types-panel"
          aria-labelledby="fee-types-tab"
          hidden={activeTab !== 'fee-types'}
          className="tab-panel"
        >
          <FeeTypesSettings />
        </div>

        {/* Messaging */}
        <div
          role="tabpanel"
          id="messaging-panel"
          aria-labelledby="messaging-tab"
          hidden={activeTab !== 'messaging'}
          className="tab-panel"
        >
          <MessagingSettings />
        </div>
      </div>
    </div>
  );
}