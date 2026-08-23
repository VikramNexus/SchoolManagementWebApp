/**
 * Payments Page — School Management System (Frontend)
 *
 * Displays fee collections ledger with summary KPI cards,
 * column sorting, allocation breakdown, receipt download, payment editing,
 * and reversible payment deletion with student ledger balance restoration.
 */

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import CashCollectionSummary from '../components/CashCollectionSummary';
import RecordPaymentModal from '../components/RecordPaymentModal';
import AssignFeeModal from '../components/AssignFeeModal';
import EditPaymentModal from '../components/EditPaymentModal';
import JpgReceiptModal from '../components/JpgReceiptModal';
import './Payments.css';

export default function Payments() {
  const { toast } = useToast();
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

      const [historyRes, summaryRes] = await Promise.all([
        api.get(`/payments?${params.toString()}`),
        api.get(`/payments/summary?${startDate ? `start_date=${startDate}&` : ''}${endDate ? `end_date=${endDate}` : ''}`),
      ]);

      if (historyRes.data.success) {
        setPayments(historyRes.data.payments || []);
        setTotalRecords(historyRes.data.pagination?.total || 0);
        setTotalPages(historyRes.data.pagination?.totalPages || 1);
        setTotalAmount(historyRes.data.summary?.total_amount || 0);
      }

      if (summaryRes.data.success) {
        setSummaryData(summaryRes.data.summary || null);
      }
    } catch (err) {
      console.error('[Payments.fetchPayments]', err);
      const msg = err.response?.data?.message || 'Failed to fetch payment history.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [search, classFilter, categoryFilter, startDate, endDate, sortField, sortOrder, page, toast]);

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

  const handleViewReceipt = async (paymentId) => {
    try {
      setLoadingReceiptId(paymentId);
      const res = await api.get(`/receipts/${paymentId}`);
      if (res.data.success) {
        setSelectedReceiptData(res.data);
        setReceiptModalOpen(true);
      }
    } catch (err) {
      toast.error('Failed to load receipt details.');
    } finally {
      setLoadingReceiptId(null);
    }
  };

  return (
    <div className="payments-page">
      {/* Header Card */}
      <div className="payments-header-card">
        <div className="header-left-info">
          <div className="payments-icon-badge">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="payments-title">Payment Collections Ledger</h1>
            <p className="payments-subtitle">
              Track fee collections, manage cash / in-account entries, and audit allocations.
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

        <div className="filter-controls-group">
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

          {(search || classFilter || categoryFilter || startDate || endDate) && (
            <button
              type="button"
              className="btn btn-secondary clear-filters-btn"
              onClick={() => {
                setSearch('');
                setClassFilter('');
                setCategoryFilter('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
            >
              <X size={14} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchPayments}>
            Retry
          </button>
        </div>
      )}

      {/* Payments Table Card */}
      <div className="payments-table-card">
        <div className="table-header-bar">
          <div className="table-header-left">
            <span className="table-title">Collections Register</span>
            <span className="records-pill">{totalRecords} transactions</span>
          </div>
          <div className="table-header-right">
            <span className="filtered-total-text">
              Filtered Total: <strong>{formatCurrency(totalAmount)}</strong>
            </span>
          </div>
        </div>

        <div className="table-responsive-wrapper">
          <table className="payments-data-table">
            <thead>
              <tr>
                <th className="sortable-th col-receipt" onClick={() => handleSort('receipt_number')}>
                  Receipt # {renderSortIcon('receipt_number')}
                </th>
                <th className="sortable-th col-date" onClick={() => handleSort('payment_date')}>
                  Date {renderSortIcon('payment_date')}
                </th>
                <th className="sortable-th col-student" onClick={() => handleSort('student_name')}>
                  Student Name {renderSortIcon('student_name')}
                </th>
                <th className="col-adm">Adm No</th>
                <th className="col-class">Class</th>
                <th className="col-category">Category</th>
                <th className="sortable-th col-amount text-right" onClick={() => handleSort('amount')}>
                  Amount (₹) {renderSortIcon('amount')}
                </th>
                <th className="col-mode">Mode</th>
                <th className="col-recorder">Recorder</th>
                <th className="col-actions text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-loading">
                    <Loader2 size={24} className="spin" />
                    <span>Loading payment records…</span>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-payments-state">
                      <div className="empty-icon-wrap">
                        <CreditCard size={40} />
                      </div>
                      <h3>No Payment Records Found</h3>
                      <p>
                        No fee payments matched your search or filters. Click below to record a new fee payment.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setRecordModalOpen(true)}
                      >
                        <Plus size={16} /> Record Payment Now
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="col-receipt">
                      <code className="receipt-code-pill">{p.receipt_no || p.receipt_number || `RCP-${p.id}`}</code>
                    </td>
                    <td className="col-date date-text">
                      {new Date(p.payment_date || p.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="col-student">
                      <strong className="student-name-text">{p.student_name}</strong>
                    </td>
                    <td className="col-adm">
                      <code className="adm-code">{p.student_admission_no || p.admission_no}</code>
                    </td>
                    <td className="col-class">
                      <span className="class-badge">
                        {p.class_name ? `${p.class_name}${p.section_name ? `-${p.section_name}` : ''}` : '—'}
                      </span>
                    </td>
                    <td className="col-category">
                      <span className={`category-badge ${p.student_category}`}>
                        {p.student_category === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
                      </span>
                    </td>
                    <td className="col-amount text-right amount-cell">
                      <strong>{formatCurrency(p.amount)}</strong>
                    </td>
                    <td className="col-mode">
                      <span className={`mode-pill ${(p.payment_mode || 'CASH').toLowerCase().includes('account') ? 'account' : 'cash'}`}>
                        {(p.payment_mode || 'CASH').toLowerCase().includes('account') ? '🏦 In Account' : '💵 Cash'}
                      </span>
                    </td>
                    <td className="col-recorder recorder-text">
                      {p.recorder_name || p.recorder_username || 'Admin'}
                    </td>
                    <td className="col-actions">
                      <div className="action-btns">
                        <button
                          type="button"
                          className="btn-action receipt-btn"
                          onClick={() => handleViewReceipt(p.id)}
                          disabled={loadingReceiptId === p.id}
                          title="View & Download Official JPG Receipt & WhatsApp Share"
                        >
                          {loadingReceiptId === p.id ? <Loader2 size={13} className="spin" /> : <Receipt size={13} />}
                          <span>Receipt</span>
                        </button>
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
                          title="Edit Payment"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-action delete"
                          onClick={() => setDeletingPayment(p)}
                          title="Delete Payment & Restore Dues"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="page-info-text">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalRecords} total items)
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {recordModalOpen && (
        <RecordPaymentModal
          onClose={() => setRecordModalOpen(false)}
          onSaved={() => {
            setRecordModalOpen(false);
            fetchPayments();
          }}
        />
      )}

      {/* Assign Fee Modal */}
      {assignModalOpen && (
        <AssignFeeModal
          onClose={() => setAssignModalOpen(false)}
          onSaved={() => {
            setAssignModalOpen(false);
            fetchPayments();
          }}
        />
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
          onSaved={() => {
            setEditingPayment(null);
            fetchPayments();
          }}
        />
      )}

      {/* Delete Payment Confirmation Modal */}
      {deletingPayment && (
        <div className="modal-overlay" onClick={() => !isDeleting && setDeletingPayment(null)}>
          <div className="modal modal-md delete-payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-header">
              <div className="modal-title-wrap">
                <div className="delete-icon-badge">
                  <AlertTriangle size={20} />
                </div>
                <h2>Delete Payment Record</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => !isDeleting && setDeletingPayment(null)}
                disabled={isDeleting}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="delete-warning-banner">
                <p>
                  Are you sure you want to delete this payment? This action will:
                </p>
                <ul>
                  <li><strong>Revert the payment</strong> from the database.</li>
                  <li><strong>Restore outstanding dues</strong> back onto the student's profile and fee ledger.</li>
                  <li><strong>Delete the generated receipt</strong> and remove its PDF file.</li>
                </ul>
              </div>

              <div className="payment-delete-preview">
                <div className="preview-row">
                  <span className="preview-label">Student Name:</span>
                  <strong>{deletingPayment.student_name}</strong>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Admission No:</span>
                  <code>{deletingPayment.student_admission_no || deletingPayment.admission_no}</code>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Receipt Number:</span>
                  <code className="receipt-code-pill">{deletingPayment.receipt_no || deletingPayment.receipt_number || `RCP-${deletingPayment.id}`}</code>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Payment Amount:</span>
                  <strong className="text-danger">{formatCurrency(deletingPayment.amount)}</strong>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Payment Date:</span>
                  <span>{new Date(deletingPayment.payment_date || deletingPayment.created_at).toLocaleDateString('en-IN')}</span>
                </div>
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
                className="btn btn-danger btn-confirm-delete"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="spin" /> Deleting &amp; Restoring Dues…
                  </>
                ) : (
                  <>
                    <Trash2 size={16} /> Yes, Delete Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Details Modal */}
      {detailsModalOpen && (
        <div className="modal-overlay" onClick={() => setDetailsModalOpen(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Receipt size={20} className="modal-receipt-icon" />
                <h2>Payment Allocation Breakdown</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDetailsModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {loadingDetails || !selectedPaymentDetails ? (
                <div className="modal-loading">
                  <Loader2 size={24} className="spin" />
                  <span>Loading allocation breakdown…</span>
                </div>
              ) : (
                <div className="payment-details-content">
                  <div className="detail-meta-grid">
                    <div>
                      <span className="meta-label">Receipt Number</span>
                      <code className="receipt-code-pill">
                        {selectedPaymentDetails.payment?.receipt_number || selectedPaymentDetails.payment?.receipt_no}
                      </code>
                    </div>
                    <div>
                      <span className="meta-label">Student Name</span>
                      <strong>{selectedPaymentDetails.payment?.full_name || selectedPaymentDetails.payment?.student_name}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Amount Collected</span>
                      <strong className="text-success text-lg">{formatCurrency(selectedPaymentDetails.payment?.amount)}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Payment Mode</span>
                      <span className="font-semibold">
                        {(selectedPaymentDetails.payment?.payment_mode || 'CASH').toLowerCase().includes('account')
                          ? '🏦 In Account'
                          : '💵 Cash'}
                      </span>
                    </div>
                  </div>

                  <h4 className="allocation-section-title">Settled Monthly Fees &amp; Charges</h4>
                  {selectedPaymentDetails.allocations.length === 0 ? (
                    <p className="empty-text">No specific monthly allocations linked to this payment.</p>
                  ) : (
                    <table className="data-table compact allocation-table">
                      <thead>
                        <tr>
                          <th>Fee Period / Item</th>
                          <th className="text-right">Total Due</th>
                          <th className="text-right">Allocated Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPaymentDetails.allocations.map((a, i) => (
                          <tr key={i}>
                            <td>
                              <strong>
                                {a.fee_month
                                  ? `${formatMonthName(a.fee_month, a.fee_year)} Monthly Fee`
                                  : (a.description || 'Custom Fee')}
                              </strong>
                            </td>
                            <td className="text-right">{formatCurrency(a.fee_amount || a.amount)}</td>
                            <td className="text-right text-success font-semibold">{formatCurrency(a.allocated_amount)}</td>
                            <td>
                              <span className="status-pill full-paid">Cleared</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal JPG Receipt Modal with WhatsApp Sharing & JPG Download */}
      <JpgReceiptModal
        isOpen={receiptModalOpen && !!selectedReceiptData}
        onClose={() => {
          setReceiptModalOpen(false);
          setSelectedReceiptData(null);
        }}
        data={selectedReceiptData}
        type="payment"
      />
    </div>
  );
}