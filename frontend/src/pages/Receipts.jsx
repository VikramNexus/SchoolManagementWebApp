/**
 * Receipts Page — School Management System (Frontend)
 *
 * Displays generated receipts with interactive summary KPIs,
 * column sorting, inline viewing, PDF download, and payment creation/editing.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  FileText,
  RefreshCw,
  X,
  Edit2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Receipt,
  IndianRupee,
  Calendar,
  Plus,
  Printer,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import EditPaymentModal from '../components/EditPaymentModal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import WhatsAppDirectButton from '../components/WhatsAppDirectButton';
import JpgReceiptModal from '../components/JpgReceiptModal';
import './Receipts.css';

export default function Receipts() {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Dropdown data
  const [classes, setClasses] = useState([]);

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);

  // Fetch classes
  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await api.get('/settings/classes');
        if (res.data.success) {
          setClasses(res.data.classes || []);
        }
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    }
    fetchClasses();
  }, []);

  // Fetch receipts
  const fetchReceipts = useCallback(async () => {
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

      const res = await api.get(`/receipts?${params.toString()}`);

      if (res.data.success) {
        setReceipts(res.data.receipts || []);
        setTotalRecords(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('[Receipts.fetchReceipts]', err);
      const msg = err.response?.data?.message || 'Failed to fetch receipts.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [search, classFilter, categoryFilter, startDate, endDate, sortField, sortOrder, page, toast]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const [downloadingId, setDownloadingId] = useState(null);

  const handleView = async (paymentId) => {
    try {
      setLoadingReceipt(true);
      setViewModalOpen(true);
      const res = await api.get(`/receipts/${paymentId}`);
      if (res.data.success) {
        setSelectedReceipt(res.data);
      }
    } catch (err) {
      toast.error('Failed to fetch receipt details.');
      setViewModalOpen(false);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handleGenerate = async (paymentId) => {
    try {
      setGeneratingId(paymentId);
      const res = await api.post(`/receipts/generate/${paymentId}`);
      if (res.data.success) {
        toast.success('Receipt generated successfully.');
        fetchReceipts();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate receipt.');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDownload = async (paymentId, receiptNo = '') => {
    try {
      setDownloadingId(paymentId);
      const res = await api.get(`/receipts/download/${paymentId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${receiptNo || paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Receipt PDF downloaded successfully.');
      fetchReceipts();
    } catch (err) {
      console.error('[handleDownload]', err);
      toast.error('Failed to download receipt PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const totalSum = receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pdfGeneratedCount = receipts.filter(r => !!r.file_path).length;

  return (
    <div className="receipts-page">
      {/* Header with Quick Actions */}
      <div className="receipts-header-card">
        <div className="header-left-info">
          <div className="receipts-icon-badge">
            <Receipt size={24} />
          </div>
          <div>
            <h1 className="receipts-title">Fee Receipts Ledger</h1>
            <p className="receipts-subtitle">
              Manage, search, preview, and download official PDF fee payment receipts.
            </p>
          </div>
        </div>
        <div className="header-actions-group">
          <button
            type="button"
            className="btn btn-primary btn-record-pay"
            onClick={() => setRecordPaymentOpen(true)}
          >
            <Plus size={16} /> Record Payment
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-refresh"
            onClick={fetchReceipts}
            disabled={loading}
            title="Refresh receipts list"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="receipts-kpi-grid">
        <div className="receipt-kpi-card">
          <div className="kpi-icon-wrap blue">
            <Receipt size={20} />
          </div>
          <div className="kpi-text">
            <span className="kpi-label">Total Receipts Issued</span>
            <span className="kpi-value">{totalRecords}</span>
          </div>
        </div>

        <div className="receipt-kpi-card">
          <div className="kpi-icon-wrap green">
            <IndianRupee size={20} />
          </div>
          <div className="kpi-text">
            <span className="kpi-label">Total Amount Paid</span>
            <span className="kpi-value text-green">{formatCurrency(totalSum)}</span>
          </div>
        </div>

        <div className="receipt-kpi-card">
          <div className="kpi-icon-wrap purple">
            <FileText size={20} />
          </div>
          <div className="kpi-text">
            <span className="kpi-label">PDF Receipts Generated</span>
            <span className="kpi-value">{pdfGeneratedCount} / {receipts.length}</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="receipts-filters-card">
        <div className="search-box-wrap">
          <div className="search-prefix-icon">
            <Search size={18} />
          </div>
          <input
            type="search"
            className="receipts-search-input"
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchReceipts}>
            Retry
          </button>
        </div>
      )}

      {/* Receipts Table */}
      <div className="receipts-table-card">
        <div className="table-header-bar">
          <div className="table-header-left">
            <span className="table-title">Generated Receipts</span>
            <span className="records-pill">{totalRecords} records</span>
          </div>
        </div>

        <div className="table-responsive-wrapper">
          <table className="receipts-data-table">
            <thead>
              <tr>
                <th className="sortable-th" onClick={() => handleSort('receipt_number')}>
                  Receipt # {renderSortIcon('receipt_number')}
                </th>
                <th className="sortable-th" onClick={() => handleSort('payment_date')}>
                  Payment Date {renderSortIcon('payment_date')}
                </th>
                <th className="sortable-th" onClick={() => handleSort('student_name')}>
                  Student Name {renderSortIcon('student_name')}
                </th>
                <th>Admission No</th>
                <th>Class / Sec</th>
                <th>Category</th>
                <th className="sortable-th text-right" onClick={() => handleSort('amount')}>
                  Amount (₹) {renderSortIcon('amount')}
                </th>
                <th>Payment Mode</th>
                <th>PDF Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && receipts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-loading">
                    <Loader2 size={24} className="spin" />
                    <span>Loading fee receipts…</span>
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-receipts-state">
                      <div className="empty-icon-wrap">
                        <Receipt size={40} />
                      </div>
                      <h3>No Receipts Found</h3>
                      <p>
                        No fee payment receipts matched your filter criteria. Record a student fee payment to generate official receipts.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setRecordPaymentOpen(true)}
                      >
                        <Plus size={16} /> Record Payment Now
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.payment_id}>
                    <td>
                      <code className="receipt-code-pill">{r.receipt_number || `RCP-${r.payment_id}`}</code>
                    </td>
                    <td className="date-text">
                      {new Date(r.payment_date || r.generated_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <strong className="student-name-text">{r.student_name}</strong>
                    </td>
                    <td>
                      <code className="adm-code">{r.admission_no}</code>
                    </td>
                    <td>
                      <span className="class-badge">
                        {r.class_name ? `${r.class_name}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`category-badge ${r.student_category}`}>
                        {r.student_category === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
                      </span>
                    </td>
                    <td className="amount-cell text-right">
                      <strong>{formatCurrency(r.amount)}</strong>
                    </td>
                    <td>
                      <span className={`mode-pill ${(r.payment_mode || 'CASH').toLowerCase().includes('account') ? 'account' : 'cash'}`}>
                        {(r.payment_mode || 'CASH').toLowerCase().includes('account') ? '🏦 In Account' : '💵 Cash'}
                      </span>
                    </td>
                    <td>
                      {r.file_path ? (
                        <span className="status-badge active">
                          <CheckCircle size={12} /> Ready
                        </span>
                      ) : (
                        <span className="status-badge pending">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          type="button"
                          className="btn-action view"
                          onClick={() => handleView(r.payment_id)}
                          title="View Receipt Details"
                        >
                          <Eye size={15} /> View
                        </button>
                        <button
                          type="button"
                          className="btn-action edit"
                          onClick={() => setEditingPayment(r)}
                          title="Edit Payment Information"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-action generate"
                          onClick={() => handleGenerate(r.payment_id)}
                          disabled={generatingId === r.payment_id}
                          title="Generate Branded PDF Receipt"
                        >
                          {generatingId === r.payment_id ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <FileText size={14} />
                          )}
                        </button>
                        <WhatsAppDirectButton
                          compact
                          size="sm"
                          onSend={() => api.post(`/receipts/send-whatsapp/${r.payment_id}`)}
                          phone={r.phone}
                        />
                        <button
                          type="button"
                          className="btn-action download"
                          onClick={() => handleDownload(r.payment_id, r.receipt_number)}
                          disabled={downloadingId === r.payment_id}
                          title="Download Official PDF Receipt"
                        >
                          {downloadingId === r.payment_id ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <Download size={14} />
                          )}
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
      {recordPaymentOpen && (
        <RecordPaymentModal
          onClose={() => setRecordPaymentOpen(false)}
          onSaved={() => {
            setRecordPaymentOpen(false);
            fetchReceipts();
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
            fetchReceipts();
          }}
        />
      )}

      {/* Universal JPG Receipt Modal with WhatsApp Sharing & JPG Download */}
      <JpgReceiptModal
        isOpen={viewModalOpen && !loadingReceipt && !!selectedReceipt}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedReceipt(null);
        }}
        data={selectedReceipt}
        type="payment"
      />
    </div>
  );
}
