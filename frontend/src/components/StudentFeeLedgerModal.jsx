/**
 * StudentFeeLedgerModal Component — School Management System
 * Complete Monthly Fee Ledger & Account Statement Generator (High-Res JPG + WhatsApp Share)
 */

import React, { useRef, useState } from 'react';
import {
  Download,
  Share2,
  Printer,
  X,
  Loader2,
  Receipt,
  GraduationCap,
  MessageCircle,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  IndianRupee,
  FileText,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { downloadElementAsJpg, shareReceiptViaWhatsApp } from '../utils/receiptGenerator';
import { useToast } from './Toast';
import './StudentFeeLedgerModal.css';

export default function StudentFeeLedgerModal({
  isOpen,
  onClose,
  student = {},
  monthlyLedger = [],
  paymentHistory = [],
  totals = {},
}) {
  const ledgerRef = useRef(null);
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!isOpen || !student) return null;

  const totalAssessed = totals.total_assessed || totals.total_due || 0;
  const totalPaid = totals.total_paid || 0;
  const netBalance = Math.max(0, totalAssessed - totalPaid);
  const isFullyCleared = totalAssessed > 0 && netBalance === 0;

  const parentPhone = student.phone || student.father_phone || student.contact_no || '';

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const res = await api.get(`/students/${student.id}/ledger-pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Fee_Ledger_Statement_${student.admission_no || student.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Official PDF Statement downloaded!');
    } catch (err) {
      console.error('[Download Statement PDF]', err);
      toast.error('Failed to download statement PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadJpg = async () => {
    if (!ledgerRef.current) return;
    setDownloading(true);
    try {
      const filename = `Fee_Statement_${student.admission_no || 'Student'}_${student.full_name || ''}`;
      await downloadElementAsJpg(ledgerRef.current, filename);
      toast.success('Fee Statement downloaded as JPG successfully!');
    } catch (err) {
      console.error('[Download Statement JPG]', err);
      toast.error('Failed to export statement image');
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!ledgerRef.current) return;
    setSharing(true);
    try {
      // First try direct backend dispatch
      try {
        const res = await api.post(`/students/${student.id}/send-ledger-whatsapp`);
        if (res.data?.success) {
          if (res.data.direct_link) {
            window.open(res.data.direct_link, '_blank');
          }
          toast.success(res.data.message || 'Dispatched statement to parent on WhatsApp!');
          setSharing(false);
          return;
        }
      } catch (beErr) {
        console.log('[Backend WhatsApp fallback to client share]', beErr);
      }

      const statementText = (
        `🏫 *Aryavart Shikshan Sansthan — Fee Account Statement*\n\n` +
        `Dear Parent,\nHere is the official fee statement for *${student.full_name}* (Class: ${student.class_name || 'N/A'}, Adm No: ${student.admission_no || 'N/A'}).\n\n` +
        `📊 *Total Fees Assessed:* ₹${totalAssessed.toLocaleString('en-IN')}\n` +
        `✅ *Total Fees Paid:* ₹${totalPaid.toLocaleString('en-IN')}\n` +
        `📌 *Outstanding Dues:* ₹${netBalance.toLocaleString('en-IN')}\n` +
        `📋 *Status:* ${isFullyCleared ? '🟢 ALL FEES CLEARED' : '⚠️ PAYMENT DUE'}\n\n` +
        `📅 Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n` +
        `_Aryavart Shikshan Sansthan_`
      );

      await shareReceiptViaWhatsApp({
        element: ledgerRef.current,
        phone: parentPhone,
        studentName: student.full_name,
        customText: statementText,
      });
      toast.success('Opening WhatsApp share...');
    } catch (err) {
      console.error('[Share Statement WhatsApp]', err);
      toast.error('Failed to share statement via WhatsApp');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="jpg-receipt-overlay" onClick={onClose}>
      <div className="jpg-receipt-modal-card ledger-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="jpg-receipt-modal-header">
          <div className="modal-title-chip">
            <Receipt size={18} />
            <span>Monthly Fee Ledger &amp; Account Statement</span>
          </div>
          <button type="button" className="btn-close-receipt" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Canvas */}
        <div className="jpg-receipt-scroll-body">
          <div className="official-receipt-sheet ledger-sheet" ref={ledgerRef}>
            <div className="receipt-sheet-top-stripe" />

            {/* School Letterhead */}
            <div className="receipt-letterhead">
              <div className="letterhead-logo">
                <GraduationCap size={40} />
              </div>
              <div className="letterhead-content">
                <h1 className="school-title">Aryavart Shikshan Sansthan</h1>
                <p className="school-tagline">Official Student Financial Ledger &amp; Account Statement</p>
                <p className="school-contact-line">
                  📍 Near Knowledge Hub, Main Campus &bull; 📞 +91-9876543210 &bull; Academic Session 2025–2026
                </p>
              </div>
            </div>

            {/* Statement Header Strip */}
            <div className="statement-header-strip">
              <div className="statement-title">STUDENT MONTHLY FEE LEDGER &amp; PAYMENT STATEMENT</div>
              <div className="statement-meta-row">
                <span><strong>Date:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                <span><strong>Adm No:</strong> {student.admission_no || 'N/A'}</span>
                <span><strong>Class:</strong> {student.class_name || 'N/A'} {student.section_name ? `(${student.section_name})` : ''}</span>
              </div>
            </div>

            {/* Student Info Grid */}
            <div className="receipt-info-box">
              <div className="info-col">
                <div className="info-row">
                  <span className="info-k">Student Full Name:</span>
                  <span className="info-v font-bold">{student.full_name || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="info-k">Father's Name:</span>
                  <span className="info-v">{student.father_name || 'N/A'}</span>
                </div>
              </div>
              <div className="info-col">
                <div className="info-row">
                  <span className="info-k">Student Category:</span>
                  <span className="info-v capitalize">{student.category === 'hosteller' ? 'Hostel Resident' : 'Day Scholar'}</span>
                </div>
                <div className="info-row">
                  <span className="info-k">Contact Phone:</span>
                  <span className="info-v">{parentPhone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Executive KPI Summary */}
            <div className="ledger-kpi-grid">
              <div className="kpi-box blue">
                <span className="kpi-lbl">TOTAL ASSESSED</span>
                <span className="kpi-val">₹{totalAssessed.toLocaleString('en-IN')}</span>
              </div>
              <div className="kpi-box green">
                <span className="kpi-lbl">TOTAL PAID</span>
                <span className="kpi-val">₹{totalPaid.toLocaleString('en-IN')}</span>
              </div>
              <div className={`kpi-box ${netBalance > 0 ? 'orange' : 'teal'}`}>
                <span className="kpi-lbl">OUTSTANDING BALANCE</span>
                <span className="kpi-val">₹{netBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Month-by-Month Statement Table */}
            <div className="ledger-section-heading">Month-by-Month Fee Schedule</div>
            <div className="receipt-table-wrapper">
              <table className="official-table compact">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Assessed Fee</th>
                    <th className="text-right">Paid Amount</th>
                    <th className="text-right">Due Balance</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyLedger && monthlyLedger.length > 0 ? (
                    monthlyLedger.map((row, idx) => {
                      const due = row.due_amount || row.fee_amount || 0;
                      const paid = row.paid_amount || 0;
                      const bal = Math.max(0, due - paid);
                      const isPaid = bal === 0 && due > 0;
                      return (
                        <tr key={idx}>
                          <td className="font-medium">
                            {row.month_name || `Month ${row.fee_month || idx + 1}`}
                          </td>
                          <td className="text-right">₹{due.toLocaleString('en-IN')}</td>
                          <td className="text-right text-green font-bold">₹{paid.toLocaleString('en-IN')}</td>
                          <td className="text-right font-bold" style={{ color: bal > 0 ? '#ea580c' : '#64748b' }}>
                            ₹{bal.toLocaleString('en-IN')}
                          </td>
                          <td className="text-center">
                            <span className={`paid-tag ${isPaid ? 'cleared' : bal > 0 ? 'due' : 'neutral'}`}>
                              {isPaid ? 'PAID' : bal > 0 ? 'DUE' : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center" style={{ padding: '16px', color: '#64748b' }}>
                        No specific monthly ledger installments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Payment Receipts History Table */}
            {paymentHistory && paymentHistory.length > 0 && (
              <>
                <div className="ledger-section-heading" style={{ marginTop: '14px' }}>
                  Validated Payment Receipts Log ({paymentHistory.length})
                </div>
                <div className="receipt-table-wrapper">
                  <table className="official-table compact">
                    <thead>
                      <tr>
                        <th>Receipt No</th>
                        <th>Payment Date</th>
                        <th>Channel</th>
                        <th className="text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((p, i) => (
                        <tr key={i}>
                          <td className="font-medium" style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                            {p.receipt_number || `RCP-${p.id}`}
                          </td>
                          <td>
                            {p.payment_date
                              ? new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </td>
                          <td>
                            {p.payment_mode === 'IN_ACCOUNT' ? '🏦 In Account' : '💵 Cash'}
                          </td>
                          <td className="text-right text-green font-bold">
                            ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Official Stamp & Sign */}
            <div className="receipt-footer-section" style={{ marginTop: '16px' }}>
              <div className="payment-mode-box">
                <div className="thank-you-msg">
                  ✓ Official computer-generated statement issued by Aryavart Shikshan Sansthan Accounts Dept.
                </div>
              </div>
              <div className="total-and-signature-box">
                <div className="official-stamp-box">
                  <div className="seal-stamp-circle">
                    <span>ARYAVART</span>
                    <small>ACCOUNTS SEAL</small>
                    <span>✓ VERIFIED</span>
                  </div>
                  <div className="signature-line">
                    <div className="sig-rule" />
                    <span>Accounts Officer</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="jpg-receipt-modal-actions">
          <button
            type="button"
            className="btn-action-wa"
            onClick={handleWhatsAppShare}
            disabled={sharing}
            title="Share complete statement & ledger to parents on WhatsApp"
          >
            {sharing ? <Loader2 size={16} className="spin" /> : <MessageCircle size={16} />}
            <span>{sharing ? 'Dispatching WhatsApp…' : 'Share on WhatsApp'}</span>
          </button>

          <button
            type="button"
            className="btn-action-pdf"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.75rem 1rem',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
            }}
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            title="Download official branded PDF Statement"
          >
            {downloadingPdf ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
            <span>{downloadingPdf ? 'Generating PDF…' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            className="btn-action-jpg"
            onClick={handleDownloadJpg}
            disabled={downloading}
            title="Download high-resolution statement JPG"
          >
            {downloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            <span>{downloading ? 'Exporting JPG…' : 'Download JPG'}</span>
          </button>

          <button
            type="button"
            className="btn-action-print"
            onClick={() => window.print()}
            title="Print statement"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
}
