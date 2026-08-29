/**
 * Admissions Page — School Management System (Frontend)
 *
 * Distinct "Single Student Admission" vs "Family / Sibling Bulk Admission" modes.
 * Form layout: Student(s) Details ON TOP -> Parent & Contact Details BELOW -> Billing & Receipt Dispatch.
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
  MessageSquare,
  MapPin,
  Receipt,
  UserCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import WhatsAppDirectButton from '../components/WhatsAppDirectButton';
import JpgReceiptModal from '../components/JpgReceiptModal';
import RecordPaymentModal from '../components/RecordPaymentModal';
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

  // Admission Mode: 'single' (1 student) or 'family' (multiple siblings)
  const [admissionMode, setAdmissionMode] = useState('single');

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

  const createChildTemplate = (classId = '') => ({
    id: Date.now() + Math.floor(Math.random() * 10000),
    full_name: '',
    admission_no: '',
    auto_generate_adm: true,
    gender: 'male',
    class_id: classId,
    section_id: '',
    category: 'day_scholar',
    monthly_fee_rate: '',
    has_admission_fee: false,
    admission_fee_amount: '',
    has_security_deposit: false,
    security_deposit_amount: '',
    include_advance_month: false,
    advance_fee_month: currentMonth,
    advance_fee_year: currentYear,
    advance_fee_amount: '',
    has_opening_dues: false,
    opening_dues_amount: '',
    custom_expenses: [],
  });

  // Shared Parent & Payment State
  const initialParentState = {
    father_name: '',
    mother_name: '',
    phone: '',
    whatsapp_number: '',
    address: '',
    admission_date: now.toISOString().slice(0, 10),

    // Sibling Linking to existing student
    is_sibling: false,
    sibling_search: '',
    selected_sibling: null,

    // Payment Collection
    collect_payment: true,
    paid_amount: '',
    payment_mode: 'CASH',
    payment_notes: 'Initial admission fee and advance tuition payment',
  };

  const [parentData, setParentData] = useState(initialParentState);
  const [children, setChildren] = useState([createChildTemplate()]);
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Success and Receipt Modals
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(null);
  const [showJpgReceiptModal, setShowJpgReceiptModal] = useState(false);
  const [tableJpgData, setTableJpgData] = useState(null);
  const [showTableJpgModal, setShowTableJpgModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState(null);
  const [selectedRegisterReceipt, setSelectedRegisterReceipt] = useState(null);
  const [loadingRegisterReceiptId, setLoadingRegisterReceiptId] = useState(null);

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
        setChildren((prev) => {
          if (prev.length > 0 && !prev[0].class_id && clsList.length > 0) {
            return prev.map((c, idx) => (idx === 0 ? { ...c, class_id: String(clsList[0].id) } : c));
          }
          return prev;
        });
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

  // Calculate subtotal for a single child
  const getChildSubtotal = (child) => {
    let sub = 0;
    if (child.has_admission_fee && child.admission_fee_amount !== '') {
      sub += Number(child.admission_fee_amount || 0);
    }
    if (child.has_security_deposit && child.security_deposit_amount !== '') {
      sub += Number(child.security_deposit_amount || 0);
    }
    if (child.include_advance_month && child.advance_fee_amount !== '') {
      sub += Number(child.advance_fee_amount || 0);
    }
    if (child.has_opening_dues && child.opening_dues_amount !== '') {
      sub += Number(child.opening_dues_amount || 0);
    }
    (child.custom_expenses || []).forEach((item) => {
      if (item.amount !== '') {
        sub += Number(item.amount || 0);
      }
    });
    return sub;
  };

  // Recalculate consolidated total family payable
  const totalFamilyAssessed = children.reduce((sum, c) => sum + getChildSubtotal(c), 0);

  useEffect(() => {
    setParentData((prev) => ({
      ...prev,
      paid_amount: totalFamilyAssessed > 0 ? totalFamilyAssessed : '',
    }));
  }, [totalFamilyAssessed]);

  // Child management handlers
  const handleAddChild = () => {
    const defaultCls = classes.length > 0 ? String(classes[0].id) : '';
    setChildren((prev) => [...prev, createChildTemplate(defaultCls)]);
  };

  const handleRemoveChild = (id) => {
    if (children.length <= 1) {
      toast.warning('At least one child record is required for admission.');
      return;
    }
    setChildren((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateChild = (id, field, value) => {
    setChildren((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: value };

        // Auto-fill monthly rate suggestion based on class or category if empty
        if (field === 'class_id' || field === 'category') {
          const selectedCls = classes.find((cl) => cl.id === Number(updated.class_id));
          if (!updated.monthly_fee_rate || updated.monthly_fee_rate === '') {
            const baseRate = selectedCls
              ? updated.category === 'hosteller'
                ? selectedCls.hostel_fee || 5000
                : selectedCls.base_tuition_fee || 3000
              : updated.category === 'hosteller' ? 5000 : 3000;
            updated.monthly_fee_rate = baseRate;
            if (updated.include_advance_month && (!updated.advance_fee_amount || updated.advance_fee_amount === '')) {
              updated.advance_fee_amount = baseRate;
            }
          }
        }

        // When advance month is toggled on, auto prefill amount
        if (field === 'include_advance_month' && value === true) {
          if (!updated.advance_fee_amount || updated.advance_fee_amount === '') {
            updated.advance_fee_amount = updated.monthly_fee_rate || 3000;
          }
        }

        return updated;
      })
    );
  };

  // Custom Expenses handlers
  const handleAddCustomExpense = (childId) => {
    setChildren((prev) =>
      prev.map((c) => {
        if (c.id !== childId) return c;
        return {
          ...c,
          custom_expenses: [
            ...c.custom_expenses,
            { id: Date.now() + Math.random(), description: '', amount: '' },
          ],
        };
      })
    );
  };

  const handleRemoveCustomExpense = (childId, expenseId) => {
    setChildren((prev) =>
      prev.map((c) => {
        if (c.id !== childId) return c;
        return {
          ...c,
          custom_expenses: c.custom_expenses.filter((e) => e.id !== expenseId),
        };
      })
    );
  };

  const handleUpdateCustomExpense = (childId, expenseId, field, val) => {
    setChildren((prev) =>
      prev.map((c) => {
        if (c.id !== childId) return c;
        return {
          ...c,
          custom_expenses: c.custom_expenses.map((e) =>
            e.id === expenseId ? { ...e, [field]: val } : e
          ),
        };
      })
    );
  };

  // Sibling Live Search
  const handleSearchSibling = async (val) => {
    setParentData((prev) => ({ ...prev, sibling_search: val }));
    if (!val || val.trim().length < 2) {
      setSiblingSearchResults([]);
      return;
    }
    try {
      setSearchingSibling(true);
      const res = await api.get(`/family/search?q=${encodeURIComponent(val.trim())}`);
      if (res.data.success) {
        setSiblingSearchResults(res.data.students || []);
      }
    } catch (err) {
      console.error('[handleSearchSibling]', err);
    } finally {
      setSearchingSibling(false);
    }
  };

  const selectSibling = (std) => {
    setParentData((prev) => ({
      ...prev,
      selected_sibling: std,
      father_name: std.father_name || std.parent_name || prev.father_name,
      mother_name: std.mother_name || prev.mother_name,
      phone: std.phone || prev.phone,
      whatsapp_number: std.phone || prev.whatsapp_number,
      address: std.address || prev.address,
      sibling_search: '',
    }));
    setSiblingSearchResults([]);
  };

  const removeSibling = () => {
    setParentData((prev) => ({
      ...prev,
      selected_sibling: null,
      sibling_search: '',
    }));
  };

  // Submit Admission
  const handleSubmitAdmission = async (e) => {
    e.preventDefault();

    // Validation
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (!c.full_name.trim()) {
        toast.error(`Please provide student full name for Child #${i + 1}.`);
        return;
      }
      if (!c.class_id) {
        toast.error(`Please select class for ${c.full_name || `Child #${i + 1}`}.`);
        return;
      }
    }

    if (!parentData.father_name.trim() && !parentData.mother_name.trim()) {
      toast.error("Please provide at least Father's or Mother's name.");
      return;
    }

    if (!parentData.phone.trim()) {
      toast.error('Please provide a valid primary phone number.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        parent: {
          father_name: parentData.father_name.trim(),
          mother_name: parentData.mother_name.trim(),
          phone: parentData.phone.trim(),
          whatsapp_number: whatsappSameAsPhone
            ? parentData.phone.trim()
            : (parentData.whatsapp_number || parentData.phone).trim(),
          address: parentData.address.trim(),
          admission_date: parentData.admission_date,
          linked_family_id: parentData.selected_sibling?.family_id || null,
        },
        children: children.map((c) => ({
          full_name: c.full_name.trim(),
          admission_no: c.auto_generate_adm ? undefined : c.admission_no.trim(),
          gender: c.gender,
          class_id: Number(c.class_id),
          section_id: c.section_id ? Number(c.section_id) : undefined,
          category: c.category,
          monthly_fee_rate: c.monthly_fee_rate ? Number(c.monthly_fee_rate) : undefined,
          opening_dues: c.has_opening_dues ? Number(c.opening_dues_amount || 0) : 0,
          opening_dues_amount: c.has_opening_dues ? Number(c.opening_dues_amount || 0) : 0,
          has_admission_fee: c.has_admission_fee,
          admission_fee_amount: c.has_admission_fee ? Number(c.admission_fee_amount || 0) : 0,
          has_security_deposit: c.has_security_deposit,
          security_deposit_amount: c.has_security_deposit ? Number(c.security_deposit_amount || 0) : 0,
          include_advance_month: c.include_advance_month,
          advance_fee_month: c.include_advance_month ? Number(c.advance_fee_month) : undefined,
          advance_fee_year: c.include_advance_month ? Number(c.advance_fee_year) : undefined,
          advance_fee_amount: c.include_advance_month ? Number(c.advance_fee_amount || 0) : 0,
          custom_expenses: (c.custom_expenses || [])
            .filter((e) => e.description.trim() && Number(e.amount) > 0)
            .map((e) => ({
              description: e.description.trim(),
              amount: Number(e.amount),
            })),
        })),
        payment: {
          collect_payment: parentData.collect_payment,
          paid_amount: parentData.collect_payment ? Number(parentData.paid_amount || 0) : 0,
          payment_mode: parentData.payment_mode,
          notes: parentData.payment_notes,
        },
      };

      const res = await api.post('/admissions/enroll-family', payload);

      if (res.data.success) {
        toast.success(res.data.message || 'Admission completed successfully!');
        setEnrollmentSuccess(res.data);
        fetchData();
      }
    } catch (err) {
      console.error('[handleSubmitAdmission]', err);
      toast.error(err.response?.data?.message || 'Failed to complete admission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    const defaultCls = classes.length > 0 ? String(classes[0].id) : '';
    setParentData(initialParentState);
    setChildren([createChildTemplate(defaultCls)]);
    setEnrollmentSuccess(null);
  };

  const getAdmissionAllocations = () => {
    const allocs = [];
    children.forEach((c) => {
      if (c.has_admission_fee && Number(c.admission_fee_amount) > 0) {
        allocs.push({
          description: `One-Time Admission Fee (${c.full_name || 'Student'})`,
          fee_amount: Number(c.admission_fee_amount),
          allocated_amount: Number(c.admission_fee_amount),
        });
      }
      if (c.has_security_deposit && Number(c.security_deposit_amount) > 0) {
        allocs.push({
          description: `Security Deposit / Caution Money (${c.full_name || 'Student'})`,
          fee_amount: Number(c.security_deposit_amount),
          allocated_amount: Number(c.security_deposit_amount),
        });
      }
      (c.custom_expenses || []).forEach((exp) => {
        if (exp.description && Number(exp.amount) > 0) {
          allocs.push({
            description: `${exp.description} (${c.full_name || 'Student'})`,
            fee_amount: Number(exp.amount),
            allocated_amount: Number(exp.amount),
          });
        }
      });
      if (c.include_advance_month && Number(c.advance_fee_amount) > 0) {
        const mName = MONTH_OPTIONS.find((m) => m.value === Number(c.advance_fee_month))?.label || 'Advance';
        allocs.push({
          description: `${mName} ${c.advance_fee_year} Advance Tuition (${c.full_name || 'Student'})`,
          fee_amount: Number(c.advance_fee_amount),
          allocated_amount: Number(c.advance_fee_amount),
        });
      }
      if (c.has_opening_dues && Number(c.opening_dues_amount) > 0) {
        allocs.push({
          description: `Previous / Opening Dues (${c.full_name || 'Student'})`,
          fee_amount: Number(c.opening_dues_amount),
          allocated_amount: Number(c.opening_dues_amount),
        });
      }
    });
    return allocs;
  };

  const handleViewRegisterReceipt = async (std) => {
    try {
      setLoadingRegisterReceiptId(std.id);
      const res = await api.get(`/receipts?student_id=${std.id}&limit=1`);
      if (res.data.success && res.data.receipts && res.data.receipts.length > 0) {
        const rcptItem = res.data.receipts[0];
        const detailRes = await api.get(`/receipts/${rcptItem.payment_id || rcptItem.id}`);
        if (detailRes.data && detailRes.data.success) {
          setSelectedRegisterReceipt(detailRes.data);
          return;
        }
      }

      // If no payment record yet, generate admission receipt preview
      setSelectedRegisterReceipt({
        student: {
          id: std.id,
          full_name: std.full_name,
          admission_no: std.admission_no,
          father_name: std.father_name || std.parent_name || '—',
          parent_name: std.parent_name || std.father_name || '—',
          class_name: std.class_name,
          section_name: std.section_name,
          phone: std.phone,
        },
        payment: {
          amount: 0,
          payment_date: std.admission_date || new Date().toISOString(),
          payment_mode: 'CASH',
          notes: 'Official Admission Enrollment Record',
        },
        allocations: [],
        summary: { total_amount: 0 },
      });
    } catch (err) {
      console.error('[handleViewRegisterReceipt]', err);
      toast.error('Failed to load admission receipt');
    } finally {
      setLoadingRegisterReceiptId(null);
    }
  };

  const handleOpenRegisterPay = (std) => {
    setSelectedStudentForPayment({
      id: std.id,
      full_name: std.full_name,
      admission_no: std.admission_no,
      class_name: std.class_name,
      category: std.category || 'day_scholar',
      phone: std.phone,
      whatsapp_number: std.whatsapp_number || std.phone,
    });
    setShowRecordPaymentModal(true);
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
      {/* Top Header Card */}
      <div className="admissions-header-card">
        <div className="header-left-wrap">
          <div className="admissions-icon-badge">
            <UserPlus size={24} />
          </div>
          <div>
            <h1 className="admissions-heading">Admissions Desk &amp; Sibling Enrollment</h1>
            <p className="admissions-subheading">
              Simultaneous single or multi-sibling admissions, itemized billing, 1-month advance fee, and instant receipts.
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
            <span>Admission Desk</span>
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

      {/* View 1: Admission Desk Form */}
      {activeTab === 'desk' && (
        <>
          {enrollmentSuccess ? (
            <div className="admission-success-card">
              <div className="success-icon-badge">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="success-title">Admission Completed Successfully!</h2>
              <p className="success-subtitle">
                Enrolled <strong>{enrollmentSuccess.students.length} Student{enrollmentSuccess.students.length > 1 ? 's' : ''}</strong> under Family Account <code>{enrollmentSuccess.family_id}</code>.
              </p>

              {/* Sibling Enrolled Badges Grid */}
              <div className="sibling-success-grid">
                {enrollmentSuccess.students.map((std, idx) => (
                  <div key={idx} className="sibling-success-item">
                    <div className="std-avatar-box">
                      <GraduationCap size={20} />
                    </div>
                    <div className="std-info-box">
                      <h4 className="std-name">{std.full_name}</h4>
                      <p className="std-meta">
                        Admission No: <code>{std.admission_no}</code> • Class:{' '}
                        <strong>{classes.find((c) => c.id === Number(std.class_id))?.name || 'Class'}</strong>
                      </p>
                      <span className="std-due-tag">Assessed Fee: {formatCurrency(std.initial_due)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown & Receipt Preview */}
              <div className="receipt-success-preview">
                <div className="rcpt-preview-header">
                  <span>Total Assessed: <strong>{formatCurrency(enrollmentSuccess.total_assessed || 0)}</strong></span>
                  <span>Amount Collected: <strong style={{ color: '#16a34a' }}>{formatCurrency(enrollmentSuccess.total_paid || 0)}</strong></span>
                  <span>Remaining Dues: <strong style={{ color: (enrollmentSuccess.total_due || 0) > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(enrollmentSuccess.total_due || 0)}</strong></span>
                </div>
                {enrollmentSuccess.payments?.[0]?.receipt_number && (
                  <p className="rcpt-notes">
                    Official Receipt No: <strong>{enrollmentSuccess.payments[0].receipt_number}</strong> • Initial advance tuition and admission charges allocated via FIFO.
                  </p>
                )}
              </div>

              <div className="success-actions-row">
                {/* Action 1: Collect Payment if unpaid or partial */}
                {((enrollmentSuccess.total_due || 0) > 0 || enrollmentSuccess.total_paid === 0) && (
                  <button
                    type="button"
                    className="btn-success-profile"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: '#fff' }}
                    onClick={() => {
                      const firstStd = enrollmentSuccess.students?.[0];
                      setSelectedStudentForPayment({
                        id: firstStd?.student_id || firstStd?.id,
                        full_name: firstStd?.full_name,
                        admission_no: firstStd?.admission_no,
                        class_name: classes.find((c) => c.id === Number(firstStd?.class_id))?.name || 'Class',
                        category: firstStd?.category || 'day_scholar',
                        phone: parentData.phone,
                        whatsapp_number: parentData.whatsapp_number,
                      });
                      setShowRecordPaymentModal(true);
                    }}
                  >
                    <CreditCard size={17} />
                    <span>💳 Collect / Record Payment</span>
                  </button>
                )}

                {/* Action 2: View & Print Official JPG Receipt */}
                <button
                  type="button"
                  className="btn-success-profile"
                  style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', color: '#fff' }}
                  onClick={() => setShowJpgReceiptModal(true)}
                >
                  <Receipt size={17} />
                  <span>🖨️ Print / View JPG Receipt</span>
                </button>

                {/* Action 3: Send via WhatsApp */}
                {enrollmentSuccess.students.length > 0 && (
                  <WhatsAppDirectButton
                    onSend={() => api.post(`/admissions/send-whatsapp/${enrollmentSuccess.students[0].student_id}`)}
                    onOpenJpg={() => setShowJpgReceiptModal(true)}
                    phone={parentData.whatsapp_number || parentData.phone}
                    defaultLabel="Send WhatsApp Receipt"
                    successLabel="✓ WhatsApp Sent to Parent"
                    size="md"
                    itemTitle="Admission Receipt"
                  />
                )}

                {/* Action 4: Download PDF Receipt */}
                {enrollmentSuccess.payments?.[0]?.id && (
                  <button
                    type="button"
                    className="btn-success-profile"
                    style={{ background: '#334155', color: '#fff' }}
                    onClick={() => {
                      const pId = enrollmentSuccess.payments[0].id;
                      window.open(`/api/receipts/download/${pId}`, '_blank');
                    }}
                  >
                    <Download size={17} />
                    <span>Download PDF</span>
                  </button>
                )}

                {/* Action 5: Admit Another */}
                <button
                  type="button"
                  className="btn-success-new"
                  onClick={handleResetForm}
                >
                  <Plus size={17} />
                  <span>Admit Another Student / Family</span>
                </button>
              </div>
            </div>
          ) : (
            <form className="admission-form" onSubmit={handleSubmitAdmission}>
              {/* TOP SELECTOR: Single Student Admission vs Family / Sibling Admission */}
              <div className="admission-mode-selector-container">
                <div className="mode-selector-pill-wrap">
                  <button
                    type="button"
                    className={`mode-selector-pill ${admissionMode === 'single' ? 'active' : ''}`}
                    onClick={() => {
                      setAdmissionMode('single');
                      if (children.length > 1) {
                        setChildren([children[0]]);
                      }
                    }}
                  >
                    <div className="mode-pill-icon">
                      <User size={18} />
                    </div>
                    <div className="mode-pill-text">
                      <strong className="mode-title">Single Student Admission</strong>
                      <span className="mode-desc">Individual student enrollment</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`mode-selector-pill ${admissionMode === 'family' ? 'active' : ''}`}
                    onClick={() => {
                      setAdmissionMode('family');
                      if (children.length < 2) {
                        const defaultCls = classes.length > 0 ? String(classes[0].id) : '';
                        setChildren((prev) => [...prev, createChildTemplate(defaultCls)]);
                      }
                    }}
                  >
                    <div className="mode-pill-icon">
                      <Users size={18} />
                    </div>
                    <div className="mode-pill-text">
                      <strong className="mode-title">Family / Sibling Admission</strong>
                      <span className="mode-desc">Multi-child sibling enrollment ({children.length} Students)</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* SECTION 1 (ON TOP): STUDENT(S) DETAILS */}
              <div className="admission-section-card">
                <div className="section-card-header">
                  <div className="header-icon-box purple">
                    <GraduationCap size={20} />
                  </div>
                  <div className="header-title-split">
                    <div>
                      <div className="step-tag-row">
                        <span className="step-pill purple">STEP 1</span>
                        <h3 className="section-title">
                          {admissionMode === 'single'
                            ? 'Student Academic & Fee Details'
                            : `Sibling Children Enrollment Cards (${children.length} Students)`}
                        </h3>
                      </div>
                      <p className="section-subtitle">
                        {admissionMode === 'single'
                          ? 'Student identity, class assignment, monthly rate, and itemized admission charges.'
                          : 'Configure separate classes, categories, and itemized fees for each sibling.'}
                      </p>
                    </div>

                    {admissionMode === 'family' && (
                      <button
                        type="button"
                        className="btn-add-child-card"
                        onClick={handleAddChild}
                      >
                        <Plus size={15} />
                        <span>Add Another Sibling Child</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Children List */}
                <div className="children-cards-list">
                  {children.map((child, index) => {
                    const subtotal = getChildSubtotal(child);

                    return (
                      <div key={child.id} className="child-form-card">
                        <div className="child-card-header">
                          <div className="child-title-wrap">
                            <div className="child-num-badge">{index + 1}</div>
                            <h4>
                              {child.full_name ? child.full_name : `Student #${index + 1}`}
                            </h4>
                            {child.category && (
                              <span className={`child-cat-chip ${child.category}`}>
                                {child.category === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
                              </span>
                            )}
                          </div>

                          <div className="child-header-right">
                            <span className="child-subtotal-tag">
                              Initial Fees: <strong>{formatCurrency(subtotal)}</strong>
                            </span>
                            {admissionMode === 'family' && children.length > 1 && (
                              <button
                                type="button"
                                className="btn-remove-child"
                                onClick={() => handleRemoveChild(child.id)}
                                title="Remove this child"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Basic Info Grid */}
                        <div className="form-grid-3">
                          <div className="form-field">
                            <label>Student Full Name *</label>
                            <input
                              type="text"
                              placeholder="e.g. Rahul Sharma"
                              value={child.full_name}
                              onChange={(e) => handleUpdateChild(child.id, 'full_name', e.target.value)}
                              required
                            />
                          </div>

                          <div className="form-field">
                            <label>Admission Number</label>
                            <div className="input-with-checkbox">
                              <input
                                type="text"
                                placeholder="Auto-generated"
                                value={child.admission_no}
                                disabled={child.auto_generate_adm}
                                onChange={(e) => handleUpdateChild(child.id, 'admission_no', e.target.value)}
                              />
                              <label className="inline-check">
                                <input
                                  type="checkbox"
                                  checked={child.auto_generate_adm}
                                  onChange={(e) => handleUpdateChild(child.id, 'auto_generate_adm', e.target.checked)}
                                />
                                <span>Auto</span>
                              </label>
                            </div>
                          </div>

                          <div className="form-field">
                            <label>Gender</label>
                            <select
                              value={child.gender}
                              onChange={(e) => handleUpdateChild(child.id, 'gender', e.target.value)}
                            >
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-grid-3">
                          <div className="form-field">
                            <label>Class Assignment *</label>
                            <select
                              value={child.class_id}
                              onChange={(e) => handleUpdateChild(child.id, 'class_id', e.target.value)}
                              required
                            >
                              <option value="">Select Class</option>
                              {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="form-field">
                            <label>Section (Optional)</label>
                            <select
                              value={child.section_id}
                              onChange={(e) => handleUpdateChild(child.id, 'section_id', e.target.value)}
                            >
                              <option value="">Select Section</option>
                              {sections
                                .filter((s) => !child.class_id || s.class_id === Number(child.class_id))
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="form-field">
                            <label>Student Category</label>
                            <select
                              value={child.category}
                              onChange={(e) => handleUpdateChild(child.id, 'category', e.target.value)}
                            >
                              <option value="day_scholar">Day Scholar</option>
                              <option value="hosteller">Hosteller</option>
                            </select>
                          </div>
                        </div>

                        {/* Custom Monthly Fee Rate */}
                        <div className="fee-config-box">
                          <div className="fee-config-header">
                            <span className="fee-config-title">
                              <IndianRupee size={15} /> Monthly Tuition Fee Rate (Ongoing Monthly Rate)
                            </span>
                          </div>
                          <div className="form-grid-2">
                            <div className="form-field">
                              <label>Per-Month Fee Rate (₹) *</label>
                              <input
                                type="number"
                                placeholder="e.g. 3000"
                                value={child.monthly_fee_rate}
                                onChange={(e) => handleUpdateChild(child.id, 'monthly_fee_rate', e.target.value)}
                                required
                              />
                            </div>
                            <div className="field-hint-box">
                              <p>
                                Ongoing monthly fee assessed each month in the fee ledger for this student.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Itemized Initial Admission Charges */}
                        <div className="itemized-charges-box">
                          <span className="itemized-charges-title">
                            <ShieldCheck size={16} /> Initial Assessment &amp; Admission Charges (One-Time / Advance)
                          </span>

                          <div className="charges-items-grid">
                            {/* 1. Admission Fee */}
                            <div className={`charge-item-card ${child.has_admission_fee ? 'checked' : ''}`}>
                              <div className="charge-item-top">
                                <label className="custom-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={child.has_admission_fee}
                                    onChange={(e) => handleUpdateChild(child.id, 'has_admission_fee', e.target.checked)}
                                  />
                                  <span className="checkbox-text">One-Time Admission Fee</span>
                                </label>
                              </div>
                              {child.has_admission_fee && (
                                <div className="charge-input-wrap">
                                  <span className="currency-prefix">₹</span>
                                  <input
                                    type="number"
                                    placeholder="e.g. 5000"
                                    value={child.admission_fee_amount}
                                    onChange={(e) => handleUpdateChild(child.id, 'admission_fee_amount', e.target.value)}
                                  />
                                </div>
                              )}
                            </div>

                            {/* 2. Security Deposit / Caution Money */}
                            <div className={`charge-item-card ${child.has_security_deposit ? 'checked' : ''}`}>
                              <div className="charge-item-top">
                                <label className="custom-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={child.has_security_deposit}
                                    onChange={(e) => handleUpdateChild(child.id, 'has_security_deposit', e.target.checked)}
                                  />
                                  <span className="checkbox-text">Security Deposit / Caution Money</span>
                                </label>
                              </div>
                              {child.has_security_deposit && (
                                <div className="charge-input-wrap">
                                  <span className="currency-prefix">₹</span>
                                  <input
                                    type="number"
                                    placeholder="e.g. 2000"
                                    value={child.security_deposit_amount}
                                    onChange={(e) => handleUpdateChild(child.id, 'security_deposit_amount', e.target.value)}
                                  />
                                </div>
                              )}
                            </div>

                            {/* 3. 1-Month Advance Fee */}
                            <div className={`charge-item-card ${child.include_advance_month ? 'checked' : ''}`}>
                              <div className="charge-item-top">
                                <label className="custom-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={child.include_advance_month}
                                    onChange={(e) => handleUpdateChild(child.id, 'include_advance_month', e.target.checked)}
                                  />
                                  <span className="checkbox-text">1-Month Advance Tuition Fee</span>
                                </label>
                              </div>
                              {child.include_advance_month && (
                                <div className="advance-fee-inputs">
                                  <div className="month-year-selects">
                                    <select
                                      value={child.advance_fee_month}
                                      onChange={(e) => handleUpdateChild(child.id, 'advance_fee_month', Number(e.target.value))}
                                    >
                                      {MONTH_OPTIONS.map((m) => (
                                        <option key={m.value} value={m.value}>
                                          {m.label}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      value={child.advance_fee_year}
                                      onChange={(e) => handleUpdateChild(child.id, 'advance_fee_year', Number(e.target.value))}
                                      className="year-input"
                                    />
                                  </div>
                                  <div className="charge-input-wrap">
                                    <span className="currency-prefix">₹</span>
                                    <input
                                      type="number"
                                      placeholder="Amount"
                                      value={child.advance_fee_amount}
                                      onChange={(e) => handleUpdateChild(child.id, 'advance_fee_amount', e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 4. Previous Session Dues / Initial Opening Balance */}
                            <div className={`charge-item-card ${child.has_opening_dues ? 'checked' : ''}`}>
                              <div className="charge-item-top">
                                <label className="custom-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={child.has_opening_dues}
                                    onChange={(e) => handleUpdateChild(child.id, 'has_opening_dues', e.target.checked)}
                                  />
                                  <span className="checkbox-text">Previous Dues / Starting Opening Balance</span>
                                </label>
                              </div>
                              {child.has_opening_dues && (
                                <div className="charge-input-wrap">
                                  <span className="currency-prefix">₹</span>
                                  <input
                                    type="number"
                                    placeholder="e.g. 2500"
                                    value={child.opening_dues_amount}
                                    onChange={(e) => handleUpdateChild(child.id, 'opening_dues_amount', e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Custom Expenses */}
                          <div className="custom-expenses-section">
                            <div className="custom-expenses-header">
                              <span>Custom Additional Charges (ID Card, Books, Uniform, etc.)</span>
                              <button
                                type="button"
                                className="btn-add-custom-charge"
                                onClick={() => handleAddCustomExpense(child.id)}
                              >
                                <Plus size={13} /> Add Charge
                              </button>
                            </div>

                            {child.custom_expenses.map((expense) => (
                              <div key={expense.id} className="custom-expense-row">
                                <input
                                  type="text"
                                  placeholder="Expense Title (e.g. ID Card & Books)"
                                  value={expense.description}
                                  onChange={(e) => handleUpdateCustomExpense(child.id, expense.id, 'description', e.target.value)}
                                />
                                <div className="charge-input-wrap small">
                                  <span className="currency-prefix">₹</span>
                                  <input
                                    type="number"
                                    placeholder="Amount"
                                    value={expense.amount}
                                    onChange={(e) => handleUpdateCustomExpense(child.id, expense.id, 'amount', e.target.value)}
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn-remove-expense"
                                  onClick={() => handleRemoveCustomExpense(child.id, expense.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2 (BELOW): PARENT & FAMILY CONTACT DETAILS */}
              <div className="admission-section-card">
                <div className="section-card-header">
                  <div className="header-icon-box blue">
                    <Users size={20} />
                  </div>
                  <div>
                    <div className="step-tag-row">
                      <span className="step-pill blue">STEP 2</span>
                      <h3 className="section-title">Parent &amp; Family Contact Details (Shared)</h3>
                    </div>
                    <p className="section-subtitle">
                      Parent contact and residential info is entered once and inherited by the student(s).
                    </p>
                  </div>
                </div>

                {/* Sibling Linker Box for linking with existing student */}
                <div className="sibling-link-box">
                  <div className="sibling-toggle-row">
                    <label className="custom-checkbox">
                      <input
                        type="checkbox"
                        checked={parentData.is_sibling}
                        onChange={(e) =>
                          setParentData((prev) => ({
                            ...prev,
                            is_sibling: e.target.checked,
                            selected_sibling: e.target.checked ? prev.selected_sibling : null,
                          }))
                        }
                      />
                      <span className="checkbox-text">
                        <strong>Is this student a sibling of an already enrolled student?</strong> (Link to Existing Family Account)
                      </span>
                    </label>
                  </div>

                  {parentData.is_sibling && (
                    <div className="sibling-search-panel">
                      {parentData.selected_sibling ? (
                        <div className="linked-sibling-badge">
                          <div className="badge-info">
                            <span className="badge-title">✓ Linked to Sibling Family Account:</span>
                            <strong>
                              {parentData.selected_sibling.full_name} ({parentData.selected_sibling.admission_no}) — Class{' '}
                              {parentData.selected_sibling.class_name}
                            </strong>
                            <span className="family-id-chip">
                              Family ID: {parentData.selected_sibling.family_id || 'Shared Account'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn-unlink-sibling"
                            onClick={removeSibling}
                            title="Unlink and create new family"
                          >
                            <RotateCcw size={14} /> Unlink
                          </button>
                        </div>
                      ) : (
                        <div className="sibling-live-search-box">
                          <div className="search-input-wrapper">
                            <Search size={16} className="search-icon" />
                            <input
                              type="text"
                              placeholder="Type existing student's name, admission no, or parent's phone..."
                              value={parentData.sibling_search}
                              onChange={(e) => handleSearchSibling(e.target.value)}
                            />
                            {searchingSibling && <Loader2 size={16} className="search-spinner spin" />}
                          </div>

                          {siblingSearchResults.length > 0 && (
                            <div className="sibling-results-dropdown">
                              {siblingSearchResults.map((std) => (
                                <div
                                  key={std.id}
                                  className="sibling-result-row"
                                  onClick={() => selectSibling(std)}
                                >
                                  <div className="result-main">
                                    <strong>{std.full_name}</strong>
                                    <span className="result-adm">({std.admission_no})</span>
                                    <span className="result-class">Class: {std.class_name}</span>
                                  </div>
                                  <div className="result-parent">
                                    <span>Father: {std.father_name || std.parent_name || '—'}</span>
                                    <span>Phone: {std.phone || '—'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Father's Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={parentData.father_name}
                      onChange={(e) => setParentData((prev) => ({ ...prev, father_name: e.target.value }))}
                    />
                  </div>

                  <div className="form-field">
                    <label>Mother's Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sunita Devi"
                      value={parentData.mother_name}
                      onChange={(e) => setParentData((prev) => ({ ...prev, mother_name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Primary Contact Phone *</label>
                    <div className="input-icon-wrap">
                      <Phone size={16} />
                      <input
                        type="tel"
                        placeholder="10-digit mobile number"
                        value={parentData.phone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setParentData((prev) => ({
                            ...prev,
                            phone: val,
                            whatsapp_number: whatsappSameAsPhone ? val : prev.whatsapp_number,
                          }));
                        }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>WhatsApp Number</label>
                    <div className="input-icon-wrap">
                      <MessageSquare size={16} />
                      <input
                        type="tel"
                        placeholder="WhatsApp number"
                        value={whatsappSameAsPhone ? parentData.phone : parentData.whatsapp_number}
                        disabled={whatsappSameAsPhone}
                        onChange={(e) =>
                          setParentData((prev) => ({ ...prev, whatsapp_number: e.target.value }))
                        }
                      />
                    </div>
                    <label className="same-phone-checkbox">
                      <input
                        type="checkbox"
                        checked={whatsappSameAsPhone}
                        onChange={(e) => {
                          setWhatsappSameAsPhone(e.target.checked);
                          if (e.target.checked) {
                            setParentData((prev) => ({ ...prev, whatsapp_number: prev.phone }));
                          }
                        }}
                      />
                      <span>Same as Phone</span>
                    </label>
                  </div>

                  <div className="form-field">
                    <label>Admission Date</label>
                    <div className="input-icon-wrap">
                      <Calendar size={16} />
                      <input
                        type="date"
                        value={parentData.admission_date}
                        onChange={(e) => setParentData((prev) => ({ ...prev, admission_date: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-field full-width">
                  <label>Residential Address</label>
                  <input
                    type="text"
                    placeholder="Full residential address, locality, city, pincode..."
                    value={parentData.address}
                    onChange={(e) => setParentData((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>

              {/* SECTION 3 (BOTTOM): CONSOLIDATED BILLING & PAYMENT COLLECTION */}
              <div className="admission-section-card">
                <div className="section-card-header">
                  <div className="header-icon-box green">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <div className="step-tag-row">
                      <span className="step-pill green">STEP 3</span>
                      <h3 className="section-title">Initial Fee Billing &amp; Payment Collection</h3>
                    </div>
                    <p className="section-subtitle">
                      Review total assessed admission charges, record initial collection, and generate official receipt.
                    </p>
                  </div>
                </div>

                <div className="billing-breakdown-card">
                  <div className="billing-summary-grid">
                    <div className="billing-col">
                      <span className="billing-label">Total Assessed Initial Charges</span>
                      <span className="billing-value text-blue">{formatCurrency(totalFamilyAssessed)}</span>
                    </div>

                    <div className="billing-col">
                      <span className="billing-label">Total Sibling Students</span>
                      <span className="billing-value">{children.length} Enrolled</span>
                    </div>

                    <div className="billing-col">
                      <span className="billing-label">Remaining Dues After Collection</span>
                      <span className="billing-value text-red">
                        {formatCurrency(
                          Math.max(0, totalFamilyAssessed - Number(parentData.paid_amount || 0))
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Payment Collection Inputs */}
                  <div className="payment-collection-panel">
                    <div className="payment-toggle-row">
                      <label className="custom-checkbox">
                        <input
                          type="checkbox"
                          checked={parentData.collect_payment}
                          onChange={(e) => setParentData((prev) => ({ ...prev, collect_payment: e.target.checked }))}
                        />
                        <span className="checkbox-text">
                          <strong>Collect Initial Payment Now at Admission Desk</strong> (Generates Official Receipt)
                        </span>
                      </label>
                    </div>

                    {parentData.collect_payment && (
                      <div className="form-grid-3 payment-inputs-grid">
                        <div className="form-field">
                          <label>Collected Amount (₹) *</label>
                          <div className="charge-input-wrap">
                            <span className="currency-prefix">₹</span>
                            <input
                              type="number"
                              placeholder="e.g. 5000"
                              value={parentData.paid_amount}
                              onChange={(e) => setParentData((prev) => ({ ...prev, paid_amount: e.target.value }))}
                              required
                            />
                          </div>
                        </div>

                        <div className="form-field">
                          <label>Payment Mode *</label>
                          <select
                            value={parentData.payment_mode}
                            onChange={(e) => setParentData((prev) => ({ ...prev, payment_mode: e.target.value }))}
                          >
                            <option value="CASH">Cash Payment</option>
                            <option value="IN_ACCOUNT">In Account (Bank / UPI / QR)</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label>Payment Notes / Transaction Ref</label>
                          <input
                            type="text"
                            placeholder="e.g. Initial admission & advance fee"
                            value={parentData.payment_notes}
                            onChange={(e) => setParentData((prev) => ({ ...prev, payment_notes: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="admission-form-footer">
                  <button
                    type="button"
                    className="btn-reset-form"
                    onClick={handleResetForm}
                    disabled={submitting}
                  >
                    <RotateCcw size={16} />
                    <span>Reset Form</span>
                  </button>

                  <button
                    type="submit"
                    className="btn-submit-admission"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="spin" />
                        <span>Processing Admission…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>
                          Complete {admissionMode === 'single' ? 'Student' : 'Family'} Admission (
                          {formatCurrency(parentData.collect_payment ? parentData.paid_amount || 0 : 0)})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}

      {/* View 2: Admissions Register */}
      {activeTab === 'register' && (
        <div className="admissions-register-card">
          <div className="register-header-bar">
            <div>
              <h2 className="register-title">Official Admissions Register</h2>
              <span className="register-count">{totalCount} Total Students Enrolled</span>
            </div>

            <div className="register-search-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search by student name, admission no, or phone..."
                value={searchList}
                onChange={(e) => setSearchList(e.target.value)}
              />
            </div>
          </div>

          {loadingList ? (
            <div className="register-loading-state">
              <Loader2 size={32} className="spin" />
              <p>Loading Admissions Register…</p>
            </div>
          ) : admissionsList.length === 0 ? (
            <div className="register-empty-state">
              <GraduationCap size={48} />
              <h3>No Admission Records Found</h3>
              <p>No students match your search criteria.</p>
            </div>
          ) : (
            <div className="table-responsive register-table-wrap">
              <table className="register-table">
                <thead>
                  <tr>
                    <th>Admission No</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Father's Name</th>
                    <th>Phone</th>
                    <th>Admission Date</th>
                    <th>Family ID</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admissionsList.map((std) => (
                    <tr key={std.id}>
                      <td>
                        <span className="adm-no-chip">{std.admission_no}</span>
                      </td>
                      <td>
                        <strong>{std.full_name}</strong>
                      </td>
                      <td>
                        <span className="class-badge-pill">
                          {std.class_name} {std.section_name && `(${std.section_name})`}
                        </span>
                      </td>
                      <td>{std.father_name || std.parent_name || '—'}</td>
                      <td>{std.phone || '—'}</td>
                      <td>
                        {std.admission_date
                          ? new Date(std.admission_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td>
                        {std.family_id ? (
                          <span className="family-id-chip">{std.family_id}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="register-actions">
                          <button
                            type="button"
                            className="btn-action-view"
                            onClick={() => navigate(`/students/${std.id}`)}
                            title="View Student Profile"
                          >
                            <Eye size={14} /> Profile
                          </button>
                          <button
                            type="button"
                            className="btn-action-view"
                            style={{ background: '#0284c7', color: '#fff' }}
                            onClick={() => handleViewRegisterReceipt(std)}
                            disabled={loadingRegisterReceiptId === std.id}
                            title="Print / View Admission Receipt"
                          >
                            {loadingRegisterReceiptId === std.id ? (
                              <Loader2 size={14} className="spin" />
                            ) : (
                              <Printer size={14} />
                            )}
                            <span>Receipt</span>
                          </button>
                          <button
                            type="button"
                            className="btn-action-view"
                            style={{ background: '#16a34a', color: '#fff' }}
                            onClick={() => handleOpenRegisterPay(std)}
                            title="Record Payment for Student"
                          >
                            <CreditCard size={14} />
                            <span>Pay</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Universal JPG Receipt Modal for Post-Admission */}
      {showJpgReceiptModal && enrollmentSuccess && (
        <JpgReceiptModal
          isOpen={showJpgReceiptModal}
          onClose={() => setShowJpgReceiptModal(false)}
          data={{
            student: {
              ...(enrollmentSuccess.students?.[0] || {}),
              full_name: children[0]?.full_name || enrollmentSuccess.students?.[0]?.full_name,
              admission_no: enrollmentSuccess.students?.[0]?.admission_no || 'ADM-PENDING',
              class_name: classes.find((c) => c.id === Number(children[0]?.class_id))?.name || 'Class',
              father_name: parentData.father_name || parentData.parent_name || '—',
              mother_name: parentData.mother_name || null,
              parent_name: parentData.father_name || parentData.parent_name || '—',
              phone: parentData.whatsapp_number || parentData.phone,
              whatsapp_number: parentData.whatsapp_number || parentData.phone,
              category: children[0]?.category || 'day_scholar',
            },
            students: enrollmentSuccess.students,
            payment: enrollmentSuccess.payments?.[0] || {
              amount: enrollmentSuccess.total_paid,
              payment_date: parentData.admission_date,
              payment_mode: parentData.payment_mode,
              payment_category: 'ADMISSION_CHARGE',
              father_name: parentData.father_name || parentData.parent_name || '—',
              notes: parentData.payment_notes,
            },
            receipt: {
              receipt_number: enrollmentSuccess.payments?.[0]?.receipt_number || `ADM-REC-${Date.now().toString().slice(-6)}`,
            },
            allocations: getAdmissionAllocations(),
            summary: {
              total_amount: enrollmentSuccess.total_paid || totalFamilyAssessed,
            },
          }}
          type={enrollmentSuccess.students.length > 1 ? 'family' : 'admission'}
        />
      )}

      {/* Register List JPG Receipt Modal */}
      {selectedRegisterReceipt && (
        <JpgReceiptModal
          isOpen={Boolean(selectedRegisterReceipt)}
          onClose={() => setSelectedRegisterReceipt(null)}
          data={selectedRegisterReceipt}
          type="admission"
        />
      )}

      {/* Post-Admission Quick Payment Modal */}
      {showRecordPaymentModal && (
        <RecordPaymentModal
          initialStudent={selectedStudentForPayment}
          defaultCategory="ADMISSION_CHARGE"
          defaultNotes="Admission fees collection"
          onClose={() => {
            setShowRecordPaymentModal(false);
            setSelectedStudentForPayment(null);
          }}
          onSaved={() => {
            setShowRecordPaymentModal(false);
            setSelectedStudentForPayment(null);
            fetchData();
            if (activeTab === 'register') {
              fetchRegisterList();
            }
          }}
        />
      )}
    </div>
  );
}
