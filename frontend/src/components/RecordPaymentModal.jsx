/**
 * RecordPaymentModal — School Management System (Frontend)
 *
 * Modal for recording payments (Cash or In Account) with student selector,
 * quick fill buttons, live fee allocation breakdown, and PDF receipt download.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Save,
  Loader2,
  Search,
  User,
  CheckCircle,
  Clock,
  Download,
  IndianRupee,
  Calendar,
  Maximize2,
  Minimize2,
  CreditCard,
  Building,
  Banknote,
  Sparkles,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import WhatsAppDirectButton from './WhatsAppDirectButton';
import './RecordPaymentModal.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function RecordPaymentModal({ initialStudent = null, onClose, onSaved }) {
  const { toast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState(
    initialStudent ? `${initialStudent.admission_no || ''} - ${initialStudent.full_name || ''}` : ''
  );
  const [selectedStudent, setSelectedStudent] = useState(initialStudent);
  const [showDropdown, setShowDropdown] = useState(false);
  const [outstandingAmount, setOutstandingAmount] = useState(0);

  const [pendingMonthlyFees, setPendingMonthlyFees] = useState([]);
  const [pendingAdditionalFees, setPendingAdditionalFees] = useState([]);

  const [formData, setFormData] = useState({
    amount: '',
    payment_mode: 'CASH',
    payment_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [recordedPaymentSuccess, setRecordedPaymentSuccess] = useState(null);

  // Fetch active students list
  const fetchStudents = useCallback(async () => {
    try {
      const res = await api.get('/students?limit=1000');
      if (res.data.success) {
        const activeStudents = (res.data.students || []).filter(s => s.status === 'active');
        setStudents(activeStudents);
        setFilteredStudents(activeStudents);
      }
    } catch (err) {
      toast.error('Failed to load students.');
    }
  }, [toast]);

  // Fetch pending dues when student is selected
  const fetchOutstanding = async (studentId) => {
    try {
      const res = await api.get(`/students/${studentId}/profile`);
      if (res.data.success) {
        const monthly = (res.data.monthly_fees || []).filter(f => f.status !== 'PAID' && Number(f.due_amount) > 0);
        const additional = (res.data.additional_fees || []).filter(f => f.status !== 'PAID' && Number(f.due_amount) > 0);

        setPendingMonthlyFees(monthly);
        setPendingAdditionalFees(additional);

        const monthlyDue = monthly.reduce((sum, f) => sum + Number(f.due_amount || 0), 0);
        const additionalDue = additional.reduce((sum, f) => sum + Number(f.amount || 0), 0);
        const total = monthlyDue + additionalDue;
        setOutstandingAmount(total);
      }
    } catch (err) {
      setOutstandingAmount(0);
      setPendingMonthlyFees([]);
      setPendingAdditionalFees([]);
    }
  };

  useEffect(() => {
    fetchStudents();
    if (initialStudent?.id) {
      fetchOutstanding(initialStudent.id);
    }
  }, [fetchStudents, initialStudent]);

  // Filter student list
  useEffect(() => {
    const filtered = students.filter(s =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admission_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      (s.whatsapp_number && s.whatsapp_number.includes(searchQuery))
    );
    setFilteredStudents(filtered);
  }, [searchQuery, students]);

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSearchQuery(`${student.admission_no} - ${student.full_name}`);
    setShowDropdown(false);
    fetchOutstanding(student.id);
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({ ...prev, amount: value }));
    }
  };

  const handleQuickAmount = (val) => {
    setFormData(prev => ({ ...prev, amount: String(val) }));
  };

  // Calculate live payment allocation breakdown
  const calculateAllocationPreview = () => {
    let remaining = Number(formData.amount) || 0;
    if (remaining <= 0) return [];

    const preview = [];

    // 1. Allocate to Monthly Fees first (FIFO)
    for (const f of pendingMonthlyFees) {
      if (remaining <= 0) break;
      const due = Number(f.due_amount);
      const allocated = Math.min(remaining, due);
      remaining -= allocated;

      const monthName = MONTH_NAMES[f.fee_month - 1] || `Month ${f.fee_month}`;
      preview.push({
        title: `${monthName} ${f.fee_year} Monthly Fee`,
        dueAmount: due,
        allocatedAmount: allocated,
        isCleared: allocated >= due,
      });
    }

    // 2. Allocate to Additional Custom Fees next
    for (const f of pendingAdditionalFees) {
      if (remaining <= 0) break;
      const due = Number(f.amount);
      const allocated = Math.min(remaining, due);
      remaining -= allocated;

      preview.push({
        title: f.fee_type_name || f.description || 'Custom Fee',
        dueAmount: due,
        allocatedAmount: allocated,
        isCleared: allocated >= due,
      });
    }

    return preview;
  };

  const allocationPreview = calculateAllocationPreview();

  const validate = () => {
    if (!selectedStudent) return 'Please select a student.';
    if (!formData.amount || Number(formData.amount) <= 0) return 'Please enter a valid payment amount.';
    if (Number(formData.amount) > outstandingAmount && outstandingAmount > 0) {
      return `Payment amount (₹${Number(formData.amount).toLocaleString('en-IN')}) cannot exceed total outstanding balance (₹${outstandingAmount.toLocaleString('en-IN')}).`;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        student_id: selectedStudent.id,
        amount: Number(formData.amount),
        payment_mode: formData.payment_mode || 'CASH',
        payment_date: formData.payment_date,
        notes: formData.notes || undefined,
        recorded_by: 1,
      };

      const res = await api.post('/payments', payload);
      if (res.data.success) {
        toast.success(`Payment of ₹${Number(formData.amount).toLocaleString('en-IN')} recorded successfully via ${formData.payment_mode === 'IN_ACCOUNT' ? 'In Account' : 'Cash'}.`);
        setRecordedPaymentSuccess(res.data.payment || { id: res.data.paymentId, receipt_number: res.data.receiptNumber || 'REC' });
      }
    } catch (err) {
      console.error('[RecordPaymentModal.handleSubmit]', err);
      toast.error(err.response?.data?.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!recordedPaymentSuccess?.id) return;
    try {
      setDownloading(true);
      const res = await api.get(`/receipts/download/${recordedPaymentSuccess.id}`, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${recordedPaymentSuccess.receipt_number || recordedPaymentSuccess.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success('Payment receipt downloaded.');
    } catch (err) {
      toast.error('Failed to download receipt PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSuccessDone = () => {
    if (onSaved) onSaved();
    onClose();
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="record-payment-title">
      <div
        className={`modal record-payment-modal ${isFullscreen ? 'modal-fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="title-icon-badge">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 id="record-payment-title">
                {recordedPaymentSuccess ? 'Payment Recorded Successfully' : 'Record Student Fee Payment'}
              </h2>
              <p className="modal-subtitle">
                {formData.payment_mode === 'IN_ACCOUNT'
                  ? 'Bank / UPI / Online Payment Record'
                  : 'Direct Cash Collection & Instant Allocation'}
              </p>
            </div>
          </div>
          <div className="modal-header-actions">
            <button
              type="button"
              className="modal-icon-btn"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen View'}
              aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button className="modal-close" onClick={handleSuccessDone} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {recordedPaymentSuccess ? (
          /* Success Screen with Download Receipt Option */
          <div className="modal-body payment-success-body">
            <div className="success-icon-box">
              <CheckCircle size={60} className="success-check" />
            </div>
            <h3>Payment Recorded &amp; Allocated!</h3>
            <p className="success-desc">
              Payment of <strong>{formatCurrency(formData.amount)}</strong> received via{' '}
              <span className="success-mode-badge">{formData.payment_mode === 'IN_ACCOUNT' ? '🏦 In Account' : '💵 Cash'}</span> from <strong>{selectedStudent?.full_name}</strong>.
            </p>

            <div className="receipt-details-box">
              <div className="detail-row">
                <span>Receipt Number:</span>
                <code>{recordedPaymentSuccess.receipt_number || `RCP-${recordedPaymentSuccess.id}`}</code>
              </div>
              <div className="detail-row">
                <span>Amount Collected:</span>
                <strong>{formatCurrency(formData.amount)}</strong>
              </div>
              <div className="detail-row">
                <span>Payment Mode:</span>
                <span className="font-semibold">{formData.payment_mode === 'IN_ACCOUNT' ? 'In Account (Bank/Online)' : 'Cash (Hand)'}</span>
              </div>
              <div className="detail-row">
                <span>Payment Date:</span>
                <span>{formData.payment_date}</span>
              </div>
            </div>

            <div className="success-actions">
              <WhatsAppDirectButton
                onSend={() => api.post(`/receipts/send-whatsapp/${recordedPaymentSuccess.id}`)}
                phone={selectedStudent?.phone}
                defaultLabel="Send WhatsApp Receipt"
                successLabel="✓ WhatsApp Sent to Parent"
                size="lg"
              />
              <button
                type="button"
                className="btn btn-primary btn-lg download-receipt-btn"
                onClick={handleDownloadReceipt}
                disabled={downloading}
              >
                {downloading ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
                Download Official PDF Receipt
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSuccessDone}
              >
                Close &amp; Return
              </button>
            </div>
          </div>
        ) : (
          /* Payment Form */
          <form className="modal-body" onSubmit={handleSubmit}>
            {/* Student Selector */}
            <div className="form-group student-form-group">
              <label htmlFor="student_select">
                Student <span className="required">*</span>
              </label>
              <div className="student-selector">
                <div className="selector-input-wrapper">
                  <div className="input-prefix-icon">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    id="student_select"
                    className="styled-student-input"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => !selectedStudent && setShowDropdown(true)}
                    placeholder="Search student by Name, Admission No, or Phone…"
                    autoComplete="off"
                    readOnly={!!selectedStudent}
                  />
                  {selectedStudent && (
                    <button
                      type="button"
                      className="clear-selection-btn"
                      onClick={() => {
                        setSelectedStudent(null);
                        setSearchQuery('');
                        setOutstandingAmount(0);
                        setPendingMonthlyFees([]);
                        setPendingAdditionalFees([]);
                      }}
                      title="Clear and select another student"
                      aria-label="Clear selection"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {showDropdown && filteredStudents.length > 0 && !selectedStudent && (
                  <div className="student-dropdown" role="listbox">
                    {filteredStudents.slice(0, 10).map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className="dropdown-item"
                        onClick={() => handleStudentSelect(student)}
                        role="option"
                      >
                        <div className="student-avatar-mini">
                          <User size={16} />
                        </div>
                        <div className="dropdown-item-info">
                          <div className="dropdown-name-row">
                            <span className="dropdown-name">{student.full_name}</span>
                            <span className={`category-tag ${student.category || 'day_scholar'}`}>
                              {student.category === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
                            </span>
                          </div>
                          <span className="dropdown-meta">
                            Adm: <strong>{student.admission_no}</strong> • Class: {student.class_name || 'N/A'}{student.section_name ? `-${student.section_name}` : ''}
                            {student.phone ? ` • 📞 ${student.phone}` : ''}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Outstanding Balance Banner with Quick-Pay Full Dues */}
            {selectedStudent && (
              <div className={`outstanding-banner ${outstandingAmount === 0 ? 'zero-balance' : ''}`}>
                <div className="banner-left">
                  <div className="banner-icon-box">
                    <IndianRupee size={20} />
                  </div>
                  <div>
                    <span className="banner-title">Total Outstanding Dues</span>
                    <span className="banner-amount">{formatCurrency(outstandingAmount)}</span>
                  </div>
                </div>
                {outstandingAmount > 0 && (
                  <button
                    type="button"
                    className="quick-pay-all-btn"
                    onClick={() => handleQuickAmount(outstandingAmount)}
                  >
                    <Sparkles size={14} /> Pay Full Dues (₹{outstandingAmount.toLocaleString('en-IN')})
                  </button>
                )}
              </div>
            )}

            {/* Amount & Date */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="amount">
                  Payment Amount (₹) <span className="required">*</span>
                </label>
                <div className="input-with-icon-wrapper">
                  <div className="input-prefix-icon rupee-icon">
                    <IndianRupee size={18} />
                  </div>
                  <input
                    type="text"
                    id="amount"
                    name="amount"
                    className="styled-amount-input"
                    value={formData.amount}
                    onChange={handleAmountChange}
                    required
                    placeholder="Enter received amount (e.g. 3000)"
                    maxLength={10}
                  />
                </div>

                {/* Quick Amount Suggestion Pills */}
                {outstandingAmount > 0 && (
                  <div className="quick-amount-pills">
                    {[1000, 2000, 3000, 5000]
                      .filter(val => val < outstandingAmount)
                      .map(val => (
                        <button
                          key={val}
                          type="button"
                          className="amount-pill"
                          onClick={() => handleQuickAmount(val)}
                        >
                          +₹{val.toLocaleString('en-IN')}
                        </button>
                      ))}
                    <button
                      type="button"
                      className="amount-pill full-pill"
                      onClick={() => handleQuickAmount(outstandingAmount)}
                    >
                      Full ₹{outstandingAmount.toLocaleString('en-IN')}
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="payment_date">
                  Payment Date <span className="required">*</span>
                </label>
                <div className="input-with-icon-wrapper">
                  <div className="input-prefix-icon">
                    <Calendar size={18} />
                  </div>
                  <input
                    type="date"
                    id="payment_date"
                    name="payment_date"
                    className="styled-date-input"
                    value={formData.payment_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                    onClick={(e) => {
                      try {
                        if (typeof e.target.showPicker === 'function') {
                          e.target.showPicker();
                        }
                      } catch (err) {}
                    }}
                    max={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </div>
            </div>

            {/* Payment Channel / Mode (Cash vs In Account) */}
            <div className="form-group">
              <label className="section-label-bold">
                Payment Channel / Collection Mode <span className="required">*</span>
              </label>
              <div className="payment-mode-cards">
                {/* Mode 1: Cash (Hand) */}
                <button
                  type="button"
                  className={`mode-card ${formData.payment_mode === 'CASH' ? 'active-cash' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, payment_mode: 'CASH' }))}
                >
                  <div className="mode-card-header">
                    <div className="mode-badge-circle cash-circle">
                      <Banknote size={20} />
                    </div>
                    <div className="mode-text-box">
                      <span className="mode-card-title">Cash (Hand Collection)</span>
                      <span className="mode-card-sub">Physical cash received at fee counter</span>
                    </div>
                  </div>
                  <div className="mode-card-footer">
                    <span className="ledger-tag cash-tag">Ledger Remark: <strong>cash</strong></span>
                    {formData.payment_mode === 'CASH' && (
                      <span className="active-indicator">
                        <CheckCircle size={16} /> Selected
                      </span>
                    )}
                  </div>
                </button>

                {/* Mode 2: In Account */}
                <button
                  type="button"
                  className={`mode-card ${formData.payment_mode === 'IN_ACCOUNT' ? 'active-account' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, payment_mode: 'IN_ACCOUNT' }))}
                >
                  <div className="mode-card-header">
                    <div className="mode-badge-circle account-circle">
                      <Building size={20} />
                    </div>
                    <div className="mode-text-box">
                      <span className="mode-card-title">In Account (Bank / UPI / Online)</span>
                      <span className="mode-card-sub">Direct bank transfer, GooglePay, PhonePe, QR</span>
                    </div>
                  </div>
                  <div className="mode-card-footer">
                    <span className="ledger-tag account-tag">Ledger Remark: <strong>in acc.</strong></span>
                    {formData.payment_mode === 'IN_ACCOUNT' && (
                      <span className="active-indicator">
                        <CheckCircle size={16} /> Selected
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Live Allocation Preview Breakdown */}
            {allocationPreview.length > 0 && (
              <div className="allocation-preview-card">
                <div className="preview-header">
                  <div className="preview-title-wrap">
                    <Clock size={16} className="preview-clock" />
                    <span className="preview-header-title">
                      Live FIFO Fee Allocation Breakdown (₹{Number(formData.amount).toLocaleString('en-IN')} Received)
                    </span>
                  </div>
                  <span className="fifo-badge">Oldest Dues Cleared First</span>
                </div>
                <div className="preview-list">
                  {allocationPreview.map((item, idx) => (
                    <div key={idx} className={`preview-item ${item.isCleared ? 'cleared' : 'partial'}`}>
                      <div className="item-title">
                        {item.isCleared ? (
                          <CheckCircle size={16} className="cleared-icon" />
                        ) : (
                          <Clock size={16} className="partial-icon" />
                        )}
                        <span className="item-name">{item.title}</span>
                      </div>
                      <div className="item-amount">
                        <span className="allocated-tag">
                          Paid: <strong>{formatCurrency(item.allocatedAmount)}</strong>
                        </span>
                        <span className="due-tag">
                          (Total Due: {formatCurrency(item.dueAmount)})
                        </span>
                        {item.isCleared ? (
                          <span className="status-pill full-paid">Fully Cleared</span>
                        ) : (
                          <span className="status-pill partial-paid">Partially Paid</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="notes">Receipt Notes / Transaction Reference (Optional)</label>
              <textarea
                id="notes"
                name="notes"
                className="styled-notes-input"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                placeholder={formData.payment_mode === 'IN_ACCOUNT' ? 'e.g. UPI Ref #12345678, GooglePay payment from Father' : 'e.g. Cash handed over at fee counter'}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                <X size={16} /> Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-record-submit"
                disabled={saving || !selectedStudent || Number(formData.amount) <= 0}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="spin" /> Recording Payment…
                  </>
                ) : (
                  <>
                    <Save size={18} /> Confirm &amp; Record Payment
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}