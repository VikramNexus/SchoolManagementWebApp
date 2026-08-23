/**
 * Student Profile Page — School Management System (Frontend)
 *
 * Student profile with per-student custom fee structure,
 * separate Father's & Mother's names, Other Expenses / Extra Charges section,
 * Manual Month Fee Assignment modal, Edit Profile button,
 * and real-time payment recording & PDF receipt downloads.
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  MessageCircle,
  User,
  Building2,
  Calendar,
  MapPin,
  DollarSign,
  Loader2,
  AlertTriangle,
  Plus,
  Edit2,
  CreditCard,
  Trash2,
  Tag,
  Receipt,
  FileText,
  CalendarPlus,
  CheckCircle,
  Save,
  X,
  Users,
  Link as LinkIcon,
  Unlink,
  Layers,
  Search,
  Eye,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import WhatsAppDirectButton from '../components/WhatsAppDirectButton';
import FeeLedgerTable from '../components/FeeLedgerTable';
import RecordPaymentModal from '../components/RecordPaymentModal';
import EditMonthlyRateModal from '../components/EditMonthlyRateModal';
import DeleteStudentModal from '../components/DeleteStudentModal';
import StudentModal from '../components/StudentModal';
import StudentFeeLedgerModal from '../components/StudentFeeLedgerModal';
import JpgReceiptModal from '../components/JpgReceiptModal';
import './StudentProfile.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function StudentProfile() {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [monthlyFees, setMonthlyFees] = useState([]);
  const [additionalFees, setAdditionalFees] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showAddFeeModal, setShowAddFeeModal] = useState(false);
  const [showAssignMonthModal, setShowAssignMonthModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showEditRateModal, setShowEditRateModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fee Statement & Receipt Modals
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedReceiptData, setSelectedReceiptData] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Family & Sibling Account State
  const [familyData, setFamilyData] = useState(null);
  const [showLinkSiblingModal, setShowLinkSiblingModal] = useState(false);
  const [showFamilyPaymentModal, setShowFamilyPaymentModal] = useState(false);
  const [siblingSearchQuery, setSiblingSearchQuery] = useState('');
  const [siblingSearchResults, setSiblingSearchResults] = useState([]);
  const [searchingSibling, setSearchingSibling] = useState(false);
  const [selectedSiblingToLink, setSelectedSiblingToLink] = useState(null);
  const [familyPaymentForm, setFamilyPaymentForm] = useState({
    payment_mode: 'CASH',
    payment_date: new Date().toISOString().slice(0, 10),
    notes: '',
    allocations: {},
  });
  const [submittingFamilyPayment, setSubmittingFamilyPayment] = useState(false);

  const [editingExtraFee, setEditingExtraFee] = useState(null);
  const [editExtraForm, setEditExtraForm] = useState({
    description: '',
    amount: '',
    fee_month: new Date().getMonth() + 1,
    fee_year: new Date().getFullYear(),
    due_date: '',
    notes: '',
  });

  const handleStartEditExtraFee = (af) => {
    setEditingExtraFee(af);
    setEditExtraForm({
      description: af.description || af.fee_type_name || '',
      amount: String(af.amount || ''),
      fee_month: af.fee_month || (new Date().getMonth() + 1),
      fee_year: af.fee_year || new Date().getFullYear(),
      due_date: af.due_date ? String(af.due_date).slice(0, 10) : '',
      notes: af.notes || '',
    });
  };

  const handleSaveExtraFeeEdit = async (e) => {
    e.preventDefault();
    if (!editingExtraFee) return;
    try {
      const res = await api.patch(`/students/${id}/add-fee/${editingExtraFee.id}`, {
        description: editExtraForm.description,
        amount: Number(editExtraForm.amount),
        fee_month: Number(editExtraForm.fee_month),
        fee_year: Number(editExtraForm.fee_year),
        due_date: editExtraForm.due_date || undefined,
        notes: editExtraForm.notes || undefined,
      });
      if (res.data.success) {
        toast.success('Extra expense charge updated successfully.');
        setEditingExtraFee(null);
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update extra expense.');
    }
  };
  const [addFeeForm, setAddFeeForm] = useState({
    fee_type_id: '',
    amount: '',
    due_date: '',
    notes: '',
  });

  const [assignMonthForm, setAssignMonthForm] = useState({
    fee_month: new Date().getMonth() + 1,
    fee_year: new Date().getFullYear(),
  });
  const [generatingMonth, setGeneratingMonth] = useState(false);

  const [downloadingDuesNotice, setDownloadingDuesNotice] = useState(false);
  const [downloadingPaymentReceiptId, setDownloadingPaymentReceiptId] = useState(null);

  const handleOpenAssignMonthModal = () => {
    let m = new Date().getMonth() + 1;
    let y = new Date().getFullYear();

    if (monthlyFees && monthlyFees.length > 0) {
      const sorted = [...monthlyFees].sort((a, b) => {
        if (a.fee_year !== b.fee_year) return a.fee_year - b.fee_year;
        return a.fee_month - b.fee_month;
      });
      const last = sorted[sorted.length - 1];
      if (last.fee_month === 12) {
        m = 1;
        y = last.fee_year + 1;
      } else {
        m = last.fee_month + 1;
        y = last.fee_year;
      }
    } else if (student?.admission_date || student?.created_at) {
      const adm = new Date(student.admission_date || student.created_at);
      const admM = !isNaN(adm.getTime()) ? adm.getMonth() + 1 : m;
      const admY = !isNaN(adm.getTime()) ? adm.getFullYear() : y;

      if (admM === 12) {
        m = 1;
        y = admY + 1;
      } else {
        m = admM + 1;
        y = admY;
      }
    }

    setAssignMonthForm({ fee_month: m, fee_year: y });
    setShowAssignMonthModal(true);
  };

  const handleDownloadDuesNotice = async () => {
    try {
      setDownloadingDuesNotice(true);
      const res = await api.get(`/receipts/dues-notice/${id}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Dues_Notice_${student?.full_name ? student.full_name.replace(/\s+/g, '_') : 'Student'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Dues Receipt PDF downloaded successfully.');
    } catch (err) {
      toast.error('Failed to download Dues Receipt PDF.');
    } finally {
      setDownloadingDuesNotice(false);
    }
  };

  const handleDownloadPaymentReceipt = async (paymentId, receiptNumber) => {
    try {
      setDownloadingPaymentReceiptId(paymentId);
      const res = await api.get(`/receipts/download/${paymentId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${receiptNumber || paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Payment receipt PDF downloaded.');
    } catch (err) {
      toast.error('Failed to download payment receipt PDF.');
    } finally {
      setDownloadingPaymentReceiptId(null);
    }
  };

  const fetchClassesAndSections = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        api.get('/settings/classes'),
        api.get('/settings/sections'),
      ]);
      if (cRes.data.success) setClasses(cRes.data.classes || []);
      if (sRes.data.success) setSections(sRes.data.sections || []);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/students/${id}/profile`);
      if (res.data.success) {
        setStudent(res.data.student);
        setMonthlyFees(res.data.monthly_fees || []);
        setAdditionalFees(res.data.additional_fees || []);
        setRecentPayments(res.data.recent_payments || []);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load student profile';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeeTypes = async () => {
    try {
      const res = await api.get('/settings/fee-types');
      if (res.data.success) {
        setFeeTypes(res.data.fee_types.filter((ft) => ft.is_active));
      }
    } catch (err) {
      console.error('Failed to load fee types:', err);
    }
  };

  const fetchFamilyData = async () => {
    try {
      const res = await api.get(`/family/by-student/${id}`);
      if (res.data.success) {
        setFamilyData(res.data);
      }
    } catch (err) {
      console.error('Failed to load family data:', err);
    }
  };

  useEffect(() => {
    fetchClassesAndSections();
    fetchProfile();
    fetchFamilyData();
    fetchFeeTypes();
  }, [id]);

  const handleSearchSibling = async (text) => {
    setSiblingSearchQuery(text);
    if (!text || text.trim().length < 2) {
      setSiblingSearchResults([]);
      return;
    }
    try {
      setSearchingSibling(true);
      const res = await api.get(`/family/search?q=${encodeURIComponent(text.trim())}`);
      if (res.data.success) {
        // Filter out current student
        setSiblingSearchResults((res.data.students || []).filter(s => s.id !== Number(id)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingSibling(false);
    }
  };

  const handleLinkSibling = async () => {
    if (!selectedSiblingToLink) {
      toast.error('Please select a student to link.');
      return;
    }
    try {
      const res = await api.post('/family/concatenate', {
        student_ids: [Number(id), selectedSiblingToLink.id],
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Sibling profile linked successfully.');
        setShowLinkSiblingModal(false);
        setSelectedSiblingToLink(null);
        setSiblingSearchQuery('');
        fetchFamilyData();
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to link sibling.');
    }
  };

  const handleUnlinkSibling = async (studentIdToUnlink, studentName) => {
    if (!window.confirm(`Are you sure you want to unlink ${studentName} from this family group?`)) {
      return;
    }
    try {
      const res = await api.post('/family/unlink', { student_id: studentIdToUnlink });
      if (res.data.success) {
        toast.success('Sibling unlinked from family group.');
        fetchFamilyData();
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unlink sibling.');
    }
  };

  const handleOpenFamilyPayment = () => {
    if (!familyData?.siblings) return;
    const initialAllocations = {};
    familyData.siblings.forEach(s => {
      initialAllocations[s.id] = s.total_due || 0;
    });
    setFamilyPaymentForm({
      payment_mode: 'CASH',
      payment_date: new Date().toISOString().slice(0, 10),
      notes: 'Combined family fee payment',
      allocations: initialAllocations,
    });
    setShowFamilyPaymentModal(true);
  };

  const handleFamilyPaymentSubmit = async (e) => {
    e.preventDefault();
    const allocList = Object.entries(familyPaymentForm.allocations)
      .map(([stdId, amt]) => ({ student_id: Number(stdId), amount: Number(amt) }))
      .filter(a => a.amount > 0);

    if (allocList.length === 0) {
      toast.error('Please enter at least one payment amount for a sibling.');
      return;
    }

    try {
      setSubmittingFamilyPayment(true);
      const res = await api.post('/family/record-payment', {
        family_id: familyData?.family_id,
        payment_mode: familyPaymentForm.payment_mode,
        payment_date: familyPaymentForm.payment_date,
        notes: familyPaymentForm.notes,
        allocations: allocList,
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Family payment recorded successfully.');
        setShowFamilyPaymentModal(false);
        fetchFamilyData();
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record family payment.');
    } finally {
      setSubmittingFamilyPayment(false);
    }
  };

  const formatCategory = (cat) => (cat === 'hosteller' ? 'Hosteller' : 'Day Scholar');

  const formatCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDateSafe = (dStr) => {
    if (!dStr) return '—';
    try {
      const d = new Date(dStr);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
    } catch {
      return '—';
    }
  };

  const getStatusColor = (status) => {
    const s = String(status || 'active').toLowerCase();
    switch (s) {
      case 'active': return '#22c55e';
      case 'inactive': return '#64748b';
      case 'deleted': return '#ef4444';
      default: return '#64748b';
    }
  };

  const handleAddFee = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/students/${id}/add-fee`, {
        fee_type_id: addFeeForm.fee_type_id ? Number(addFeeForm.fee_type_id) : undefined,
        amount: Number(addFeeForm.amount),
        fee_month: Number(addFeeForm.fee_month),
        fee_year: Number(addFeeForm.fee_year),
        description: addFeeForm.description || addFeeForm.notes || 'Custom Extra Charge',
        due_date: addFeeForm.due_date || undefined,
        notes: addFeeForm.notes || undefined,
      });
      if (res.data.success) {
        toast.success('Other expense charge added and linked to fee register.');
        setShowAddFeeModal(false);
        setAddFeeForm({
          fee_type_id: '',
          amount: '',
          due_date: '',
          notes: '',
          fee_month: new Date().getMonth() + 1,
          fee_year: new Date().getFullYear(),
          description: '',
        });
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add extra charge.');
    }
  };

  const handleRemoveFee = async (feeId) => {
    if (!window.confirm('Are you sure you want to remove this extra expense charge?')) return;
    try {
      const res = await api.delete(`/students/${id}/add-fee/${feeId}`);
      if (res.data.success) {
        toast.success('Extra expense removed.');
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove expense.');
    }
  };

  const handleAssignMonthFee = async (e) => {
    e.preventDefault();
    try {
      setGeneratingMonth(true);
      const res = await api.post(`/students/${id}/generate-month-fee`, {
        fee_month: Number(assignMonthForm.fee_month),
        fee_year: Number(assignMonthForm.fee_year),
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Monthly fee assigned successfully.');
        setShowAssignMonthModal(false);
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign monthly fee.');
    } finally {
      setGeneratingMonth(false);
    }
  };

  const handleOpenReceipt = async (paymentId) => {
    try {
      const res = await api.get(`/receipts/${paymentId}`);
      if (res.data.success) {
        setSelectedReceiptData(res.data);
        setShowReceiptModal(true);
      }
    } catch (err) {
      toast.error('Failed to load receipt details.');
    }
  };

  // Calculate totals
  const totalMonthlyDue = (monthlyFees || [])
    .filter(f => f && f.status !== 'PAID')
    .reduce((sum, f) => sum + Number(f.due_amount || 0), 0);

  const totalOtherExpenseDue = (additionalFees || [])
    .filter(f => f && f.status !== 'PAID')
    .reduce((sum, f) => sum + Number(f.due_amount !== undefined ? f.due_amount : f.amount || 0), 0);

  const totalOverallDue = totalMonthlyDue + totalOtherExpenseDue;

  if (loading && !student) {
    return (
      <div className="profile-loading">
        <Loader2 size={24} className="spin" />
        <span>Loading student profile…</span>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="profile-error">
        <AlertTriangle size={48} />
        <h2>Unable to Load Profile</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={fetchProfile}>
          Retry
        </button>
      </div>
    );
  }

  const handleQuickAssignMonth = async (month, year) => {
    try {
      const res = await api.post(`/students/${id}/generate-month-fee`, {
        fee_month: Number(month),
        fee_year: Number(year),
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Monthly fee assigned successfully.');
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign monthly fee.');
    }
  };

  const handleUpdateMonthFee = async (feeId, newFeeAmount) => {
    try {
      const res = await api.patch(`/students/${id}/monthly-fees/${feeId}`, {
        fee_amount: Number(newFeeAmount),
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Monthly fee record updated.');
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update monthly fee.');
    }
  };

  const handleDeleteMonthFee = async (feeId) => {
    try {
      const res = await api.delete(`/students/${id}/monthly-fees/${feeId}`);
      if (res.data.success) {
        toast.success(res.data.message || 'Month fee entry deleted.');
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete month fee.');
    }
  };

  if (!student) {
    return (
      <div className="profile-error">
        <AlertTriangle size={48} />
        <h2>Student Not Found</h2>
        <p>No active student record exists for ID #{id}.</p>
        <button className="btn btn-primary" onClick={() => navigate('/students')}>
          Back to Students Directory
        </button>
      </div>
    );
  }

  return (
    <div className="student-profile">
      {/* Header */}
      <header className="profile-header">
        <div className="header-left">
          <Link to="/students" className="back-btn" aria-label="Back to students">
            <ArrowLeft size={20} />
          </Link>
          <div className="student-identity">
            <div className="avatar">
              {student.full_name?.charAt(0)?.toUpperCase() || 'S'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0 }}>{student.full_name}</h1>
                <span
                  className="gender-badge-inline"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    backgroundColor: student.gender === 'female' ? '#fce7f3' : student.gender === 'other' ? '#f3e8ff' : '#e0f2fe',
                    color: student.gender === 'female' ? '#be185d' : student.gender === 'other' ? '#7e22ce' : '#0369a1',
                    border: `1px solid ${student.gender === 'female' ? '#fbcfe8' : student.gender === 'other' ? '#e9d5ff' : '#bae6fd'}`,
                  }}
                >
                  {student.gender === 'female' ? '♀ Female' : student.gender === 'other' ? '⚧ Other' : '♂ Male'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                <p className="admission-no" style={{ margin: 0 }}>Admission No. {student.admission_no}</p>
                <span style={{ fontSize: '0.8125rem', color: '#0284c7', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#f0f9ff', padding: '0.15rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #bae6fd' }}>
                  <Calendar size={13} /> Admission Date: {formatDateSafe(student.admission_date || student.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="header-right">
          <span
            className="status-badge"
            style={{ backgroundColor: `${getStatusColor(student.status)}20`, color: getStatusColor(student.status) }}
          >
            {student.status ? String(student.status).toUpperCase() : 'ACTIVE'}
          </span>
          <button className="btn btn-primary btn-ledger-statement" onClick={() => setShowLedgerModal(true)}>
            <Receipt size={16} /> Fee Ledger &amp; Statement
          </button>
          <button className="btn btn-secondary" onClick={() => setShowEditProfileModal(true)}>
            <Edit2 size={16} /> Edit Profile
          </button>
          <button className="btn btn-secondary" onClick={handleOpenAssignMonthModal}>
            <CalendarPlus size={16} /> Assign Month Fee
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAddFeeModal(true)}>
            <Plus size={16} /> Add Extra Expense
          </button>
          <button className="btn btn-success-pay" onClick={() => setShowRecordPaymentModal(true)}>
            <CreditCard size={16} /> Record Payment
          </button>
          <button className="btn btn-danger-outline" onClick={() => setShowDeleteModal(true)} title="Delete or Mark as Left">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </header>

      <div className="profile-content">
        {/* Dues Breakdown Summary Bar */}
        <section className="dues-summary-bar">
          <div className="dues-card red">
            <span className="card-label">Monthly Fees Outstanding</span>
            <span className="card-value">{formatCurrency(totalMonthlyDue)}</span>
          </div>
          <div className="dues-card orange">
            <span className="card-label">Other Expenses &amp; Extra Charges</span>
            <span className="card-value">{formatCurrency(totalOtherExpenseDue)}</span>
          </div>
          <div className="dues-card dark-red">
            <span className="card-label">Total Outstanding Dues</span>
            <span className="card-value">{formatCurrency(totalOverallDue)}</span>
          </div>
        </section>

        {/* Quick Info Cards */}
        <section className="info-cards">
          <div className="info-card">
            <div className="card-icon blue"><User size={24} /></div>
            <div className="card-info">
              <span className="card-label">Class / Section</span>
              <span className="card-value">
                {student.class_name} {student.section_name && <span className="section-tag">{student.section_name}</span>}
              </span>
            </div>
          </div>
          <div className="info-card">
            <div className="card-icon green"><Building2 size={24} /></div>
            <div className="card-info">
              <span className="card-label">Category</span>
              <span className="card-value">{formatCategory(student.category)}</span>
            </div>
          </div>
          <div className="info-card highlight-rate">
            <div className="card-icon teal"><DollarSign size={24} /></div>
            <div className="card-info">
              <span className="card-label">Monthly Fee Rate</span>
              <span className="card-value rate-value-text">
                {formatCurrency(
                  Number(student.monthly_fee_rate) > 0
                    ? Number(student.monthly_fee_rate)
                    : student.category === 'hosteller' ? 5000 : 3000
                )}
                <button
                  className="icon-btn edit-rate-btn"
                  onClick={() => setShowEditRateModal(true)}
                  title="Edit Monthly Rate"
                >
                  <Edit2 size={14} /> Edit
                </button>
              </span>
            </div>
          </div>
          <div className="info-card">
            <div className="card-icon blue"><Calendar size={24} /></div>
            <div className="card-info">
              <span className="card-label">Admission Date</span>
              <span className="card-value">
                {formatDateSafe(student.admission_date || student.created_at)}
              </span>
            </div>
          </div>
          <div className="info-card">
            <div className="card-icon purple"><User size={24} /></div>
            <div className="card-info">
              <span className="card-label">Father's Name</span>
              <span className="card-value">{student.father_name || student.parent_name || '—'}</span>
            </div>
          </div>
          <div className="info-card">
            <div className="card-icon purple"><User size={24} /></div>
            <div className="card-info">
              <span className="card-label">Mother's Name</span>
              <span className="card-value">{student.mother_name || '—'}</span>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="contact-section">
          <div className="contact-info">
            <h2>Contact &amp; Personal Information</h2>
            <div className="contact-grid">
              <a href={`tel:${student.phone}`} className="contact-item" title="Call">
                <Phone size={20} />
                <span>{student.phone || 'Not provided'}</span>
              </a>
              <a href={`sms:${student.phone}`} className="contact-item" title="SMS">
                <MessageSquare size={20} />
                <span>SMS</span>
              </a>
              {student.whatsapp_number && (
                <a
                  href={`https://wa.me/91${student.whatsapp_number.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-item whatsapp"
                  title="WhatsApp"
                >
                  <MessageCircle size={20} />
                  <span>WhatsApp</span>
                </a>
              )}
              {student.address && (
                <div className="contact-item address full-width">
                  <MapPin size={20} />
                  <span>{student.address}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Family & Sibling Account Ledger Section */}
        <section className="family-account-section">
          <div className="section-header-box">
            <div className="d-flex align-center gap-2">
              <div className="family-icon-badge">
                <Users size={20} />
              </div>
              <div>
                <h2 className="dark-title">
                  Family &amp; Sibling Fee Account
                  {familyData?.family_id && (
                    <span className="family-id-pill">
                      <LinkIcon size={13} /> {familyData.family_id}
                    </span>
                  )}
                </h2>
                <p className="subtitle">
                  Consolidated multi-student fee ledger for brothers &amp; sisters studying across different classes
                </p>
              </div>
            </div>

            <div className="family-header-actions">
              {familyData?.has_family && familyData.siblings?.length > 1 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleOpenFamilyPayment}
                >
                  <CreditCard size={15} /> Pay Family Dues
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelectedSiblingToLink(null);
                  setSiblingSearchQuery('');
                  setSiblingSearchResults([]);
                  setShowLinkSiblingModal(true);
                }}
              >
                <Plus size={15} /> Link Brother / Sister
              </button>
            </div>
          </div>

          {familyData?.has_family && familyData.siblings?.length > 1 ? (
            <div className="family-siblings-card">
              <div className="family-summary-banner">
                <div className="banner-col">
                  <span className="banner-lbl">Total Linked Siblings</span>
                  <span className="banner-val">{familyData.siblings.length} Students</span>
                </div>
                <div className="banner-col">
                  <span className="banner-lbl">Combined Family Outstanding</span>
                  <span className="banner-val text-danger">{formatCurrency(familyData.total_family_dues)}</span>
                </div>
              </div>

              <div className="table-responsive">
                <table className="family-ledger-table">
                  <thead>
                    <tr>
                      <th>Sibling Name</th>
                      <th>Class / Sec</th>
                      <th>Category</th>
                      <th>Custom Monthly Rate</th>
                      <th>Monthly Dues</th>
                      <th>Extra Dues</th>
                      <th>Total Due</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyData.siblings.map((sib) => {
                      const isCurrent = sib.id === Number(id);
                      return (
                        <tr key={sib.id} className={isCurrent ? 'current-sibling-row' : ''}>
                          <td>
                            <div className="sibling-name-cell">
                              <strong>{sib.full_name}</strong>
                              {isCurrent && <span className="current-std-tag">Current Profile</span>}
                              <small className="text-muted">Adm: {sib.admission_no}</small>
                            </div>
                          </td>
                          <td>
                            <span className="class-badge-pill">
                              {sib.class_name || 'Class —'} {sib.section_name && `(${sib.section_name})`}
                            </span>
                          </td>
                          <td>
                            <span className={`cat-pill ${sib.category}`}>
                              {sib.category === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
                            </span>
                          </td>
                          <td>
                            <strong>{formatCurrency(sib.monthly_fee_rate)}</strong>
                          </td>
                          <td>
                            <span className={sib.monthly_dues > 0 ? 'text-danger font-bold' : 'text-success'}>
                              {formatCurrency(sib.monthly_dues)}
                            </span>
                          </td>
                          <td>
                            <span className={sib.additional_dues > 0 ? 'text-danger font-bold' : 'text-success'}>
                              {formatCurrency(sib.additional_dues)}
                            </span>
                          </td>
                          <td>
                            <strong className={sib.total_due > 0 ? 'text-danger' : 'text-success'}>
                              {formatCurrency(sib.total_due)}
                            </strong>
                          </td>
                          <td>
                            <div className="sibling-row-actions">
                              {!isCurrent && (
                                <button
                                  type="button"
                                  className="btn-view-sib"
                                  onClick={() => navigate(`/students/${sib.id}`)}
                                  title="View Sibling Profile"
                                >
                                  <Eye size={14} /> Profile
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-unlink-sib"
                                onClick={() => handleUnlinkSibling(sib.id, sib.full_name)}
                                title="Unlink from Family"
                              >
                                <Unlink size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty-family-banner">
              <div className="empty-family-left">
                <Users size={28} className="text-muted" />
                <div>
                  <strong>No Siblings Linked Yet</strong>
                  <p>Link brothers and sisters studying in this school to manage custom fees &amp; receipts in one place.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelectedSiblingToLink(null);
                  setSiblingSearchQuery('');
                  setSiblingSearchResults([]);
                  setShowLinkSiblingModal(true);
                }}
              >
                <Plus size={15} /> Link Sibling Profile
              </button>
            </div>
          )}
        </section>

        {/* Other Expenses & Extra Student Charges Section */}
        <section className="extra-expenses-section">
          <div className="section-header-box">
            <div>
              <h2 className="dark-title"><Tag size={20} /> Other Expenses &amp; Extra Student Charges</h2>
              <p className="subtitle">Extra hostel, medical, transport, or custom expenses attached to this student</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddFeeModal(true)}>
              <Plus size={16} /> Add Extra Expense
            </button>
          </div>

          {additionalFees.length === 0 ? (
            <div className="empty-expenses">
              <Tag size={32} />
              <p>No extra expenses or custom charges added for this student.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Expense Title / Reason</th>
                    <th>Expense Date</th>
                    <th>Total Charge (₹)</th>
                    <th>Remaining Due (₹)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {additionalFees.map((af) => (
                    <tr key={af.id}>
                      <td>
                        <strong>{af.description || af.fee_type_name || 'Custom Expense'}</strong>
                        {af.fee_month && (
                          <span className="section-tag" style={{ marginLeft: '0.5rem' }}>
                            {MONTH_NAMES[af.fee_month - 1]} {af.fee_year}
                          </span>
                        )}
                        {af.notes && af.notes !== af.description && <small className="d-block text-muted">{af.notes}</small>}
                      </td>
                      <td>{af.due_date ? new Date(af.due_date).toLocaleDateString('en-IN') : (af.created_at ? new Date(af.created_at).toLocaleDateString('en-IN') : '—')}</td>
                      <td>{formatCurrency(af.amount)}</td>
                      <td className="amount-due">
                        <strong>{formatCurrency(af.due_amount !== undefined ? af.due_amount : af.amount)}</strong>
                      </td>
                      <td>
                        <div className="action-buttons-inline" style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleStartEditExtraFee(af)}
                            title="Edit Extra Charge"
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                          {af.status === 'DUE' && (
                            <button
                              className="btn btn-secondary btn-xs text-danger"
                              onClick={() => handleRemoveFee(af.id)}
                              title="Remove Extra Charge"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Monthly Fee Ledger */}
        <section className="ledger-section">
          <div className="section-header-box">
            <div>
              <h2 className="dark-title"><DollarSign size={20} /> Monthly Fee Ledger</h2>
              <p className="subtitle">Month-wise fee records generated for this student</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleOpenAssignMonthModal}>
              <CalendarPlus size={16} /> Assign Month Fee
            </button>
          </div>

          <FeeLedgerTable
            monthlyFees={monthlyFees}
            studentMonthlyRate={student.monthly_fee_rate}
            admissionDate={student.admission_date || student.created_at}
            loading={loading}
            onAssignMonth={handleQuickAssignMonth}
            onUpdateMonthFee={handleUpdateMonthFee}
            onDeleteMonthFee={handleDeleteMonthFee}
            onViewReceipt={handleOpenReceipt}
            onRecordPayment={() => setShowRecordPaymentModal(true)}
          />
        </section>

        {/* Pending Dues & Payment Actions Section */}
        <section className="pending-dues-section">
          <div className="section-header-box">
            <div>
              <h2 className="dark-title"><CreditCard size={20} /> Pending Dues &amp; Payment Action</h2>
              <p className="subtitle">Download official dues receipt PDF or receive payment directly from student</p>
            </div>
            <div className="header-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <WhatsAppDirectButton
                onSend={() => api.post(`/receipts/send-dues-whatsapp/${student.id}`)}
                phone={student.whatsapp_number || student.phone}
                defaultLabel="Send Dues Bill via WhatsApp"
                successLabel="✓ Dues Notice Sent"
                size="sm"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadDuesNotice}
                disabled={downloadingDuesNotice}
              >
                {downloadingDuesNotice ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                Download Dues Receipt PDF
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowRecordPaymentModal(true)}
              >
                <CreditCard size={16} /> Receive Money from Student
              </button>
            </div>
          </div>
        </section>

        {/* Recent Payments */}
        {recentPayments.length > 0 && (
          <section className="payments-section">
            <h2 className="section-title dark-title">
              <DollarSign size={18} /> Recent Payments Collected
            </h2>
            <div className="table-wrapper">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Receipt</th>
                    <th>WhatsApp</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p) => {
                    const modeStr = (p.payment_mode || p.mode || 'CASH').toLowerCase();
                    const receiptNum = p.receipt_number || `RCP-${String(p.id).padStart(6, '0')}`;
                    return (
                      <tr key={p.id}>
                        <td>{new Date(p.payment_date || p.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="amount-paid">{formatCurrency(p.amount)}</td>
                        <td>
                          {modeStr.includes('account') || modeStr.includes('bank') || modeStr.includes('online') || modeStr.includes('in_account') ? (
                            <span className="remark-in-account" style={{ padding: '0.2rem 0.6rem' }}>in acc.</span>
                          ) : (
                            <span className="remark-cash" style={{ padding: '0.2rem 0.6rem' }}>cash</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleOpenReceipt(p.id)}
                            title="View & Download Official JPG Receipt & WhatsApp Share"
                            style={{ gap: '0.3rem', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <Receipt size={13} />
                            {receiptNum}
                          </button>
                        </td>
                        <td>
                          <WhatsAppDirectButton
                            compact
                            size="sm"
                            onSend={() => api.post(`/receipts/send-whatsapp/${p.id}`)}
                            phone={student.whatsapp_number || student.phone}
                          />
                        </td>
                        <td>{p.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Edit Student Profile Modal */}
      {showEditProfileModal && (
        <StudentModal
          student={student}
          classes={classes}
          sections={sections}
          onClose={() => setShowEditProfileModal(false)}
          onSaved={() => {
            setShowEditProfileModal(false);
            fetchProfile();
          }}
        />
      )}

      {/* Assign Month Fee Modal */}
      {showAssignMonthModal && (
        <div className="modal-overlay" onClick={() => setShowAssignMonthModal(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Monthly Fee for Student</h2>
              <button className="modal-close" onClick={() => setShowAssignMonthModal(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <form className="modal-body" onSubmit={handleAssignMonthFee}>
              <p className="modal-desc">
                Assign a monthly fee for <strong>{student.full_name}</strong> at their custom rate of <strong>{formatCurrency(student.monthly_fee_rate || (student.category === 'hosteller' ? 5000 : 3000))}</strong>.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fee_month">Target Month <span className="required">*</span></label>
                  <select
                    id="fee_month"
                    name="fee_month"
                    value={assignMonthForm.fee_month}
                    onChange={(e) => setAssignMonthForm({ ...assignMonthForm, fee_month: e.target.value })}
                    required
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="fee_year">Target Year <span className="required">*</span></label>
                  <input
                    type="number"
                    id="fee_year"
                    name="fee_year"
                    value={assignMonthForm.fee_year}
                    onChange={(e) => setAssignMonthForm({ ...assignMonthForm, fee_year: e.target.value })}
                    min="2020"
                    max="2100"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignMonthModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={generatingMonth}>
                  {generatingMonth ? <Loader2 size={16} className="spin" /> : <CalendarPlus size={16} />} Assign Fee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Fee / Extra Charge Modal */}
      {showAddFeeModal && (
        <div className="modal-overlay" onClick={() => setShowAddFeeModal(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Extra Expense / Custom Charge</h2>
              <button className="modal-close" onClick={() => setShowAddFeeModal(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <form className="modal-body" onSubmit={handleAddFee}>
              <div className="form-group">
                <label htmlFor="description">Custom Reason / Expense Title <span className="required">*</span></label>
                <input
                  type="text"
                  id="description"
                  name="description"
                  value={addFeeForm.description}
                  onChange={(e) => setAddFeeForm({ ...addFeeForm, description: e.target.value })}
                  required
                  placeholder="e.g. Hostel medical expenses, uniform, broken item, exam fee"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="extra_fee_month">Target Month <span className="required">*</span></label>
                  <select
                    id="extra_fee_month"
                    name="extra_fee_month"
                    value={addFeeForm.fee_month}
                    onChange={(e) => setAddFeeForm({ ...addFeeForm, fee_month: e.target.value })}
                    required
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="extra_fee_year">Target Year <span className="required">*</span></label>
                  <input
                    type="number"
                    id="extra_fee_year"
                    name="extra_fee_year"
                    value={addFeeForm.fee_year}
                    onChange={(e) => setAddFeeForm({ ...addFeeForm, fee_year: e.target.value })}
                    min="2020"
                    max="2100"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="amount">Expense Amount (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={addFeeForm.amount}
                  onChange={(e) => setAddFeeForm({ ...addFeeForm, amount: e.target.value })}
                  min="1"
                  step="1"
                  required
                  placeholder="Enter expense amount"
                />
              </div>

              <div className="form-group">
                <label htmlFor="due_date">Expense Date (Date money was spent on student)</label>
                <input
                  type="date"
                  id="due_date"
                  name="due_date"
                  value={addFeeForm.due_date}
                  onChange={(e) => setAddFeeForm({ ...addFeeForm, due_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Additional Notes (Optional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={addFeeForm.notes}
                  onChange={(e) => setAddFeeForm({ ...addFeeForm, notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. Hostel laundry &amp; medical supplies"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddFeeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={16} /> Add Charge to Student Dues</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Extra Expense Modal */}
      {editingExtraFee && (
        <div className="modal-overlay" onClick={() => setEditingExtraFee(null)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Extra Expense Charge</h2>
              <button className="modal-close" onClick={() => setEditingExtraFee(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <form className="modal-body" onSubmit={handleSaveExtraFeeEdit}>
              <div className="form-group">
                <label htmlFor="edit_description">Custom Reason / Expense Title <span className="required">*</span></label>
                <input
                  type="text"
                  id="edit_description"
                  name="edit_description"
                  value={editExtraForm.description}
                  onChange={(e) => setEditExtraForm({ ...editExtraForm, description: e.target.value })}
                  required
                  placeholder="e.g. Hostel medical expenses, uniform, broken item, exam fee"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit_extra_fee_month">Target Month <span className="required">*</span></label>
                  <select
                    id="edit_extra_fee_month"
                    name="edit_extra_fee_month"
                    value={editExtraForm.fee_month}
                    onChange={(e) => setEditExtraForm({ ...editExtraForm, fee_month: e.target.value })}
                    required
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="edit_extra_fee_year">Target Year <span className="required">*</span></label>
                  <input
                    type="number"
                    id="edit_extra_fee_year"
                    name="edit_extra_fee_year"
                    value={editExtraForm.fee_year}
                    onChange={(e) => setEditExtraForm({ ...editExtraForm, fee_year: e.target.value })}
                    min="2020"
                    max="2100"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit_amount">Expense Amount (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  id="edit_amount"
                  name="edit_amount"
                  value={editExtraForm.amount}
                  onChange={(e) => setEditExtraForm({ ...editExtraForm, amount: e.target.value })}
                  min="1"
                  step="1"
                  required
                  placeholder="Enter expense amount"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_due_date">Expense Date (Date money was spent on student)</label>
                <input
                  type="date"
                  id="edit_due_date"
                  name="edit_due_date"
                  value={editExtraForm.due_date}
                  onChange={(e) => setEditExtraForm({ ...editExtraForm, due_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_notes">Additional Notes (Optional)</label>
                <textarea
                  id="edit_notes"
                  name="edit_notes"
                  value={editExtraForm.notes}
                  onChange={(e) => setEditExtraForm({ ...editExtraForm, notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. Hostel laundry &amp; medical supplies"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingExtraFee(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={16} /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordPaymentModal && (
        <RecordPaymentModal
          initialStudent={student}
          onClose={() => setShowRecordPaymentModal(false)}
          onSaved={() => {
            setShowRecordPaymentModal(false);
            fetchProfile();
          }}
        />
      )}

      {/* Edit Monthly Rate Modal */}
      {showEditRateModal && (
        <EditMonthlyRateModal
          student={student}
          onClose={() => setShowEditRateModal(false)}
          onSaved={() => {
            setShowEditRateModal(false);
            fetchProfile();
          }}
        />
      )}

      {/* Link / Concatenate Sibling Modal */}
      {showLinkSiblingModal && (
        <div className="modal-overlay" onClick={() => setShowLinkSiblingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Link Brother / Sister (Concatenate Profiles)</h2>
              <button className="modal-close" onClick={() => setShowLinkSiblingModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p className="modal-help-text">
                Search for another student by name, admission no, or phone to link them into the same Family Fee Account.
              </p>

              <div className="form-group">
                <label>Search Sibling Student</label>
                <div className="sibling-search-input-wrap">
                  <Search size={16} className="search-icon-inside" />
                  <input
                    type="text"
                    placeholder="Type name, admission no, or father name..."
                    value={siblingSearchQuery}
                    onChange={(e) => handleSearchSibling(e.target.value)}
                  />
                  {searchingSibling && <Loader2 size={16} className="spin search-spinner" />}
                </div>

                {siblingSearchResults.length > 0 && (
                  <div className="sibling-modal-results">
                    {siblingSearchResults.map((std) => (
                      <div
                        key={std.id}
                        className={`sibling-modal-item ${selectedSiblingToLink?.id === std.id ? 'selected' : ''}`}
                        onClick={() => setSelectedSiblingToLink(std)}
                      >
                        <div>
                          <strong>{std.full_name}</strong>
                          <span className="d-block text-muted">Adm: {std.admission_no} • {std.class_name} • Father: {std.father_name || std.parent_name || '—'}</span>
                        </div>
                        {selectedSiblingToLink?.id === std.id && (
                          <span className="selected-tag">Selected</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedSiblingToLink && (
                <div className="selected-sibling-box">
                  <LinkIcon size={16} className="text-primary" />
                  <span>Ready to link <strong>{selectedSiblingToLink.full_name}</strong> into <strong>{student.full_name}</strong>'s Family Account</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowLinkSiblingModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleLinkSibling} disabled={!selectedSiblingToLink}>
                <LinkIcon size={16} /> Link &amp; Concatenate Profiles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Family Payment Modal */}
      {showFamilyPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowFamilyPaymentModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Combined Family Fee Payment</h2>
              <button className="modal-close" onClick={() => setShowFamilyPaymentModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleFamilyPaymentSubmit}>
              <div className="modal-body">
                <p className="modal-help-text">
                  Allocate fee payment amounts across linked brothers &amp; sisters in this family. A unified family receipt will be issued.
                </p>

                <div className="family-payment-allocations-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Sibling</th>
                        <th>Class</th>
                        <th>Outstanding Due</th>
                        <th>Amount to Pay (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {familyData?.siblings?.map((s) => (
                        <tr key={s.id}>
                          <td><strong>{s.full_name}</strong></td>
                          <td>{s.class_name}</td>
                          <td><span className="text-danger font-bold">{formatCurrency(s.total_due)}</span></td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={s.total_due > 0 ? s.total_due : undefined}
                              value={familyPaymentForm.allocations[s.id] ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setFamilyPaymentForm(prev => ({
                                  ...prev,
                                  allocations: { ...prev.allocations, [s.id]: val },
                                }));
                              }}
                              className="form-control-sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="form-row" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>Payment Channel</label>
                    <select
                      value={familyPaymentForm.payment_mode}
                      onChange={(e) => setFamilyPaymentForm(prev => ({ ...prev, payment_mode: e.target.value }))}
                    >
                      <option value="CASH">Cash Desk</option>
                      <option value="IN_ACCOUNT">In-Account (Bank / UPI)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Payment Date</label>
                    <input
                      type="date"
                      value={familyPaymentForm.payment_date}
                      onChange={(e) => setFamilyPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Remarks / Notes</label>
                  <input
                    type="text"
                    value={familyPaymentForm.notes}
                    onChange={(e) => setFamilyPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="e.g. Combined payment for all 3 siblings"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFamilyPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingFamilyPayment}>
                  {submittingFamilyPayment ? <Loader2 size={16} className="spin" /> : <CreditCard size={16} />}
                  <span>Record &amp; Issue Family Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordPaymentModal && (
        <RecordPaymentModal
          initialStudent={student}
          onClose={() => setShowRecordPaymentModal(false)}
          onSaved={() => {
            setShowRecordPaymentModal(false);
            fetchProfile();
          }}
        />
      )}

      {/* Delete Student Modal */}
      {showDeleteModal && (
        <DeleteStudentModal
          student={student}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            navigate('/students');
          }}
        />
      )}

      {/* Monthly Fee Ledger & Account Statement Modal (High-Res JPG + WhatsApp Share) */}
      <StudentFeeLedgerModal
        isOpen={showLedgerModal}
        onClose={() => setShowLedgerModal(false)}
        student={student}
        monthlyLedger={monthlyFees}
        paymentHistory={recentPayments}
        totals={{
          total_assessed: (monthlyFees || []).reduce((sum, f) => sum + Number(f.fee_amount || 0), 0) + (additionalFees || []).reduce((sum, f) => sum + Number(f.amount || 0), 0),
          total_paid: (monthlyFees || []).reduce((sum, f) => sum + Number(f.paid_amount || 0), 0) + (additionalFees || []).reduce((sum, f) => sum + Number(f.paid_amount || 0), 0),
          total_due: totalOverallDue,
        }}
      />

      {/* Single Payment Receipt Modal */}
      <JpgReceiptModal
        isOpen={showReceiptModal && !!selectedReceiptData}
        onClose={() => {
          setShowReceiptModal(false);
          setSelectedReceiptData(null);
        }}
        data={selectedReceiptData}
        type="payment"
      />
    </div>
  );
}