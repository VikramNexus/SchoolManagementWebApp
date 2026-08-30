/**
 * PendingFees Page — School Management System (Frontend)
 * Eye-Comfort, Receipt-Themed Outstanding Fee Dues, Admission Dues & Ledger
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Search,
  Users,
  CreditCard,
  FileText,
  Eye,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Filter,
  IndianRupee,
  RotateCcw,
  RefreshCw,
  MessageSquare,
  Sparkles,
  GraduationCap,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import RecordPaymentModal from '../components/RecordPaymentModal';
import WhatsAppDirectButton from '../components/WhatsAppDirectButton';
import JpgReceiptModal from '../components/JpgReceiptModal';
import { saveFileToDeviceStorage } from '../utils/fileDownloader';
import './PendingFees.css';

export default function PendingFees() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'admissions'
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState({
    total_students_with_dues: 0,
    total_outstanding: 0,
    total_monthly_dues: 0,
    total_additional_dues: 0,
    total_admission_dues: 0,
  });
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState(null);
  const [paymentModalOptions, setPaymentModalOptions] = useState({});
  const [downloadingDuesId, setDownloadingDuesId] = useState(null);
  const [selectedDuesNoticeData, setSelectedDuesNoticeData] = useState(null);
  const [duesModalOpen, setDuesModalOpen] = useState(false);

  // Fetch classes
  useEffect(() => {
    api
      .get('/settings/classes')
      .then((res) => {
        if (res.data.success) setClasses(res.data.classes || []);
      })
      .catch(() => {});
  }, []);

  // Fetch pending dues list
  const fetchPendingDues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (activeTab === 'monthly') params.append('tab', 'monthly');
      if (search) params.append('search', search);
      if (classFilter) params.append('class_id', classFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      params.append('limit', '100');

      const endpoint = activeTab === 'admissions' ? `/reports/admission-dues-list?${params.toString()}` : `/reports/pending-dues-list?${params.toString()}`;

      const res = await api.get(endpoint);
      if (res.data.success) {
        setStudents(res.data.students || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('[PendingFees.fetchPendingDues]', err);
      setError(err.response?.data?.message || 'Failed to load pending dues.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, classFilter, categoryFilter]);

  useEffect(() => {
    fetchPendingDues();
  }, [fetchPendingDues]);

  // Download Dues Notice PDF
  const handleDownloadDuesNotice = async (student) => {
    try {
      setDownloadingDuesId(student.id);
      const res = await api.get(`/receipts/dues-notice/${student.id}`, {
        responseType: 'blob',
      });

      const filename = `Dues_Notice_${student.admission_no || student.id}.pdf`;
      const saveRes = await saveFileToDeviceStorage({
        data: res.data,
        filename,
        mimeType: 'application/pdf',
      });

      if (saveRes?.platform === 'native') {
        toast.success(`✓ Dues Notice Saved to Phone Storage (Documents/${filename})`);
      } else {
        toast.success(`Dues Notice PDF generated for ${student.full_name}.`);
      }
    } catch (err) {
      toast.error('Failed to generate Dues Notice PDF.');
    } finally {
      setDownloadingDuesId(null);
    }
  };

  const handleOpenJpgDues = (std) => {
    const dueAmount = activeTab === 'admissions' ? (std.admission_dues || std.total_dues) : std.total_dues;
    setSelectedDuesNoticeData({
      student: {
        id: std.id,
        full_name: std.full_name,
        admission_no: std.admission_no,
        class_name: std.class_name,
        section_name: std.section_name,
        category: std.category,
        father_name: std.father_name || std.parent_name,
        phone: std.phone || std.whatsapp_number,
      },
      payment: {
        amount: dueAmount,
        payment_date: new Date().toISOString(),
        payment_mode: 'OUTSTANDING_FEE_NOTICE',
      },
      receipt: {
        receipt_number: `NOTICE-${std.admission_no || std.id}`,
      },
      allocations: [
        ...(activeTab === 'admissions'
          ? [{
              description: 'Admission & Initial Charges Outstanding',
              fee_amount: dueAmount,
              allocated_amount: dueAmount,
            }]
          : [
              {
                description: 'Monthly Tuition Fee Outstanding',
                fee_amount: std.monthly_dues,
                allocated_amount: std.monthly_dues,
              },
              ...(Number(std.additional_dues) > 0 ? [{
                description: 'Additional / Hostel / Transport Dues',
                fee_amount: std.additional_dues,
                allocated_amount: std.additional_dues,
              }] : []),
            ]),
      ],
      summary: {
        total_amount: dueAmount,
      },
    });
    setDuesModalOpen(true);
  };

  const handleOpenCollectPayment = (std, isAdmissionDue = false) => {
    setSelectedStudentForPayment(std);
    if (isAdmissionDue || activeTab === 'admissions') {
      setPaymentModalOptions({
        defaultCategory: 'ADMISSION_CHARGE',
        defaultAmount: std.admission_dues || std.total_dues,
        defaultNotes: `[Admission Collection] Admission dues settled for ${std.full_name}`,
      });
    } else {
      setPaymentModalOptions({
        defaultCategory: 'MONTHLY_TUITION',
        defaultAmount: std.total_dues,
        defaultNotes: '',
      });
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatCategory = (cat) => {
    return cat === 'hosteller' ? 'Hosteller' : 'Day Scholar';
  };

  const handleResetFilters = () => {
    setSearch('');
    setClassFilter('');
    setCategoryFilter('');
  };

  const hasActiveFilters = Boolean(search || classFilter || categoryFilter);

  return (
    <div className="pending-fees-container">
      {/* Header Card */}
      <div className="pending-header-card">
        <div className="header-left-wrap">
          <div className="pending-icon-badge">
            <AlertTriangle size={26} />
          </div>
          <div>
            <h1 className="pending-heading">Student Pending Dues &amp; Ledger</h1>
            <p className="pending-subheading">
              Track outstanding student balances, clear admission dues, and generate official dues notices.
            </p>
          </div>
        </div>

        <div className="pending-header-actions">
          <button
            type="button"
            className="btn-reminders-secondary"
            onClick={() => navigate('/messages')}
          >
            <MessageSquare size={17} />
            <span>Send Due Reminders</span>
          </button>
          <button
            type="button"
            className="btn-pending-refresh"
            onClick={fetchPendingDues}
            disabled={loading}
            title="Refresh Dues Ledger"
            aria-label="Refresh dues"
          >
            <RefreshCw size={17} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tab Switcher: Monthly Fee Dues vs Admission Dues */}
      <div className="pending-tab-nav-bar">
        <button
          type="button"
          className={`pending-tab-pill ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          <CreditCard size={16} />
          <span>📅 Monthly Fee Dues</span>
          {activeTab === 'monthly' && (
            <span className="pending-tab-badge">{summary.total_students_with_dues}</span>
          )}
        </button>

        <button
          type="button"
          className={`pending-tab-pill ${activeTab === 'admissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('admissions')}
        >
          <GraduationCap size={17} />
          <span>🎓 Admission & Extra Dues</span>
          {activeTab === 'admissions' && (
            <span className="pending-tab-badge">{summary.total_students_with_dues}</span>
          )}
        </button>
      </div>

      {error && (
        <div className="pending-alert-banner" role="alert">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchPendingDues} className="alert-retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div className="dues-summary-grid">
        {/* Total Outstanding */}
        <div className="summary-stat-card red">
          <div className="stat-card-top">
            <span className="stat-card-tag red">
              {activeTab === 'admissions' ? 'Pending Admission Dues' : 'Overdue Balance'}
            </span>
            <div className="stat-card-icon red">
              <IndianRupee size={20} />
            </div>
          </div>
          <span className="stat-card-label">
            {activeTab === 'admissions' ? 'Total Admission Dues Pending' : 'Total Outstanding Dues'}
          </span>
          <span className="stat-card-value text-red">
            {formatCurrency(activeTab === 'admissions' ? (summary.total_admission_dues || summary.total_outstanding) : summary.total_outstanding)}
          </span>
          <span className="stat-card-subtext">Across all active students</span>
        </div>

        {/* Students With Pending Dues */}
        <div className="summary-stat-card orange">
          <div className="stat-card-top">
            <span className="stat-card-tag orange">Student Accounts</span>
            <div className="stat-card-icon orange">
              <Users size={20} />
            </div>
          </div>
          <span className="stat-card-label">Students With Pending Balance</span>
          <span className="stat-card-value">
            {summary.total_students_with_dues} Students
          </span>
          <span className="stat-card-subtext">Require dues settlement</span>
        </div>

        {/* Avg Pending Per Student */}
        <div className="summary-stat-card blue">
          <div className="stat-card-top">
            <span className="stat-card-tag blue">Average Balance</span>
            <div className="stat-card-icon blue">
              <CreditCard size={20} />
            </div>
          </div>
          <span className="stat-card-label">Avg Pending Per Student</span>
          <span className="stat-card-value">
            {summary.total_students_with_dues > 0
              ? formatCurrency(
                  (activeTab === 'admissions'
                    ? (summary.total_admission_dues || summary.total_outstanding)
                    : summary.total_outstanding) / summary.total_students_with_dues
                )
              : '₹0'}
          </span>
          <span className="stat-card-subtext">Average outstanding balance</span>
        </div>

        {/* Monthly vs Additional Breakdown */}
        <div className="summary-stat-card cyan">
          <div className="stat-card-top">
            <span className="stat-card-tag cyan">Dues Category</span>
            <div className="stat-card-icon cyan">
              <FileText size={20} />
            </div>
          </div>
          <span className="stat-card-label">
            {activeTab === 'admissions' ? 'Admission Assessment' : 'Monthly & Add. Breakdown'}
          </span>
          <div className="breakdown-stat-rows">
            {activeTab === 'admissions' ? (
              <>
                <div className="breakdown-mini-row">
                  <span>Category:</span> <strong>Admission Charges</strong>
                </div>
                <div className="breakdown-mini-row">
                  <span>Dues Total:</span> <strong>{formatCurrency(summary.total_admission_dues || summary.total_outstanding)}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="breakdown-mini-row">
                  <span>Monthly:</span> <strong>{formatCurrency(summary.total_monthly_dues)}</strong>
                </div>
                <div className="breakdown-mini-row">
                  <span>Additional:</span> <strong>{formatCurrency(summary.total_additional_dues)}</strong>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filters Bar Card */}
      <div className="pending-filter-card">
        <div className="pending-search-wrapper">
          <div className="pending-search-icon">
            <Search size={18} />
          </div>
          <input
            type="search"
            className="pending-search-input"
            placeholder="Search student by name, admission no, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="pending-filter-controls">
          <div className="filter-select-wrap">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="pending-select"
              aria-label="Filter by Class"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="pending-select"
              aria-label="Filter by Category"
            >
              <option value="">All Categories</option>
              <option value="day_scholar">Day Scholar</option>
              <option value="hosteller">Hosteller</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn-clear-pending-filters"
              onClick={handleResetFilters}
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Ledger Table Card */}
      <div className="pending-table-card">
        <div className="pending-table-header">
          <div>
            <h2 className="table-heading">
              {activeTab === 'admissions' ? '🎓 Students with Pending Admission Charges' : 'Student Dues Breakdown'}
            </h2>
            <span className="table-count-tag">{students.length} Records</span>
          </div>
        </div>

        {loading ? (
          <div className="pending-loading-state">
            <Loader2 size={32} className="spin" />
            <p>Loading {activeTab === 'admissions' ? 'admission dues records' : 'outstanding dues'}…</p>
          </div>
        ) : students.length === 0 ? (
          <div className="pending-empty-state">
            <div className="empty-icon-wrap green">
              <CheckCircle2 size={48} />
            </div>
            <h3>No {activeTab === 'admissions' ? 'Admission' : ''} Pending Dues!</h3>
            <p>
              {hasActiveFilters
                ? 'No students found matching your search and filter criteria.'
                : activeTab === 'admissions'
                ? 'All admitted students have settled their admission charges in full.'
                : 'All active students have fully cleared their monthly tuition and additional fees.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive pending-table-wrapper">
            <table className="pending-dues-table">
              <thead>
                <tr>
                  <th>Student Name &amp; Adm No</th>
                  <th>Class</th>
                  <th>Father / Parent Name</th>
                  {activeTab === 'admissions' ? (
                    <>
                      <th className="text-right">Assessed Charges</th>
                      <th className="text-right">Paid So Far</th>
                      <th className="text-right">Remaining Due</th>
                    </>
                  ) : (
                    <>
                      <th className="text-right">Monthly Tuition Dues</th>
                      <th className="text-right">Additional Dues</th>
                      <th className="text-right">Total Outstanding</th>
                    </>
                  )}
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((std) => {
                  const isAdmTab = activeTab === 'admissions';
                  const dueVal = isAdmTab ? (std.admission_dues || std.total_dues) : std.total_dues;

                  return (
                    <tr key={std.id} className="pending-table-row">
                      <td className="student-name-cell">
                        <div className="student-info-block">
                          {std.is_family && (
                            <span className="family-account-badge" title="Combined Family Account for all siblings">
                              <Users size={12} /> Family ({std.sibling_count} Siblings)
                            </span>
                          )}
                          <button
                            type="button"
                            className="student-name-link font-bold"
                            onClick={() => navigate(`/students/${std.id}`)}
                            title="Open Student Profile & Fee Ledger"
                          >
                            {std.full_name}
                          </button>
                          <span className="student-adm-tag">{std.admission_no || 'ADM-—'}</span>
                        </div>
                      </td>

                      <td className="class-cell">
                        <span className="class-pill">
                          {std.class_name ? `${std.class_name}${std.section_name ? `-${std.section_name}` : ''}` : '—'}
                        </span>
                      </td>

                      <td className="parent-cell">
                        <span className="parent-text">{std.father_name || std.parent_name || '—'}</span>
                      </td>

                      {isAdmTab ? (
                        <>
                          <td className="text-right assessed-cell">
                            <strong>₹{Number(std.total_assessed_admission || std.total_dues || 0).toLocaleString('en-IN')}</strong>
                          </td>
                          <td className="text-right paid-cell text-green font-semibold">
                            ₹{Number(std.admission_paid || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="text-right total-due-cell">
                            <span className="total-due-badge red">
                              ₹{Number(dueVal).toLocaleString('en-IN')}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="text-right amount-cell">
                            <span className="due-amount-text">
                              {Number(std.monthly_dues) > 0 ? formatCurrency(std.monthly_dues) : '—'}
                            </span>
                          </td>
                          <td className="text-right amount-cell">
                            <span className="due-amount-text">
                              {Number(std.additional_dues) > 0 ? formatCurrency(std.additional_dues) : '—'}
                            </span>
                          </td>
                          <td className="text-right total-due-cell">
                            <span className="total-due-badge red">
                              {formatCurrency(std.total_dues)}
                            </span>
                          </td>
                        </>
                      )}

                      <td className="actions-cell text-center">
                        <div className="action-buttons-group">
                          {/* Collect Due Button */}
                          <button
                            type="button"
                            className="btn-action-collect-due"
                            onClick={() => handleOpenCollectPayment(std, isAdmTab)}
                            title="Collect payment & generate official receipt"
                          >
                            <CreditCard size={13} />
                            <span>{isAdmTab ? 'Collect Admission Due' : 'Collect Fee'}</span>
                          </button>

                          {/* WhatsApp Direct Dues Notice */}
                          <WhatsAppDirectButton
                            compact
                            size="sm"
                            onSend={() => api.post(`/receipts/send-dues-whatsapp/${std.id}`)}
                            onOpenJpg={() => handleOpenJpgDues(std)}
                            phone={std.whatsapp_number || std.phone}
                            itemTitle="Dues Statement"
                          />

                          {/* Download PDF Dues Notice */}
                          <button
                            type="button"
                            className="btn-action-dues-notice"
                            onClick={() => handleDownloadDuesNotice(std)}
                            disabled={downloadingDuesId === std.id}
                            title="Download PDF Dues Notice"
                          >
                            {downloadingDuesId === std.id ? (
                              <Loader2 size={13} className="spin" />
                            ) : (
                              <Download size={13} />
                            )}
                            <span>PDF</span>
                          </button>

                          {/* Profile Button */}
                          <button
                            type="button"
                            className="btn-action-profile-link"
                            onClick={() => navigate(`/students/${std.id}`)}
                            title="View Complete Student Profile"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {selectedStudentForPayment && (
        <RecordPaymentModal
          initialStudent={selectedStudentForPayment}
          defaultCategory={paymentModalOptions.defaultCategory || 'MONTHLY_TUITION'}
          defaultAmount={paymentModalOptions.defaultAmount || ''}
          defaultNotes={paymentModalOptions.defaultNotes || ''}
          onClose={() => setSelectedStudentForPayment(null)}
          onSaved={() => {
            setSelectedStudentForPayment(null);
            fetchPendingDues();
          }}
        />
      )}

      {/* Universal High-Res Dues Notice JPG Modal */}
      {duesModalOpen && selectedDuesNoticeData && (
        <JpgReceiptModal
          isOpen={duesModalOpen}
          onClose={() => {
            setDuesModalOpen(false);
            setSelectedDuesNoticeData(null);
          }}
          data={selectedDuesNoticeData}
          type="dues"
        />
      )}
    </div>
  );
}
