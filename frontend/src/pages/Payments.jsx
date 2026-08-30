/**
 * Payments Page — School Management System (Frontend)
 *
 * Displays fee collections ledger with summary KPI cards,
 * dedicated "All Payments" vs "Admission Collections" tabs,
 * column sorting, allocation breakdown, receipt download, payment editing,
 * and reversible payment deletion with student ledger balance restoration.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  CreditCard,
  Plus,
  X,
  FileText,
  Edit2,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Receipt,
  IndianRupee,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  GraduationCap,
  Sparkles,
  Printer,
  User,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import CashCollectionSummary from '../components/CashCollectionSummary';
import RecordPaymentModal from '../components/RecordPaymentModal';
import AssignFeeModal from '../components/AssignFeeModal';
import EditPaymentModal from '../components/EditPaymentModal';
import JpgReceiptModal from '../components/JpgReceiptModal';
import WhatsAppDirectButton from '../components/WhatsAppDirectButton';
import './Payments.css';

export default function Payments() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'admissions'
  const [payments, setPayments] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Receipt Modal State
  const [selectedReceiptData, setSelectedReceiptData] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [loadingReceiptId, setLoadingReceiptId] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting
  const [sortField, setSortField] = useState('payment_date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  // Dropdown data
  const [classes, setClasses] = useState([]);

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Delete Confirmation Modal state
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [expandedPayments, setExpandedPayments] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch classes for dropdown filter
  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await api.get('/settings/classes');
        if (res.data.success) {
          setClasses(res.data.classes || []);
        }
      } catch (err) {
        console.error('Failed to load classes for filter:', err);
      }
    }
    fetchClasses();
  }, []);

  // Fetch payment history & summary
  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        tab: activeTab,
        page: page.toString(),
        limit: '20',
        sort_by: sortField,
        sort_order: sortOrder,
      });

      if (search.trim()) params.append('search', search.trim());
      if (classFilter) params.append('class_id', classFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const endpoint = `/payments?${params.toString()}`;

      const [historyRes, summaryRes] = await Promise.all([
        api.get(endpoint),
        api.get(`/payments/summary?${startDate ? `start_date=${startDate}&` : ''}${endDate ? `end_date=${endDate}` : ''}`),
      ]);

      if (historyRes.data.success) {
        setPayments(historyRes.data.payments || []);
        setTotalRecords(historyRes.data.pagination?.total || 0);
        setTotalPages(historyRes.data.pagination?.totalPages || 1);
        setTotalAmount(historyRes.data.summary?.total_amount || 0);
      }

      if (summaryRes?.data?.success) {
        setSummaryData(summaryRes.data.summary || summaryRes.data || null);
      } else if (historyRes?.data?.summary) {
        setSummaryData(historyRes.data.summary);
      }
    } catch (err) {
      console.error('[Payments.fetchPayments]', err);
      const msg = err.response?.data?.message || 'Failed to fetch payment history.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, classFilter, categoryFilter, startDate, endDate, sortField, sortOrder, page, toast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="sort-icon-idle" />;
    return sortOrder === 'asc' ? <ArrowUp size={14} className="sort-icon-active" /> : <ArrowDown size={14} className="sort-icon-active" />;
  };

  const handleOpenDetails = async (paymentId) => {
    try {
      setLoadingDetails(true);
      setDetailsModalOpen(true);
      const res = await api.get(`/payments/${paymentId}`);
      if (res.data.success) {
        setSelectedPaymentDetails(res.data);
      }
    } catch (err) {
      toast.error('Failed to fetch payment details.');
      setDetailsModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPayment) return;

    try {
      setIsDeleting(true);
      const res = await api.delete(`/payments/${deletingPayment.id}`);
      if (res.data.success) {
        toast.success('Payment deleted successfully. Student dues restored.');
        setDeletingPayment(null);
        fetchPayments();
      }
    } catch (err) {
      console.error('[Payments.handleDeleteConfirm]', err);
      toast.error(err.response?.data?.message || 'Failed to delete payment.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatMonthName = (m, y) => {
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const handleViewReceipt = async (paymentOrItem) => {
    if (!paymentOrItem) return;
    const paymentId = typeof paymentOrItem === 'object'
      ? (paymentOrItem.id || paymentOrItem.payment_id || paymentOrItem.receipt_number || paymentOrItem.receipt_no)
      : paymentOrItem;

    try {
      setLoadingReceiptId(paymentId);
      const res = await api.get(`/receipts/${paymentId}`);
      if (res.data && res.data.success) {
        setSelectedReceiptData({
          ...res.data,
          student: res.data.student || {
            full_name: paymentOrItem.full_name,
            admission_no: paymentOrItem.admission_no,
            class_name: paymentOrItem.class_name,
            section_name: paymentOrItem.section_name,
            phone: paymentOrItem.phone || paymentOrItem.whatsapp_number,
          },
          payment: res.data.payment || paymentOrItem,
        });
        setReceiptModalOpen(true);
      } else {
        throw new Error('Could not load receipt data');
      }
    } catch (err) {
      console.error('[View Receipt Error]', err);
      // Fallback local receipt data
      setSelectedReceiptData({
        school: {
          school_name: 'Aryavart Shikshan Sansthan',
          address: 'Near Knowledge Hub, Main Campus',
          phone: '+91-9876543210',
          email: 'info@aryavart.edu.in',
        },
        student: {
          full_name: paymentOrItem.full_name || 'Student',
          admission_no: paymentOrItem.admission_no || 'ADM-PAID',
          class_name: paymentOrItem.class_name || 'Class',
          section_name: paymentOrItem.section_name || '',
          phone: paymentOrItem.phone || paymentOrItem.whatsapp_number || '',
        },
        payment: {
          id: paymentOrItem.id,
          receipt_number: paymentOrItem.receipt_number || `RCP-${paymentOrItem.id}`,
          amount: paymentOrItem.amount,
          payment_mode: paymentOrItem.payment_mode || 'CASH',
          payment_date: paymentOrItem.payment_date || new Date().toISOString(),
          notes: paymentOrItem.notes,
        },
        allocations: paymentOrItem.allocations || [],
        summary: { total_amount: paymentOrItem.amount },
      });
      setReceiptModalOpen(true);
    } finally {
      setLoadingReceiptId(null);
    }
  };

  return (
    <div className="payments-page">
      {/* Header Banner */}
      <div className="payments-header">
        <div className="header-title-group">
          <div className="header-icon-badge">
            <CreditCard size={24} />
          </div>
          <div>
            <h1>Payment &amp; Collections Desk</h1>
            <p className="subtitle">
              Track fee collections, manage admission entries, cash / in-account entries, and audit allocations.
            </p>
          </div>
        </div>
        <div className="header-actions-group">
          <button
            type="button"
            className="btn btn-secondary btn-assign-fee"
            onClick={() => setAssignModalOpen(true)}
          >
            <Plus size={16} /> Assign Custom Fee
          </button>
          <button
            type="button"
            className="btn btn-primary btn-record-pay"
            onClick={() => setRecordModalOpen(true)}
          >
            <CreditCard size={16} /> Record Payment
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-refresh"
            onClick={fetchPayments}
            disabled={loading}
            title="Refresh payments list"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tab Switcher: Monthly Payments vs Admission Payments */}
      <div className="payments-tab-nav-bar">
        <button
          type="button"
          className={`tab-nav-pill ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('monthly');
            setPage(1);
          }}
        >
          <CreditCard size={16} />
          <span>📅 Monthly Payments</span>
          {activeTab === 'monthly' && <span className="tab-count-badge">{totalRecords}</span>}
        </button>

        <button
          type="button"
          className={`tab-nav-pill ${activeTab === 'admissions' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('admissions');
            setPage(1);
          }}
        >
          <GraduationCap size={17} />
          <span>🎓 Admission Payments</span>
          {activeTab === 'admissions' && <span className="tab-count-badge">{totalRecords}</span>}
        </button>
      </div>

      {/* Cash Collection Summary Cards */}
      <CashCollectionSummary summary={summaryData} loading={loading} />

      {/* Filters Bar */}
      <div className="payments-filters-card">
        <div className="search-box-wrap">
          <div className="search-prefix-icon">
            <Search size={18} />
          </div>
          <input
            type="search"
            className="payments-search-input"
            placeholder="Search by student name, admission no, or receipt #…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 2x2 Format: 4 Sorting & Filtering Controls */}
        <div className="filter-controls-grid-2x2">
          <div className="filter-control-item">
            <span className="control-label">Class</span>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-control-item">
            <span className="control-label">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              <option value="day_scholar">Day Scholar</option>
              <option value="hosteller">Hosteller</option>
            </select>
          </div>

          <div className="filter-control-item">
            <span className="control-label">From Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="filter-control-item">
            <span className="control-label">To Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Payments Table Card */}
      <div className="payments-table-card">
        {loading ? (
          <div className="payments-loading-state">
            <Loader2 size={32} className="spin" />
            <p>Loading {activeTab === 'admissions' ? 'admission collections' : 'payment records'}…</p>
          </div>
        ) : error ? (
          <div className="payments-error-state">
            <p className="error-msg">{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={fetchPayments}>
              Retry
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="payments-empty-state">
            <div className="empty-icon-wrap">
              {activeTab === 'admissions' ? <GraduationCap size={48} /> : <IndianRupee size={48} />}
            </div>
            <h3>No {activeTab === 'admissions' ? 'Admission Collection' : 'Payment'} Records Found</h3>
            <p>
              {search || classFilter || startDate || endDate
                ? 'Try adjusting your search criteria or date filters.'
                : activeTab === 'admissions'
                ? 'No payments have been collected at the admissions desk yet.'
                : 'No payments have been collected yet. Click "Record Payment" to record a collection.'}
            </p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('payment_date')}>
                      <div className="th-content">
                        <span>Payment Date</span>
                        {renderSortIcon('payment_date')}
                      </div>
                    </th>
                    <th>Receipt No</th>
                    <th className="sortable" onClick={() => handleSort('full_name')}>
                      <div className="th-content">
                        <span>Student &amp; Adm No</span>
                        {renderSortIcon('full_name')}
                      </div>
                    </th>
                    <th>Class</th>
                    {activeTab === 'admissions' && <th>Total Assessed</th>}
                    <th className="sortable text-right" onClick={() => handleSort('amount')}>
                      <div className="th-content justify-end">
                        <span>{activeTab === 'admissions' ? 'Paid at Admission' : 'Amount Paid'}</span>
                        {renderSortIcon('amount')}
                      </div>
                    </th>
                    {activeTab === 'admissions' && <th>Remaining Dues</th>}
                    <th>Mode</th>
                    <th>Notes</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const receiptNum = p.receipt_number || `RCP-${String(p.id).padStart(6, '0')}`;
                    const modeStr = (p.payment_mode || p.mode || 'CASH').toLowerCase();
                    const remDues = Number(p.remaining_dues || 0);

                    return (
                      <tr key={p.id} className="payment-row">
                        <td className="payment-date-cell">
                          {p.payment_date
                            ? new Date(p.payment_date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="receipt-num-cell">
                          <button
                            type="button"
                            className="receipt-chip-btn"
                            onClick={() => handleViewReceipt(p)}
                            title="Click to view & download official JPG receipt"
                          >
                            <Receipt size={13} />
                            <span>{receiptNum}</span>
                          </button>
                        </td>
                        <td className="student-cell">
                          {(p.is_family || p.receipt_number?.startsWith('FAM') || (p.notes && p.notes.includes('Family Receipt'))) ? (
                            <div className="family-student-cell-stack">
                              <div className="family-badge-toggle-row">
                                <span className="family-pill-mini">👨‍👧‍👦 Family Payment</span>
                                {p.notes && (
                                  <button
                                    type="button"
                                    className="btn-sibling-toggle"
                                    onClick={() => setExpandedPayments(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                    title={expandedPayments[p.id] ? 'Hide note' : 'View receipt note'}
                                  >
                                    {expandedPayments[p.id] ? 'Hide' : '👁️ View'}
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                className="student-name-link font-bold"
                                onClick={() => navigate(`/students/${p.student_id}`)}
                                title="View student full profile & ledger"
                              >
                                {p.full_name || '—'}
                              </button>
                              <span className="student-adm-no font-mono">{p.admission_no || '—'}</span>
                              {expandedPayments[p.id] && p.notes && (
                                <div className="sibling-drawer-content">
                                  <span className="sibling-meta-chip">{p.notes}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="student-name-block">
                              <button
                                type="button"
                                className="student-name-link font-bold"
                                onClick={() => navigate(`/students/${p.student_id}`)}
                                title="View student full profile & ledger"
                              >
                                {p.full_name || '—'}
                              </button>
                              <span className="student-adm-no font-mono">{p.admission_no || '—'}</span>
                            </div>
                          )}
                        </td>
                        <td className="class-cell">
                          <span className="class-badge">
                            {p.class_name ? `${p.class_name}${p.section_name ? `-${p.section_name}` : ''}` : '—'}
                          </span>
                        </td>
                        {activeTab === 'admissions' && (
                          <td className="assessed-cell">
                            <strong>₹{Number(p.total_assessed || p.amount || 0).toLocaleString('en-IN')}</strong>
                          </td>
                        )}
                        <td className="amount-cell text-right">
                          <span className="amount-val-badge">
                            {formatCurrency(p.amount)}
                          </span>
                        </td>
                        {activeTab === 'admissions' && (
                          <td className="dues-cell">
                            {remDues > 0 ? (
                              <span className="pending-dues-tag">
                                🔴 Due ₹{remDues.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="cleared-tag">🟢 All Cleared</span>
                            )}
                          </td>
                        )}
                        <td className="mode-cell">
                          {modeStr.includes('account') || modeStr.includes('bank') || modeStr.includes('online') || modeStr.includes('in_account') ? (
                            <span className="remark-in-account">in acc.</span>
                          ) : (
                            <span className="remark-cash">cash</span>
                          )}
                        </td>
                        <td className="notes-cell" title={p.notes || ''}>
                          {p.notes || <span className="text-muted">—</span>}
                        </td>
                        <td className="actions-cell text-center">
                          <div className="action-btns">
                            <button
                              type="button"
                              className="btn-action profile-btn"
                              onClick={() => navigate(`/students/${p.student_id}`)}
                              title="View Student Profile & Dues Ledger"
                            >
                              <User size={13} />
                              <span>Profile</span>
                            </button>
                            <button
                              type="button"
                              className="btn-action receipt-btn"
                              onClick={() => handleViewReceipt(p)}
                              disabled={loadingReceiptId === p.id}
                              title="Print / View Official JPG Receipt"
                            >
                              {loadingReceiptId === p.id ? <Loader2 size={13} className="spin" /> : <Printer size={13} />}
                              <span>Print / Receipt</span>
                            </button>
                            <WhatsAppDirectButton
                              compact
                              size="sm"
                              onSend={() => api.post(`/receipts/send-whatsapp/${p.id}`)}
                              onOpenJpg={() => handleViewReceipt(p)}
                              phone={p.phone || p.whatsapp_number}
                              itemTitle="Receipt"
                            />
                            <button
                              type="button"
                              className="btn-action view"
                              onClick={() => handleOpenDetails(p.id)}
                              title="View Allocation Breakdown"
                            >
                              <Eye size={14} /> Allocation
                            </button>
                            <button
                              type="button"
                              className="btn-action edit"
                              onClick={() => setEditingPayment(p)}
                              title="Edit Payment Record"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn-action delete text-danger"
                              onClick={() => setDeletingPayment(p)}
                              title="Delete Payment & Revert Student Dues"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="payments-pagination">
                <div className="pagination-info">
                  Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalRecords} Total Records)
                </div>
                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Payment Confirmation Modal */}
      {deletingPayment && (
        <div className="modal-overlay" onClick={() => setDeletingPayment(null)}>
          <div className="modal-content modal-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-header">
              <div className="header-icon-danger">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h2>Delete Payment Record?</h2>
                <p className="subtitle">This action will reverse all allocated student dues.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeletingPayment(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body delete-body">
              <div className="delete-warning-box">
                <p>
                  You are about to delete payment record for student{' '}
                  <strong>{deletingPayment.full_name}</strong> of amount{' '}
                  <strong>{formatCurrency(deletingPayment.amount)}</strong>.
                </p>
                <ul className="delete-effects-list">
                  <li>Student's monthly fee and admission fee dues will be restored to UNPAID.</li>
                  <li>Linked receipt number ({deletingPayment.receipt_number || `RCP-${deletingPayment.id}`}) will be deleted.</li>
                  <li>Audit log entry will be recorded.</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingPayment(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                <span>{isDeleting ? 'Deleting…' : 'Yes, Delete Payment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Allocation Details Modal */}
      {detailsModalOpen && (
        <div className="modal-overlay" onClick={() => setDetailsModalOpen(false)}>
          <div className="modal-content modal-details" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-header-icon">
                  <Eye size={20} />
                </div>
                <div>
                  <h2>Payment Allocation Breakdown</h2>
                  <p className="subtitle">Detailed breakdown of how this payment was allocated</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDetailsModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {loadingDetails ? (
                <div className="loading-state">
                  <Loader2 size={32} className="spin text-primary" />
                  <p>Loading breakdown…</p>
                </div>
              ) : selectedPaymentDetails ? (
                <div className="details-content">
                  <div className="details-info-grid">
                    <div className="info-item">
                      <span className="info-lbl">Receipt No</span>
                      <strong className="info-val font-mono">
                        {selectedPaymentDetails.payment?.receipt_number || `RCP-${selectedPaymentDetails.payment?.id}`}
                      </strong>
                    </div>
                    <div className="info-item">
                      <span className="info-lbl">Student Name</span>
                      <strong className="info-val">
                        {selectedPaymentDetails.payment?.full_name || selectedPaymentDetails.payment?.student_name || '—'}
                      </strong>
                    </div>
                    <div className="info-item">
                      <span className="info-lbl">Admission No</span>
                      <strong className="info-val font-mono">
                        {selectedPaymentDetails.payment?.admission_no || '—'}
                      </strong>
                    </div>
                    <div className="info-item">
                      <span className="info-lbl">Class & Section</span>
                      <strong className="info-val">
                        {selectedPaymentDetails.payment?.class_name
                          ? `${selectedPaymentDetails.payment.class_name}${selectedPaymentDetails.payment.section_name ? ` (${selectedPaymentDetails.payment.section_name})` : ''}`
                          : '—'}
                      </strong>
                    </div>
                    <div className="info-item">
                      <span className="info-lbl">Payment Mode</span>
                      <strong className="info-val">
                        {(selectedPaymentDetails.payment?.payment_mode || 'CASH').toUpperCase()}
                      </strong>
                    </div>
                    <div className="info-item">
                      <span className="info-lbl">Total Amount</span>
                      <strong className="info-val highlight">
                        {formatCurrency(selectedPaymentDetails.payment?.amount)}
                      </strong>
                    </div>
                  </div>

                  <h3 className="section-subheading">Allocated Fee Breakdown</h3>
                  <div className="allocations-table-wrap">
                    <table className="allocations-table">
                      <thead>
                        <tr>
                          <th>Fee Period / Description</th>
                          <th className="text-right">Assessed Fee</th>
                          <th className="text-right">Amount Allocated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPaymentDetails.allocations && selectedPaymentDetails.allocations.length > 0 ? (
                          selectedPaymentDetails.allocations.map((a) => (
                            <tr key={a.id}>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 600 }}>
                                    {a.fee_month
                                      ? `${formatMonthName(a.fee_month, a.fee_year)} Monthly Tuition`
                                      : a.description || 'Admission / Additional Fee'}
                                  </span>
                                  {a.fee_month && (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                      Month: {a.fee_month}/{a.fee_year}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="text-right">{formatCurrency(a.fee_amount || a.allocated_amount)}</td>
                              <td className="text-right">
                                <span className="allocated-badge">
                                  ✓ {formatCurrency(a.allocated_amount)}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="text-center text-muted" style={{ padding: '1.5rem' }}>
                              General fee collection allocation
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', color: '#fff' }}
                onClick={() => {
                  setDetailsModalOpen(false);
                  handleViewReceipt(selectedPaymentDetails.payment);
                }}
              >
                <Printer size={16} /> 🖨️ Print / View Receipt
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {recordModalOpen && (
        <RecordPaymentModal
          isOpen={recordModalOpen}
          onClose={() => {
            setRecordModalOpen(false);
            fetchPayments();
          }}
          onSuccess={() => {
            fetchPayments();
          }}
        />
      )}

      {/* Assign Fee Modal */}
      {assignModalOpen && (
        <AssignFeeModal
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          onSuccess={() => {
            setAssignModalOpen(false);
            fetchPayments();
          }}
        />
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <EditPaymentModal
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          payment={editingPayment}
          onSuccess={() => {
            setEditingPayment(null);
            fetchPayments();
          }}
        />
      )}

      {/* Universal Full-Page JPG Receipt Modal */}
      {receiptModalOpen && selectedReceiptData && (
        <JpgReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => {
            setReceiptModalOpen(false);
            setSelectedReceiptData(null);
          }}
          data={selectedReceiptData}
          type={selectedReceiptData.type || 'payment'}
        />
      )}
    </div>
  );
}