/**
 * PendingFees Page — School Management System (Frontend)
 * Eye-Comfort, Receipt-Themed Outstanding Fee Dues & Ledger
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import RecordPaymentModal from '../components/RecordPaymentModal';
import WhatsAppDirectButton from '../components/WhatsAppDirectButton';
import './PendingFees.css';

export default function PendingFees() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState({
    total_students_with_dues: 0,
    total_outstanding: 0,
    total_monthly_dues: 0,
    total_additional_dues: 0,
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
  const [downloadingDuesId, setDownloadingDuesId] = useState(null);

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
      if (search) params.append('search', search);
      if (classFilter) params.append('class_id', classFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      params.append('limit', '100');

      const res = await api.get(`/reports/pending-dues-list?${params.toString()}`);
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
  }, [search, classFilter, categoryFilter]);

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

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Dues_Notice_${student.admission_no || student.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success(`Dues Notice PDF generated for ${student.full_name}.`);
    } catch (err) {
      toast.error('Failed to generate Dues Notice PDF.');
    } finally {
      setDownloadingDuesId(null);
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
      {/* Header Card (Eye-Comfort Theme) */}
      <div className="pending-header-card">
        <div className="header-left-wrap">
          <div className="pending-icon-badge">
            <AlertTriangle size={26} />
          </div>
          <div>
            <h1 className="pending-heading">Student Pending Dues &amp; Ledger</h1>
            <p className="pending-subheading">
              Track outstanding student balances, record payments to settle dues, and generate official dues notice receipts.
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

      {error && (
        <div className="pending-alert-banner" role="alert">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchPendingDues} className="alert-retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards Grid (Receipt Look) */}
      <div className="dues-summary-grid">
        {/* Total Outstanding */}
        <div className="summary-stat-card red">
          <div className="stat-card-top">
            <span className="stat-card-tag red">Overdue Balance</span>
            <div className="stat-card-icon red">
              <IndianRupee size={20} />
            </div>
          </div>
          <span className="stat-card-label">Total Outstanding Dues</span>
          <span className="stat-card-value text-red">
            {formatCurrency(summary.total_outstanding)}
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
          <span className="stat-card-label">Students With Pending Dues</span>
          <span className="stat-card-value">
            {summary.total_students_with_dues} Students
          </span>
          <span className="stat-card-subtext">Active student accounts</span>
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
              ? formatCurrency(summary.total_outstanding / summary.total_students_with_dues)
              : '₹0'}
          </span>
          <span className="stat-card-subtext">Average outstanding balance</span>
        </div>

        {/* Monthly vs Additional Breakdown */}
        <div className="summary-stat-card cyan">
          <div className="stat-card-top">
            <span className="stat-card-tag cyan">Dues Breakdown</span>
            <div className="stat-card-icon cyan">
              <FileText size={20} />
            </div>
          </div>
          <span className="stat-card-label">Monthly &amp; Add. Breakdown</span>
          <div className="breakdown-stat-rows">
            <div className="breakdown-mini-row">
              <span>Monthly:</span> <strong>{formatCurrency(summary.total_monthly_dues)}</strong>
            </div>
            <div className="breakdown-mini-row">
              <span>Additional:</span> <strong>{formatCurrency(summary.total_additional_dues)}</strong>
            </div>
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
              className="btn-filter-reset"
              onClick={handleResetFilters}
              title="Reset all filters"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Outstanding Ledger Table Card */}
      <div className="pending-table-card">
        <div className="table-header-bar">
          <div className="table-header-left">
            <span className="table-header-title">Outstanding Student Ledger</span>
            <span className="table-count-pill red">{students.length} Accounts with Dues</span>
          </div>
        </div>

        {loading ? (
          <div className="table-loading-cell">
            <div className="cell-loader-wrap">
              <Loader2 size={24} className="spin text-primary" />
              <span>Loading student outstanding fee ledgers...</span>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="table-empty-cell">
            <div className="empty-state-box">
              <CheckCircle2 size={42} className="text-success" />
              <p className="empty-title">All Caught Up! No Outstanding Dues</p>
              <p className="empty-desc">
                {hasActiveFilters
                  ? 'No students with pending dues match your filter criteria.'
                  : 'All active students have fully cleared their fee balances for the current session.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-reset-empty"
                  onClick={handleResetFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="pending-ledger-table" role="table">
              <thead>
                <tr>
                  <th>Adm No</th>
                  <th>Student Name</th>
                  <th>Class / Sec</th>
                  <th>Category</th>
                  <th>Monthly Dues</th>
                  <th>Additional Dues</th>
                  <th>Total Dues</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((std) => (
                  <tr key={std.id} className="dues-data-row">
                    <td>
                      <span className="admission-code-pill">{std.admission_no}</span>
                    </td>
                    <td>
                      <div className="student-profile-cell">
                        <strong className="student-fullname">{std.full_name}</strong>
                        {std.parent_name && (
                          <small className="student-parent-text">P: {std.parent_name}</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="class-section-pill">
                        <span className="class-name-txt">{std.class_name || 'Class —'}</span>
                        {std.section_name && (
                          <span className="sec-tag">{std.section_name}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`student-cat-pill ${std.category}`}>
                        {formatCategory(std.category)}
                      </span>
                    </td>
                    <td>
                      <span className="monthly-due-amount">
                        {formatCurrency(std.monthly_dues)}
                      </span>
                    </td>
                    <td>
                      <span className="add-due-amount">
                        {formatCurrency(std.additional_dues)}
                      </span>
                    </td>
                    <td>
                      <strong className="total-due-highlight">
                        {formatCurrency(std.total_dues)}
                      </strong>
                    </td>
                    <td className="td-actions">
                      <div className="dues-action-buttons">
                        <WhatsAppDirectButton
                          compact
                          size="sm"
                          onSend={() => api.post(`/receipts/send-dues-whatsapp/${std.id}`)}
                          phone={std.phone}
                        />
                        <button
                          type="button"
                          className="btn-pay-dues-action"
                          onClick={() => setSelectedStudentForPayment(std)}
                          title="Record payment to clear dues"
                        >
                          <CreditCard size={14} />
                          <span>Pay Dues</span>
                        </button>
                        <button
                          type="button"
                          className="btn-receipt-notice-action"
                          onClick={() => handleDownloadDuesNotice(std)}
                          disabled={downloadingDuesId === std.id}
                          title="Generate & Download Dues Notice PDF"
                        >
                          {downloadingDuesId === std.id ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <FileText size={14} />
                          )}
                          <span>Dues Receipt</span>
                        </button>
                        <button
                          type="button"
                          className="btn-view-profile-action"
                          onClick={() => navigate(`/students/${std.id}`)}
                          title="View Full Ledger Profile"
                          aria-label="View Profile"
                        >
                          <Eye size={15} />
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

      {/* Record Payment Modal */}
      {selectedStudentForPayment && (
        <RecordPaymentModal
          initialStudent={selectedStudentForPayment}
          onClose={() => setSelectedStudentForPayment(null)}
          onSaved={() => {
            setSelectedStudentForPayment(null);
            fetchPendingDues();
          }}
        />
      )}
    </div>
  );
}
