/**
 * Receipts Page — School Management System (Frontend)
 *
 * Displays generated receipts with interactive summary KPIs,
 * dedicated "All Receipts" vs "🎓 Admission Receipts" tabs,
 * column sorting, inline JPG/PDF preview, and background WhatsApp direct messaging.
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
  GraduationCap,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import EditPaymentModal from '../components/EditPaymentModal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import WhatsAppDirectButton from '../components/WhatsAppDirectButton';
import JpgReceiptModal from '../components/JpgReceiptModal';
import { saveFileToDeviceStorage } from '../utils/fileDownloader';
import './Receipts.css';

export default function Receipts() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'admissions'
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
  const [downloadingId, setDownloadingId] = useState(null);
  const [expandedReceipts, setExpandedReceipts] = useState({});

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
  }, [activeTab, search, classFilter, categoryFilter, startDate, endDate, sortField, sortOrder, page, toast]);

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

  const handleView = async (receiptOrId) => {
    if (!receiptOrId) return;
    const paymentId = typeof receiptOrId === 'object'
      ? (receiptOrId.payment_id || receiptOrId.id || receiptOrId.receipt_number)
      : receiptOrId;

    try {
      setLoadingReceipt(true);
      const res = await api.get(`/receipts/${paymentId}`);
      if (res.data && res.data.success) {
        setSelectedReceipt({
          ...res.data,
          student: res.data.student || {
            full_name: receiptOrId.student_name || receiptOrId.full_name,
            admission_no: receiptOrId.admission_no,
            father_name: receiptOrId.father_name || receiptOrId.parent_name || '—',
            parent_name: receiptOrId.parent_name || receiptOrId.father_name || '—',
            class_name: receiptOrId.class_name,
            section_name: receiptOrId.section_name,
            phone: receiptOrId.phone || receiptOrId.whatsapp_number,
          },
          payment: res.data.payment || receiptOrId,
        });
        setViewModalOpen(true);
      } else {
        throw new Error(res.data?.message || 'Receipt data incomplete');
      }
    } catch (err) {
      console.warn('[Receipts.handleView] Using row data fallback:', err.message);
      if (typeof receiptOrId === 'object') {
        setSelectedReceipt({
          school: {
            school_name: 'Aryavart Shikshan Sansthan',
            phone: '+91-9876543210',
            address: 'Knowledge Campus, Main Road',
          },
          receipt: {
            id: receiptOrId.id,
            receipt_number: receiptOrId.receipt_number || `RCP-${receiptOrId.payment_id || receiptOrId.id}`,
            file_path: receiptOrId.file_path,
            created_at: receiptOrId.generated_at || receiptOrId.payment_date,
          },
          payment: {
            id: receiptOrId.payment_id || receiptOrId.id,
            amount: receiptOrId.amount,
            payment_date: receiptOrId.payment_date,
            payment_mode: receiptOrId.payment_mode,
            notes: receiptOrId.notes,
            father_name: receiptOrId.father_name || receiptOrId.parent_name || '—',
          },
          student: {
            full_name: receiptOrId.student_name || receiptOrId.full_name,
            admission_no: receiptOrId.admission_no,
            father_name: receiptOrId.father_name || receiptOrId.parent_name || '—',
            parent_name: receiptOrId.parent_name || receiptOrId.father_name || '—',
            class_name: receiptOrId.class_name,
            section_name: receiptOrId.section_name,
            category: receiptOrId.student_category,
            phone: receiptOrId.phone || receiptOrId.whatsapp_number,
          },
          allocations: [],
          summary: { total_amount: receiptOrId.amount },
        });
        setViewModalOpen(true);
      } else {
        toast.error(err.response?.data?.message || 'Failed to fetch receipt details.');
      }
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handleDownload = async (paymentId, rNo) => {
    try {
      setDownloadingId(paymentId);
      const res = await api.get(`/receipts/download/${paymentId}`, {
        responseType: 'blob',
      });
      const filename = `Receipt_${rNo || paymentId}.pdf`;
      const saveRes = await saveFileToDeviceStorage({
        data: res.data,
        filename,
        mimeType: 'application/pdf',
      });
      if (saveRes?.platform === 'native') {
        toast.success(`✓ Receipt PDF Saved to Phone Storage (Documents/${filename})`);
      } else {
        toast.success('Receipt PDF downloaded successfully.');
      }
    } catch (err) {
      console.error('[Receipts.handleDownload]', err);
      toast.error(err.response?.data?.message || 'Failed to download receipt PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="receipts-page">
      {/* Header Banner Card */}
      <div className="receipts-header-card">
        <div className="header-left-info">
          <div className="receipts-icon-badge">
            <Receipt size={26} />
          </div>
          <div>
            <h1 className="receipts-title">Official Receipts Desk</h1>
            <p className="receipts-subtitle">
              Browse, view high-res JPG receipts, dispatch background WhatsApp messages, and audit collections.
            </p>
          </div>
        </div>
        <div className="header-actions-group">
          <button
            type="button"
            className="btn-record-pay"
            onClick={() => setRecordPaymentOpen(true)}
          >
            <Plus size={16} /> Record Payment
          </button>
          <button
            type="button"
            className="btn-refresh"
            onClick={fetchReceipts}
            disabled={loading}
            title="Refresh receipts"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tab Switcher: Monthly Receipts vs Admission Receipts */}
      <div className="receipts-tab-nav-bar">
        <button
          type="button"
          className={`tab-nav-pill ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('monthly');
            setPage(1);
          }}
        >
          <Receipt size={16} />
          <span>📅 Monthly Fee Receipts</span>
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
          <span>🎓 Admission Receipts</span>
          {activeTab === 'admissions' && <span className="tab-count-badge">{totalRecords}</span>}
        </button>
      </div>

      {/* Filters Card */}
      <div className="receipts-filters-card">
        <div className="search-box-wrap">
          <div className="search-prefix-icon">
            <Search size={18} />
          </div>
          <input
            type="search"
            className="receipts-search-input"
            placeholder="Search by student name, admission no, receipt # or phone…"
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

        <div className="filter-controls-grid">
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

      {/* Receipts Table Card */}
      <div className="receipts-table-card">
        <div className="table-header-bar">
          <div className="table-header-left">
            <h2 className="table-title">
              {activeTab === 'admissions' ? '🎓 Official Admission Receipts' : 'Official Fee Receipts Registry'}
            </h2>
            <span className="records-pill">{totalRecords} Records</span>
          </div>
        </div>

        {loading ? (
          <div className="receipts-loading-state">
            <Loader2 size={32} className="spin" />
            <p>Loading {activeTab === 'admissions' ? 'admission receipts' : 'receipts registry'}…</p>
          </div>
        ) : error ? (
          <div className="receipts-error-state">
            <p className="error-msg">{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={fetchReceipts}>
              Retry
            </button>
          </div>
        ) : receipts.length === 0 ? (
          <div className="receipts-empty-state">
            <div className="empty-icon-wrap">
              {activeTab === 'admissions' ? <GraduationCap size={48} /> : <Receipt size={48} />}
            </div>
            <h3>No {activeTab === 'admissions' ? 'Admission' : ''} Receipts Found</h3>
            <p>
              {search || classFilter || startDate || endDate
                ? 'Try adjusting your search criteria or date filters.'
                : activeTab === 'admissions'
                ? 'No admission receipts have been generated yet.'
                : 'No receipts have been recorded yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="table-responsive receipts-table-wrapper">
              <table className="receipts-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('payment_date')}>
                      <div className="th-content">
                        <span>Receipt Date</span>
                        {renderSortIcon('payment_date')}
                      </div>
                    </th>
                    <th>Receipt No</th>
                    <th className="sortable" onClick={() => handleSort('student_name')}>
                      <div className="th-content">
                        <span>Student &amp; Adm No</span>
                        {renderSortIcon('student_name')}
                      </div>
                    </th>
                    <th>Class</th>
                    <th>Receipt Type</th>
                    <th className="sortable text-right" onClick={() => handleSort('amount')}>
                      <div className="th-content justify-end">
                        <span>Amount Paid</span>
                        {renderSortIcon('amount')}
                      </div>
                    </th>
                    <th>Mode</th>
                    <th>Notes</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => {
                    const paymentId = r.payment_id || r.id;
                    const rNo = r.receipt_number || `RCP-${String(paymentId).padStart(6, '0')}`;
                    const modeStr = (r.payment_mode || 'CASH').toLowerCase();
                    const isAdmission = r.payment_category === 'ADMISSION_CHARGE' || (r.notes && r.notes.includes('Admission')) || rNo.startsWith('ADM');

                    return (
                      <tr key={r.id} className="receipt-row">
                        <td className="receipt-date-cell">
                          {r.payment_date
                            ? new Date(r.payment_date).toLocaleDateString('en-IN', {
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
                            onClick={() => handleView(r)}
                            title="View Full-Page JPG Receipt"
                          >
                            <Receipt size={13} />
                            <span>{rNo}</span>
                          </button>
                        </td>
                        <td className="student-cell">
                          {(r.is_family || rNo.startsWith('FAM') || (r.notes && r.notes.includes('Family Receipt'))) ? (
                            <div className="family-student-cell-stack">
                              <div className="family-badge-toggle-row">
                                <span className="family-pill-mini">👨‍👧‍👦 Family Receipt</span>
                                {r.notes && (
                                  <button
                                    type="button"
                                    className="btn-sibling-toggle"
                                    onClick={() => setExpandedReceipts(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                                    title={expandedReceipts[r.id] ? 'Hide note' : 'View receipt details'}
                                  >
                                    {expandedReceipts[r.id] ? 'Hide' : '👁️ View'}
                                  </button>
                                )}
                              </div>
                              <span className="student-name font-bold">{r.full_name || r.student_name || '—'}</span>
                              <span className="student-adm-no font-mono">{r.admission_no || '—'}</span>
                              {expandedReceipts[r.id] && r.notes && (
                                <div className="sibling-drawer-content">
                                  <span className="sibling-meta-chip">{r.notes}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="student-name-block">
                              <span className="student-name font-bold">{r.full_name || r.student_name || '—'}</span>
                              <span className="student-adm-no font-mono">{r.admission_no || '—'}</span>
                            </div>
                          )}
                        </td>
                        <td className="class-cell">
                          <span className="class-badge">
                            {r.class_name ? `${r.class_name}${r.section_name ? `-${r.section_name}` : ''}` : '—'}
                          </span>
                        </td>
                        <td className="type-cell">
                          {isAdmission ? (
                            <span className="adm-receipt-badge">
                              <GraduationCap size={12} /> Admission
                            </span>
                          ) : (
                            <span className="tuition-receipt-badge">
                              <Receipt size={12} /> Tuition Fee
                            </span>
                          )}
                        </td>
                        <td className="amount-cell text-right">
                          <span className="amount-val-badge">
                            {formatCurrency(r.amount)}
                          </span>
                        </td>
                        <td className="mode-cell">
                          {modeStr.includes('account') || modeStr.includes('bank') || modeStr.includes('online') || modeStr.includes('in_account') ? (
                            <span className="remark-in-account">in acc.</span>
                          ) : (
                            <span className="remark-cash">cash</span>
                          )}
                        </td>
                        <td className="notes-cell" title={r.notes || ''}>
                          {r.notes || <span className="text-muted">—</span>}
                        </td>
                        <td className="actions-cell text-center">
                          <div className="action-btns">
                            <button
                              type="button"
                              className="btn-action view"
                              onClick={() => handleView(r)}
                              title="Print & View Official JPG Receipt"
                            >
                              <Printer size={13} /> Print / JPG
                            </button>
                            <WhatsAppDirectButton
                              compact
                              size="sm"
                              onSend={() => api.post(`/receipts/send-whatsapp/${paymentId}`)}
                              onOpenJpg={() => handleView(r)}
                              phone={r.phone || r.whatsapp_number}
                              itemTitle="Receipt"
                            />
                            <button
                              type="button"
                              className="btn-action download"
                              onClick={() => handleDownload(paymentId, rNo)}
                              disabled={downloadingId === paymentId}
                              title="Download PDF Receipt"
                            >
                              {downloadingId === paymentId ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              className="btn-action edit"
                              onClick={() => setEditingPayment(r)}
                              title="Edit Payment Record"
                            >
                              <Edit2 size={13} />
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
              <div className="receipts-pagination">
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
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          payment={{
            ...editingPayment,
            id: editingPayment.payment_id || editingPayment.id,
          }}
          onSuccess={() => {
            setEditingPayment(null);
            fetchReceipts();
          }}
        />
      )}

      {/* Universal Full-Page JPG Receipt Modal */}
      {viewModalOpen && selectedReceipt && (
        <JpgReceiptModal
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false);
            setSelectedReceipt(null);
          }}
          data={selectedReceipt}
          type={selectedReceipt.type || 'payment'}
        />
      )}
    </div>
  );
}
