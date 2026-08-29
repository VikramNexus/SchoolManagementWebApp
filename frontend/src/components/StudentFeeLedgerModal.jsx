/**
 * StudentFeeLedgerModal Component — School Management System
 * Complete Monthly Fee Ledger & Account Statement Generator (High-Res JPG + WhatsApp Share)
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  Download,
  Share2,
  Printer,
  X,
  Loader2,
  Receipt,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  IndianRupee,
  FileText,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { downloadElementAsJpg, captureElementAsJpg, shareReceiptViaWhatsApp, printReceiptElement } from '../utils/receiptGenerator';
import { saveFileToDeviceStorage } from '../utils/fileDownloader';
import { WhatsAppIcon } from './WhatsAppDirectButton';
import { useToast } from './Toast';
import './StudentFeeLedgerModal.css';

export default function StudentFeeLedgerModal({
  isOpen,
  onClose,
  student = {},
  familyData = null,
  monthlyLedger = [],
  paymentHistory = [],
  totals = {},
}) {
  const ledgerRef = useRef(null);
  const scrollBodyRef = useRef(null);
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingJpg, setSendingJpg] = useState(false);
  const [sentJpgSuccess, setSentJpgSuccess] = useState(false);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState('auto');

  const isFamily = Boolean(familyData?.has_family && familyData.siblings?.length > 1);

  // Auto-calculate scale on window resize or when modal opens to fit narrow screens with zero clipping
  useEffect(() => {
    if (!isOpen) return;

    const computeScale = () => {
      if (scrollBodyRef.current && ledgerRef.current) {
        const availableWidth = scrollBodyRef.current.clientWidth - 24;
        const targetWidth = 600;
        if (availableWidth > 0 && availableWidth < targetWidth) {
          const s = Math.max(0.4, availableWidth / targetWidth);
          setScale(s);
          setScaledHeight(`${ledgerRef.current.offsetHeight * s}px`);
        } else {
          setScale(1);
          setScaledHeight('auto');
        }
      }
    };

    computeScale();
    const t1 = setTimeout(computeScale, 50);
    const t2 = setTimeout(computeScale, 200);
    window.addEventListener('resize', computeScale);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', computeScale);
    };
  }, [isOpen, student, familyData, monthlyLedger]);

  if (!isOpen || !student) return null;

  const totalAssessed = totals.total_assessed || totals.total_due || 0;
  const totalPaid = totals.total_paid || 0;
  const netBalance = totals.total_due !== undefined ? totals.total_due : Math.max(0, totalAssessed - totalPaid);
  const combinedRate = totals.combined_monthly_rate || totals.total_family_monthly_rate || (familyData?.siblings || []).reduce((s, sib) => s + Number(sib.monthly_fee_rate || 0), 0);

  const parentPhone = student.phone || student.father_phone || student.contact_no || student.whatsapp_number || '';

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const res = await api.get(`/students/${student.id}/ledger-pdf`, { responseType: 'blob' });
      const filename = `Fee_Ledger_Statement_${student.admission_no || student.id}.pdf`;
      const saveRes = await saveFileToDeviceStorage({
        data: res.data,
        filename,
        mimeType: 'application/pdf',
      });
      if (saveRes?.platform === 'native') {
        toast.success(`✓ PDF Saved to Phone Storage (Documents/${filename})`);
      } else {
        toast.success('Official PDF Statement downloaded!');
      }
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
      const filename = isFamily
        ? `Family_Fee_Statement_${familyData?.family_id || 'Family'}`
        : `Fee_Statement_${student.admission_no || 'Student'}_${student.full_name || ''}`;
      const saveRes = await downloadElementAsJpg(ledgerRef.current, filename);
      if (saveRes?.platform === 'native') {
        toast.success(`✓ Image Saved to Phone Storage (Documents/${filename}.jpg)`);
      } else {
        toast.success('Fee Statement downloaded as JPG successfully!');
      }
    } catch (err) {
      console.error('[Download Statement JPG]', err);
      toast.error('Failed to export statement image');
    } finally {
      setDownloading(false);
    }
  };

  // Background JPEG Statement Dispatch
  const handleSendWhatsAppJpg = async () => {
    if (!ledgerRef.current) return;
    setSendingJpg(true);
    setSentJpgSuccess(false);
    try {
      const dataUrl = await captureElementAsJpg(ledgerRef.current);
      const res = await api.post(`/students/${student.id}/send-ledger-whatsapp-jpg`, {
        imageBase64: dataUrl,
        phone: parentPhone,
      });
      if (res.data?.success) {
        setSentJpgSuccess(true);
        toast.success(`✓ Fee Statement JPEG image sent to parent's WhatsApp in background!`);
        setTimeout(() => setSentJpgSuccess(false), 4000);
      }
    } catch (err) {
      console.error('[Send Ledger WhatsApp JPG]', err);
      toast.error(err.response?.data?.message || 'Failed to dispatch ledger image via WhatsApp. Ensure WhatsApp is linked in Settings.');
    } finally {
      setSendingJpg(false);
    }
  };

  return (
    <div className="jpg-receipt-overlay" onClick={onClose}>
      <div className="jpg-receipt-modal-card ledger-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="jpg-receipt-modal-header">
          <div className="modal-title-chip">
            <Receipt size={18} />
            <span>{isFamily ? 'Family Fee Ledger & Account Statement' : 'Monthly Fee Ledger & Account Statement'}</span>
          </div>
          <button type="button" className="btn-close-receipt" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Canvas */}
        <div className="jpg-receipt-scroll-body" ref={scrollBodyRef}>
          {/* Scaled Preview Wrapper to guarantee full visibility on mobile */}
          <div
            className="receipt-scale-wrapper"
            style={{
              width: scale < 1 ? `${600 * scale}px` : '100%',
              maxWidth: '600px',
              height: scale < 1 ? scaledHeight : 'auto',
              minHeight: scale < 1 ? scaledHeight : 'auto',
              position: 'relative',
              margin: '0 auto',
            }}
          >
            <div
              className="official-receipt-sheet ledger-sheet"
              ref={ledgerRef}
              style={{
                width: '600px',
                minWidth: '600px',
                maxWidth: '600px',
                transform: scale < 1 ? `scale(${scale})` : 'none',
                transformOrigin: 'top left',
                position: scale < 1 ? 'absolute' : 'relative',
                top: 0,
                left: 0,
              }}
            >
              <div className="receipt-sheet-top-stripe" />

              {/* School Letterhead */}
              <div className="receipt-letterhead">
                <div className="letterhead-logo">
                  <GraduationCap size={36} className="school-cap-icon" />
                </div>
                <div className="letterhead-content">
                  <h1 className="school-title">Aryavart Shikshan Sansthan</h1>
                  <p className="school-tagline">
                    {isFamily ? 'Official Consolidated Family Financial Ledger & Statement' : 'Official Student Financial Ledger & Account Statement'}
                  </p>
                  <p className="school-contact-line">
                    📍 Near Knowledge Hub, Main Campus &bull; 📞 +91-9876543210 &bull; Academic Session 2025–2026
                  </p>
                </div>
              </div>

              {/* Statement Header Strip */}
              <div className="statement-header-strip" style={isFamily ? { background: '#eff6ff', borderColor: '#bfdbfe' } : {}}>
                <div className="statement-title" style={isFamily ? { color: '#1d4ed8' } : {}}>
                  {isFamily ? '👨‍👩‍👧‍👦 CONSOLIDATED FAMILY FEE LEDGER & PAYMENT STATEMENT' : 'STUDENT MONTHLY FEE LEDGER & PAYMENT STATEMENT'}
                </div>
                <div className="statement-meta-row">
                  <span><strong>Date:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  {isFamily ? (
                    <>
                      <span><strong>Family ID:</strong> {familyData.family_id || 'FAM-ACC'}</span>
                      <span><strong>Linked Siblings:</strong> {familyData.siblings.length} Enrolled</span>
                    </>
                  ) : (
                    <>
                      <span><strong>Adm No:</strong> {student.admission_no || 'N/A'}</span>
                      <span><strong>Class:</strong> {student.class_name || 'N/A'} {student.section_name ? `(${student.section_name})` : ''}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Info Grid: Family vs Single Student */}
              {isFamily ? (
                <div className="receipt-info-box" style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '5px' }}>
                      <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.82rem' }}>👨‍👩‍👧‍👦 Enrolled Family Siblings:</span>
                      <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '0.82rem' }}>
                        Combined Monthly Rate: ₹{Number(combinedRate).toLocaleString('en-IN')}/mo
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '6px' }}>
                      {familyData.siblings.map((sib) => (
                        <div key={sib.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '5px 8px', fontSize: '0.78rem' }}>
                          <strong style={{ color: '#0f172a' }}>{sib.full_name}</strong>
                          <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                            {sib.class_name || 'Class —'} &bull; ₹{Number(sib.monthly_fee_rate || 0).toLocaleString('en-IN')}/mo
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginTop: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                      <span><strong>Parent / Guardian:</strong> {student.father_name || student.parent_name || 'Family Guardian'}</span>
                      <span><strong>Phone:</strong> {parentPhone || '—'}</span>
                    </div>
                  </div>
                </div>
              ) : (
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
              )}

              {/* Executive KPI Summary */}
              <div className="ledger-kpi-grid">
                <div className="kpi-box blue">
                  <span className="kpi-lbl">{isFamily ? 'TOTAL FAMILY ASSESSED' : 'TOTAL ASSESSED'}</span>
                  <span className="kpi-val">₹{totalAssessed.toLocaleString('en-IN')}</span>
                </div>
                <div className="kpi-box green">
                  <span className="kpi-lbl">{isFamily ? 'TOTAL FAMILY PAID' : 'TOTAL PAID'}</span>
                  <span className="kpi-val">₹{totalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className={`kpi-box ${netBalance > 0 ? 'orange' : 'teal'}`}>
                  <span className="kpi-lbl">{isFamily ? 'FAMILY BALANCE DUE' : 'OUTSTANDING BALANCE'}</span>
                  <span className="kpi-val">₹{netBalance.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Month-by-Month Statement Table */}
              <div className="ledger-section-heading">
                {isFamily ? 'Consolidated Month-by-Month Schedule (Combined Sibling Rates)' : 'Month-by-Month Fee Schedule'}
              </div>
              <div className="receipt-table-wrapper">
                <table className="official-table compact">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-right">{isFamily ? 'Combined Fee' : 'Assessed Fee'}</th>
                      <th className="text-right">Paid Amount</th>
                      <th className="text-right">Due Balance</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyLedger && monthlyLedger.length > 0 ? (
                      monthlyLedger.map((row, idx) => {
                        const feeAmt = Number(row.fee_amount || row.total_family_fee || row.due_amount || 0);
                        const otherChg = Number(row.other_charges || 0);
                        const due = feeAmt + otherChg;
                        const paid = Number(row.paid_amount || row.total_family_paid || 0);
                        const bal = Number(row.due_amount !== undefined ? row.due_amount : (row.total_family_due !== undefined ? row.total_family_due : Math.max(0, due - paid)));
                        const isPaid = bal === 0 && due > 0;
                        return (
                          <tr key={idx}>
                            <td className="font-medium">
                              <div>{row.month_name || `Month ${row.fee_month || idx + 1}`} {row.fee_year ? `(${row.fee_year})` : ''}</div>
                              {row.sibling_breakdown && row.sibling_breakdown.length > 1 && (
                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                                  {row.sibling_breakdown.map((s) => `${s.student_name ? s.student_name.split(' ')[0] : 'S'}: ₹${Number(s.fee_amount || 0).toLocaleString('en-IN')}`).join(' | ')}
                                </div>
                              )}
                            </td>
                            <td className="text-right font-semibold">₹{due.toLocaleString('en-IN')}</td>
                            <td className="text-right text-green font-bold">
                              {paid > 0 ? `₹${paid.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="text-right font-bold" style={{ color: bal > 0 ? '#ea580c' : '#16a34a' }}>
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
        </div>

        {/* Bottom Actions Bar */}
        <div className="jpg-receipt-modal-actions">
          <button
            type="button"
            className={`btn-action-wa ${sentJpgSuccess ? 'success' : ''}`}
            onClick={handleSendWhatsAppJpg}
            disabled={sendingJpg}
            title="Send full fee statement JPEG directly to parent WhatsApp in background"
          >
            {sendingJpg ? (
              <Loader2 size={16} className="spin" />
            ) : sentJpgSuccess ? (
              <CheckCircle2 size={16} />
            ) : (
              <WhatsAppIcon size={16} />
            )}
            <span>
              {sendingJpg
                ? 'Sending in Background…'
                : sentJpgSuccess
                ? '✓ JPEG Sent to WhatsApp!'
                : 'Send JPEG via WhatsApp (Background)'}
            </span>
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
            onClick={() => {
              if (ledgerRef.current) {
                printReceiptElement(ledgerRef.current, isFamily ? 'Family Fee Ledger Statement' : 'Student Fee Statement');
              } else {
                window.print();
              }
            }}
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
