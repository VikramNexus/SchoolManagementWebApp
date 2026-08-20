/**
 * Admissions Page — School Management System (Frontend)
 * Comprehensive Admission Desk with Itemized Charges, Security Deposit,
 * 1-Month Advance Fee Allocation, Sibling Family Linking & Instant Receipt PDF
 */

import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Users,
  GraduationCap,
  IndianRupee,
  ShieldCheck,
  Calendar,
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Search,
  RotateCcw,
  Loader2,
  AlertCircle,
  Eye,
  Download,
  Building2,
  User,
  Sparkles,
  Link as LinkIcon,
  Phone,
  Printer,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import WhatsAppDirectButton from '../components/WhatsAppDirectButton';
import './Admissions.css';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function Admissions() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Active view tab: 'desk' or 'register'
  const [activeTab, setActiveTab] = useState('desk');

  // Stats & Dropdowns
  const [stats, setStats] = useState({
    total_admissions: 0,
    admission_revenue: 0,
    security_deposit_total: 0,
    advance_fees_collected: 0,
  });
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Form State
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const initialFormState = {
    // Demographics
    full_name: '',
    admission_no: '',
    auto_generate_adm: true,
    gender: 'male',
    class_id: '',
    section_id: '',
    category: 'day_scholar',
    monthly_fee_rate: 3000,
    admission_date: now.toISOString().slice(0, 10),

    // Parent
    father_name: '',
    mother_name: '',
    phone: '',
    whatsapp_number: '',
    address: '',

    // Sibling Linking
    is_sibling: false,
    sibling_search: '',
    selected_sibling: null,

    // Charges
    has_admission_fee: true,
    admission_fee_amount: 1000,

    has_security_deposit: true,
    security_deposit_amount: 2000,

    include_advance_month: true,
    advance_fee_month: currentMonth,
    advance_fee_year: currentYear,
    advance_fee_amount: 3000,

    custom_expenses: [
      { id: 1, description: 'Uniform & ID Card Kit', amount: 1500 },
    ],

    // Payment Collection
    collect_payment: true,
    paid_amount: 7500,
    payment_mode: 'CASH',
    payment_notes: 'Initial admission fee and advance tuition payment',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(null);

  // Sibling live search results
  const [siblingSearchResults, setSiblingSearchResults] = useState([]);
  const [searchingSibling, setSearchingSibling] = useState(false);

  // Admissions History List
  const [admissionsList, setAdmissionsList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchList, setSearchList] = useState('');
  const [classListFilter, setClassListFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch initial dropdowns & stats
  const fetchData = useCallback(async () => {
    try {
      setLoadingStats(true);
      const [statsRes, classesRes, sectionsRes] = await Promise.all([
        api.get('/admissions/stats'),
        api.get('/settings/classes'),
        api.get('/settings/sections'),
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.stats || {});
      }
      if (classesRes.data.success) {
        const clsList = classesRes.data.classes || [];
        setClasses(clsList);
        if (clsList.length > 0 && !formData.class_id) {
          setFormData((prev) => ({ ...prev, class_id: String(clsList[0].id) }));
        }
      }
      if (sectionsRes.data.success) {
        setSections(sectionsRes.data.sections || []);
      }
    } catch (err) {
      console.error('[Admissions.fetchData]', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch Admissions Register
  const fetchAdmissionsList = useCallback(async () => {
    try {
      setLoadingList(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });
      if (searchList) params.append('search', searchList);
      if (classListFilter) params.append('class_id', classListFilter);

      const res = await api.get(`/admissions/list?${params.toString()}`);
      if (res.data.success) {
        setAdmissionsList(res.data.admissions || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalCount(res.data.pagination?.total || 0);
      }
    } catch (err) {
      toast.error('Failed to load admissions register.');
    } finally {
      setLoadingList(false);
    }
  }, [page, searchList, classListFilter, toast]);

  useEffect(() => {
    if (activeTab === 'register') {
      fetchAdmissionsList();
    }
  }, [activeTab, fetchAdmissionsList]);

  // Update default monthly rate when category changes
  const handleCategoryChange = (newCat) => {
    const defaultRate = newCat === 'hosteller' ? 5000 : 3000;
    setFormData((prev) => ({
      ...prev,
      category: newCat,
      monthly_fee_rate: defaultRate,
      advance_fee_amount: defaultRate,
    }));
  };

  // Recalculate total payable whenever fee components change
  useEffect(() => {
    let total = 0;
    if (formData.has_admission_fee) total += Number(formData.admission_fee_amount || 0);
    if (formData.has_security_deposit) total += Number(formData.security_deposit_amount || 0);
    if (formData.include_advance_month) total += Number(formData.advance_fee_amount || 0);

    formData.custom_expenses.forEach((item) => {
      total += Number(item.amount || 0);
    });

    setFormData((prev) => ({
      ...prev,
      paid_amount: total,
    }));
  }, [
    formData.has_admission_fee,
    formData.admission_fee_amount,
    formData.has_security_deposit,
    formData.security_deposit_amount,
    formData.include_advance_month,
    formData.advance_fee_amount,
    formData.custom_expenses,
  ]);

  // Sibling Live Search
  const handleSearchSibling = async (text) => {
    setFormData((prev) => ({ ...prev, sibling_search: text }));
    if (!text || text.trim().length < 2) {
      setSiblingSearchResults([]);
      return;
    }
    try {
      setSearchingSibling(true);
      const res = await api.get(`/family/search?q=${encodeURIComponent(text.trim())}`);
      if (res.data.success) {
        setSiblingSearchResults(res.data.students || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingSibling(false);
    }
  };

  const selectSibling = (std) => {
    setFormData((prev) => ({
      ...prev,
      selected_sibling: std,
      father_name: std.father_name || std.parent_name || prev.father_name,
      mother_name: std.mother_name || prev.mother_name,
      phone: std.phone || prev.phone,
      address: std.address || prev.address,
    }));
    setSiblingSearchResults([]);
  };

  const removeSibling = () => {
    setFormData((prev) => ({
      ...prev,
      selected_sibling: null,
      sibling_search: '',
    }));
  };

  // Custom Expenses helpers
  const addExpenseRow = () => {
    setFormData((prev) => ({
      ...prev,
      custom_expenses: [
        ...prev.custom_expenses,
        { id: Date.now(), description: '', amount: 0 },
      ],
    }));
  };

  const updateExpenseRow = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      custom_expenses: prev.custom_expenses.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    }));
  };

  const removeExpenseRow = (id) => {
    setFormData((prev) => ({
      ...prev,
      custom_expenses: prev.custom_expenses.filter((row) => row.id !== id),
    }));
  };

  // Submit Admission
  const handleSubmitAdmission = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast.error('Student full name is required.');
      return;
    }
    if (!formData.class_id) {
      toast.error('Please select a class.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        admission_no: formData.auto_generate_adm ? null : formData.admission_no,
        full_name: formData.full_name,
        gender: formData.gender,
        class_id: Number(formData.class_id),
        section_id: formData.section_id ? Number(formData.section_id) : null,
        category: formData.category,
        father_name: formData.father_name,
        mother_name: formData.mother_name,
        parent_name: formData.father_name || formData.mother_name || null,
        phone: formData.phone,
        whatsapp_number: formData.whatsapp_number,
        address: formData.address,
        admission_date: formData.admission_date,
        monthly_fee_rate: Number(formData.monthly_fee_rate),

        // Sibling linking
        sibling_student_id: formData.selected_sibling?.id || null,

        // Charges
        admission_fee_amount: formData.has_admission_fee ? Number(formData.admission_fee_amount) : 0,
        security_deposit_amount: formData.has_security_deposit ? Number(formData.security_deposit_amount) : 0,
        custom_expenses: formData.custom_expenses.filter((exp) => exp.description.trim() && Number(exp.amount) > 0),

        // Advance Month
        include_advance_month: formData.include_advance_month,
        advance_fee_month: formData.advance_fee_month,
        advance_fee_year: formData.advance_fee_year,

        // Payment
        collect_payment: formData.collect_payment,
        paid_amount: formData.collect_payment ? Number(formData.paid_amount) : 0,
        payment_mode: formData.payment_mode,
        payment_notes: formData.payment_notes,
      };

      const res = await api.post('/admissions/enroll', payload);

      if (res.data.success) {
        toast.success(res.data.message || 'Student enrolled successfully!');
        setEnrollmentSuccess({
          student_id: res.data.student_id,
          admission_no: res.data.admission_no,
          full_name: formData.full_name,
          payment: res.data.payment,
        });
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete admission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormData(initialFormState);
    setEnrollmentSuccess(null);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="admissions-container">
      {/* Header Card (Eye-Comfort Theme) */}
      <div className="admissions-header-card">
        <div className="header-left-wrap">
          <div className="admissions-icon-badge">
            <UserPlus size={26} />
          </div>
          <div>
            <h1 className="admissions-heading">Student Admissions &amp; Enrollment Desk</h1>
            <p className="admissions-subheading">
              Register new student admissions with itemized charges, security deposit, advance monthly fee assignment, and sibling family account linking.
            </p>
          </div>
        </div>

        <div className="admissions-nav-tabs">
          <button
            type="button"
            className={`adm-tab-pill ${activeTab === 'desk' ? 'active' : ''}`}
            onClick={() => setActiveTab('desk')}
          >
            <UserPlus size={16} />
            <span>+ New Admission Desk</span>
          </button>
          <button
            type="button"
            className={`adm-tab-pill ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            <FileText size={16} />
            <span>Admissions Register</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid (Receipt Look) */}
      <div className="admissions-summary-grid">
        <div className="adm-stat-card primary">
          <div className="stat-card-top">
            <span className="stat-card-tag primary">Enrollment</span>
            <div className="stat-card-icon primary">
              <GraduationCap size={20} />
            </div>
          </div>
          <span className="stat-card-label">Total Session Admissions</span>
          <span className="stat-card-value">{stats.total_admissions} Students</span>
          <span className="stat-card-subtext">Active student enrollments</span>
        </div>

        <div className="adm-stat-card green">
          <div className="stat-card-top">
            <span className="stat-card-tag green">Revenue</span>
            <div className="stat-card-icon green">
              <IndianRupee size={20} />
            </div>
          </div>
          <span className="stat-card-label">Admission Desk Revenue</span>
          <span className="stat-card-value text-green">
            {formatCurrency(stats.admission_revenue)}
          </span>
          <span className="stat-card-subtext">Collected from admission charges</span>
        </div>

        <div className="adm-stat-card blue">
          <div className="stat-card-top">
            <span className="stat-card-tag blue">Security Fund</span>
            <div className="stat-card-icon blue">
              <ShieldCheck size={20} />
            </div>
          </div>
          <span className="stat-card-label">Security Deposits Held</span>
          <span className="stat-card-value">
            {formatCurrency(stats.security_deposit_total)}
          </span>
          <span className="stat-card-subtext">Caution money refundable</span>
        </div>

        <div className="adm-stat-card orange">
          <div className="stat-card-top">
            <span className="stat-card-tag orange">Advance Fees</span>
            <div className="stat-card-icon orange">
              <Calendar size={20} />
            </div>
          </div>
          <span className="stat-card-label">Advance Tuition Allocated</span>
          <span className="stat-card-value">
            {formatCurrency(stats.advance_fees_collected)}
          </span>
          <span className="stat-card-subtext">First-month fee assigned &amp; paid</span>
        </div>
      </div>

      {/* View 1: New Admission Desk Form */}
      {activeTab === 'desk' && (
        <>
          {enrollmentSuccess ? (
            <div className="admission-success-card">
              <div className="success-icon-badge">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="success-title">Admission Completed Successfully!</h2>
              <p className="success-subtitle">
                Student <strong>{enrollmentSuccess.full_name}</strong> has been enrolled with Admission No. <code>{enrollmentSuccess.admission_no}</code>.
              </p>

              {enrollmentSuccess.payment && (
                <div className="receipt-success-preview">
                  <div className="rcpt-preview-header">
                    <span>Receipt No: <strong>{enrollmentSuccess.payment.receipt_number}</strong></span>
                    <span>Amount Paid: <strong>{formatCurrency(enrollmentSuccess.payment.amount)}</strong></span>
                  </div>
                  <p className="rcpt-notes">
                    1-Month advance tuition and admission charges have been allocated to the student ledger.
                  </p>
                </div>
              )}

              <div className="success-actions-row">
                <WhatsAppDirectButton
                  onSend={() => api.post(`/admissions/send-whatsapp/${enrollmentSuccess.student_id}`)}
                  phone={formData.whatsapp_number || formData.phone}
                  defaultLabel="Send Admission Receipt via WhatsApp"
                  successLabel="✓ WhatsApp Sent to Parent"
                  size="md"
                />

                <button
                  type="button"
                  className="btn-success-profile"
                  onClick={() => navigate(`/students/${enrollmentSuccess.student_id}`)}
                >
                  <Eye size={17} />
                  <span>View Student Profile &amp; Ledger</span>
                </button>

                <button
                  type="button"
                  className="btn-success-new"
                  onClick={handleResetForm}
                >
                  <Plus size={17} />
                  <span>Admit Another Student</span>
                </button>
              </div>
            </div>
          ) : (
            <form className="admission-form" onSubmit={handleSubmitAdmission}>
              {/* Section 1: Demographics & Academic Structure */}
              <div className="admission-section-card">
                <div className="section-card-header">
                  <div className="header-icon-box primary">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="section-title">1. Student Academic &amp; Personal Demographics</h3>
                    <p className="section-subtitle">Basic student identity, class assignment, and custom monthly tuition rate.</p>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Student Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Kumar"
                      value={formData.full_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label>Gender *</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Admission Date</label>
                    <input
                      type="date"
                      value={formData.admission_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, admission_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Assign Class *</label>
                    <select
                      value={formData.class_id}
                      onChange={(e) => setFormData((prev) => ({ ...prev, class_id: e.target.value, section_id: '' }))}
                      required
                    >
                      <option value="">Select Class...</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Assign Section</label>
                    <select
                      value={formData.section_id}
                      onChange={(e) => setFormData((prev) => ({ ...prev, section_id: e.target.value }))}
                    >
                      <option value="">No Section</option>
                      {sections
                        .filter((s) => !formData.class_id || s.class_id === Number(formData.class_id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.class_name ? `${s.class_name} - ${s.name}` : s.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Student Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                    >
                      <option value="day_scholar">Day Scholar (Day Boarder)</option>
                      <option value="hosteller">Hosteller (Hostel Accommodation)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Monthly Fee Rate (₹) — Custom Tuition/Hostel Rate *</label>
                    <div className="input-prefix-box">
                      <span className="prefix-currency">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.monthly_fee_rate}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormData((prev) => ({
                            ...prev,
                            monthly_fee_rate: val,
                            advance_fee_amount: val,
                          }));
                        }}
                        required
                      />
                    </div>
                    <span className="field-hint">
                      Each child can have a custom monthly fee rate specified by Admin.
                    </span>
                  </div>

                  <div className="form-field">
                    <div className="label-with-toggle">
                      <label>Admission Number</label>
                      <label className="toggle-checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.auto_generate_adm}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, auto_generate_adm: e.target.checked }))
                          }
                        />
                        <span>Auto-Generate</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder={formData.auto_generate_adm ? 'Auto-assigned on save' : 'e.g. ADM-2026-0050'}
                      value={formData.admission_no}
                      disabled={formData.auto_generate_adm}
                      onChange={(e) => setFormData((prev) => ({ ...prev, admission_no: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Parent / Guardian & Sibling Account Linking */}
              <div className="admission-section-card">
                <div className="section-card-header">
                  <div className="header-icon-box blue">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="section-title">2. Parent Details &amp; Family / Sibling Account Linking</h3>
                    <p className="section-subtitle">
                      Link brothers &amp; sisters into a unified Family Account for consolidated fee billing.
                    </p>
                  </div>
                </div>

                {/* Sibling Linker Box */}
                <div className="sibling-link-box">
                  <div className="sibling-toggle-row">
                    <label className="custom-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.is_sibling}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            is_sibling: e.target.checked,
                            selected_sibling: e.target.checked ? prev.selected_sibling : null,
                          }))
                        }
                      />
                      <span className="checkbox-text">
                        <strong>Is this student a sibling of an existing student?</strong> (Link to Family Account)
                      </span>
                    </label>
                  </div>

                  {formData.is_sibling && (
                    <div className="sibling-search-container">
                      {formData.selected_sibling ? (
                        <div className="selected-sibling-pill">
                          <div className="sibling-info">
                            <LinkIcon size={16} className="text-primary" />
                            <span>
                              Linked Sibling: <strong>{formData.selected_sibling.full_name}</strong> (Adm: {formData.selected_sibling.admission_no}, {formData.selected_sibling.class_name})
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn-remove-sibling"
                            onClick={removeSibling}
                            title="Unlink Sibling"
                          >
                            Change Sibling
                          </button>
                        </div>
                      ) : (
                        <div className="sibling-search-input-wrap">
                          <Search size={16} className="search-icon-inside" />
                          <input
                            type="text"
                            placeholder="Search existing brother/sister by name, admission no, or phone..."
                            value={formData.sibling_search}
                            onChange={(e) => handleSearchSibling(e.target.value)}
                          />
                          {searchingSibling && <Loader2 size={16} className="spin search-spinner" />}

                          {siblingSearchResults.length > 0 && (
                            <div className="sibling-dropdown-results">
                              {siblingSearchResults.map((std) => (
                                <div
                                  key={std.id}
                                  className="sibling-result-item"
                                  onClick={() => selectSibling(std)}
                                >
                                  <div className="std-result-name">
                                    <strong>{std.full_name}</strong>
                                    <span>Adm: {std.admission_no} • {std.class_name} {std.section_name && `(${std.section_name})`}</span>
                                  </div>
                                  <span className="std-parent-hint">
                                    Father: {std.father_name || std.parent_name || '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Father's Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.father_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, father_name: e.target.value }))}
                    />
                  </div>

                  <div className="form-field">
                    <label>Mother's Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sunita Devi"
                      value={formData.mother_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, mother_name: e.target.value }))}
                    />
                  </div>

                  <div className="form-field">
                    <label>Primary Phone Number</label>
                    <div className="input-prefix-box">
                      <Phone size={15} className="prefix-icon" />
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={formData.phone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value, whatsapp_number: prev.whatsapp_number || e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>WhatsApp Number (for Fee Reminders)</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData((prev) => ({ ...prev, whatsapp_number: e.target.value }))}
                    />
                  </div>

                  <div className="form-field">
                    <label>Residential Address</label>
                    <input
                      type="text"
                      placeholder="Village / Town, Post, District, PIN Code"
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Itemized Admission Charges, Security Deposit & 1-Month Advance Fee */}
              <div className="admission-section-card">
                <div className="section-card-header">
                  <div className="header-icon-box orange">
                    <IndianRupee size={18} />
                  </div>
                  <div>
                    <h3 className="section-title">3. Itemized Admission Billing &amp; 1-Month Advance Fee</h3>
                    <p className="section-subtitle">
                      Configure admission charges, refundable security money, first-month advance tuition allocation, and school kits.
                    </p>
                  </div>
                </div>

                {/* Admission Fee & Security Deposit rows */}
                <div className="fee-breakdown-grid">
                  {/* Admission Fee */}
                  <div className={`fee-item-card ${formData.has_admission_fee ? 'active' : ''}`}>
                    <div className="fee-card-toggle">
                      <input
                        type="checkbox"
                        checked={formData.has_admission_fee}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, has_admission_fee: e.target.checked }))
                        }
                      />
                      <span className="fee-title">🎟️ Admission Fee / Charge</span>
                    </div>
                    {formData.has_admission_fee && (
                      <div className="fee-amount-input-wrap">
                        <span className="input-rupee">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={formData.admission_fee_amount}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, admission_fee_amount: Number(e.target.value) }))
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Security Deposit */}
                  <div className={`fee-item-card ${formData.has_security_deposit ? 'active' : ''}`}>
                    <div className="fee-card-toggle">
                      <input
                        type="checkbox"
                        checked={formData.has_security_deposit}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, has_security_deposit: e.target.checked }))
                        }
                      />
                      <span className="fee-title">🛡️ Security Deposit / Caution Money</span>
                    </div>
                    {formData.has_security_deposit && (
                      <div className="fee-amount-input-wrap">
                        <span className="input-rupee">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={formData.security_deposit_amount}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, security_deposit_amount: Number(e.target.value) }))
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 1-Month Advance Fee Box */}
                <div className="advance-fee-box">
                  <div className="advance-header">
                    <label className="custom-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.include_advance_month}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, include_advance_month: e.target.checked }))
                        }
                      />
                      <span className="checkbox-text">
                        <strong>📅 Bill 1-Month Advance Tuition Fee at Admission</strong>
                      </span>
                    </label>
                    <span className="advance-badge">Assigns directly to student's monthly fee ledger</span>
                  </div>

                  {formData.include_advance_month && (
                    <div className="advance-inputs-row">
                      <div className="advance-field">
                        <label>Advance Month *</label>
                        <select
                          value={formData.advance_fee_month}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, advance_fee_month: Number(e.target.value) }))
                          }
                        >
                          {MONTH_OPTIONS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="advance-field">
                        <label>Academic Year</label>
                        <input
                          type="number"
                          value={formData.advance_fee_year}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, advance_fee_year: Number(e.target.value) }))
                          }
                        />
                      </div>

                      <div className="advance-field">
                        <label>Advance Fee Amount (₹)</label>
                        <div className="input-prefix-box">
                          <span className="prefix-currency">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={formData.advance_fee_amount}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, advance_fee_amount: Number(e.target.value) }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Extra Custom Expenses */}
                <div className="custom-expenses-box">
                  <div className="expenses-header">
                    <span className="expenses-title">➕ Extra School Expenses &amp; Kits (Uniform, Books, Registration, etc.)</span>
                    <button
                      type="button"
                      className="btn-add-expense-row"
                      onClick={addExpenseRow}
                    >
                      <Plus size={14} /> Add Extra Expense
                    </button>
                  </div>

                  {formData.custom_expenses.map((row) => (
                    <div key={row.id} className="expense-row-item">
                      <input
                        type="text"
                        className="expense-desc-input"
                        placeholder="Expense Description (e.g., Books Kit, School Uniform, Prospectus)"
                        value={row.description}
                        onChange={(e) => updateExpenseRow(row.id, 'description', e.target.value)}
                      />
                      <div className="expense-amount-wrap">
                        <span className="input-rupee">₹</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Amount"
                          value={row.amount}
                          onChange={(e) => updateExpenseRow(row.id, 'amount', Number(e.target.value))}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-remove-expense"
                        onClick={() => removeExpenseRow(row.id)}
                        title="Remove Charge"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total Billing Summary Bar */}
                <div className="admission-total-banner">
                  <div className="total-label-col">
                    <span className="total-heading">Total Admission Billing Summary</span>
                    <span className="total-sub">
                      Admission Fee + Security Deposit + 1-Month Advance Fee + Extra Expenses
                    </span>
                  </div>
                  <div className="total-amount-col">
                    <span className="total-rupee-txt">{formatCurrency(formData.paid_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Immediate Payment Collection & Official Receipt */}
              <div className="admission-section-card">
                <div className="section-card-header">
                  <div className="header-icon-box green">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="section-title">4. Fee Collection Desk &amp; Instant Receipt</h3>
                    <p className="section-subtitle">
                      Record upfront cash or bank payment and immediately issue the official itemized Admission &amp; Advance Receipt.
                    </p>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Amount Paid Now (₹) *</label>
                    <div className="input-prefix-box">
                      <span className="prefix-currency">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.paid_amount}
                        onChange={(e) => setFormData((prev) => ({ ...prev, paid_amount: Number(e.target.value) }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Payment Channel *</label>
                    <select
                      value={formData.payment_mode}
                      onChange={(e) => setFormData((prev) => ({ ...prev, payment_mode: e.target.value }))}
                    >
                      <option value="CASH">Cash Desk</option>
                      <option value="IN_ACCOUNT">In-Account (Bank / UPI / Online Transfer)</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Payment Remarks / Notes</label>
                    <input
                      type="text"
                      placeholder="e.g., Full admission & advance fee cleared"
                      value={formData.payment_notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, payment_notes: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="admission-submit-footer">
                  <button
                    type="button"
                    className="btn-cancel-adm"
                    onClick={handleResetForm}
                  >
                    Clear Form
                  </button>

                  <button
                    type="submit"
                    className="btn-complete-admission"
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
                    <span>{submitting ? 'Enrolling & Billing...' : 'Complete Admission & Generate Receipt'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}

      {/* View 2: Admissions Register & History */}
      {activeTab === 'register' && (
        <div className="admissions-register-card">
          <div className="register-filter-bar">
            <div className="register-search-wrap">
              <Search size={16} className="search-icon-reg" />
              <input
                type="search"
                placeholder="Search admission by student name, adm no, or phone..."
                value={searchList}
                onChange={(e) => setSearchList(e.target.value)}
              />
            </div>

            <select
              value={classListFilter}
              onChange={(e) => setClassListFilter(e.target.value)}
              className="register-select"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn-refresh-reg"
              onClick={fetchAdmissionsList}
            >
              <RotateCcw size={14} /> Refresh
            </button>
          </div>

          {loadingList ? (
            <div className="register-loading-box">
              <Loader2 size={32} className="spin text-primary" />
              <span>Loading admissions register...</span>
            </div>
          ) : admissionsList.length === 0 ? (
            <div className="register-empty-box">
              <GraduationCap size={44} className="text-muted" />
              <p>No student admissions found in the register.</p>
            </div>
          ) : (
            <div className="table-responsive-wrapper">
              <table className="admissions-ledger-table">
                <thead>
                  <tr>
                    <th>Adm No</th>
                    <th>Student Name</th>
                    <th>Class / Sec</th>
                    <th>Category</th>
                    <th>Monthly Rate</th>
                    <th>Adm Date</th>
                    <th>Amount Paid</th>
                    <th>Family Link</th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admissionsList.map((adm) => (
                    <tr key={adm.id}>
                      <td>
                        <span className="adm-code-pill">{adm.admission_no}</span>
                      </td>
                      <td>
                        <div className="std-cell-info">
                          <strong>{adm.full_name}</strong>
                          {adm.father_name && <small>Father: {adm.father_name}</small>}
                        </div>
                      </td>
                      <td>
                        <span className="class-pill">{adm.class_name || 'Class —'} {adm.section_name && `(${adm.section_name})`}</span>
                      </td>
                      <td>
                        <span className={`cat-pill ${adm.category}`}>
                          {adm.category === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
                        </span>
                      </td>
                      <td>
                        <strong>{formatCurrency(adm.monthly_fee_rate)}</strong>
                      </td>
                      <td>
                        <span className="adm-date-txt">
                          {adm.admission_date ? new Date(adm.admission_date).toLocaleDateString('en-IN') : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="adm-paid-txt">
                          {formatCurrency(adm.admission_paid_amount)}
                        </span>
                      </td>
                      <td>
                        {adm.family_id ? (
                          <span className="family-badge">
                            <LinkIcon size={12} /> {adm.family_id}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="td-actions">
                        <WhatsAppDirectButton
                          compact
                          size="sm"
                          onSend={() => api.post(`/admissions/send-whatsapp/${adm.id}`)}
                          phone={adm.phone}
                        />
                        <button
                          type="button"
                          className="btn-view-profile-sm"
                          onClick={() => navigate(`/students/${adm.id}`)}
                          title="View Student Profile"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
