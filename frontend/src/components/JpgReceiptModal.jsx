/**
 * JpgReceiptModal Component — School Management System
 * Universal High-Resolution Full-Page JPG Receipt & Statement Viewer with Background WhatsApp Dispatch
 * Seamlessly auto-scales on mobile viewports so Logo, School Name, Demographics & Tables fit perfectly without clipping.
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  Download,
  Share2,
  Printer,
  X,
  Loader2,
  Check,
  Receipt,
  GraduationCap,
  Building2,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { captureElementAsJpg, downloadElementAsJpg, printReceiptElement } from '../utils/receiptGenerator';
import { WhatsAppIcon } from './WhatsAppDirectButton';
import { useToast } from './Toast';
import { api } from '../context/AuthContext';
import './JpgReceiptModal.css';

export default function JpgReceiptModal({
  isOpen,
  onClose,
  data = {},
  type = 'payment', // 'payment' | 'admission' | 'family' | 'dues'
}) {
  const receiptRef = useRef(null);
  const scrollBodyRef = useRef(null);
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState('auto');

  const {
    school = {
      school_name: 'Aryavart Shikshan Sansthan',
      address: 'Near Knowledge Hub, Main Campus',
      phone: '+91-9876543210',
      email: 'info@aryavart.edu.in',
    },
    student = {},
    payment = {},
    receipt = {},
    allocations = [],
    summary = {},
  } = data || {};

  const schoolName = school?.school_name || data?.school_name || 'Aryavart Shikshan Sansthan';
  const schoolAddress = school?.address || data?.address || 'Near Knowledge Hub, Main Campus';
  const schoolPhone = school?.phone || data?.phone || '+91-9876543210';
  const schoolLogoUrl = school?.logo_url || data?.logo_url;

  // Auto-calculate scale on window resize or when modal opens to fit narrow screens with zero clipping
  useEffect(() => {
    if (!isOpen) return;

    const computeScale = () => {
      if (scrollBodyRef.current && receiptRef.current) {
        const availableWidth = scrollBodyRef.current.clientWidth - 24; // padding allowance
        const targetWidth = 580;
        if (availableWidth > 0 && availableWidth < targetWidth) {
          const s = Math.max(0.4, availableWidth / targetWidth);
          setScale(s);
          setScaledHeight(`${receiptRef.current.offsetHeight * s}px`);
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
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  const receiptNumber =
    receipt?.receipt_number ||
    payment?.receipt_number ||
    data?.receipt_number ||
    `RCP-${payment?.id || Date.now().toString().slice(-6)}`;
  const paymentDate = payment?.payment_date
    ? new Date(payment.payment_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  const parentName =
    student?.father_name ||
    student?.parent_name ||
    student?.mother_name ||
    payment?.father_name ||
    payment?.parent_name ||
    data?.father_name ||
    data?.parent_name ||
    '—';

  const parentPhone =
    student?.phone || student?.father_phone || student?.whatsapp_number || payment?.phone || '';
  const totalAmount = payment?.amount || summary?.total_amount || data?.amount || 0;

  // 1. Download Full-Page High-Res JPG without clipping
  const handleDownloadJpg = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const filename = `Receipt_${receiptNumber}_${student?.full_name || 'Student'}`;
      await downloadElementAsJpg(receiptRef.current, filename);
      toast.success('Full-Page JPG Receipt downloaded successfully!');
    } catch (err) {
      console.error('[Download JPG]', err);
      toast.error('Failed to generate JPG receipt');
    } finally {
      setDownloading(false);
    }
  };

  // 2. Send JPEG Receipt directly via WhatsApp in BACKGROUND
  const handleSendWhatsAppBackground = async () => {
    if (!receiptRef.current) return;
    setSendingWa(true);
    setSentSuccess(false);

    try {
      // Capture full-page high-resolution canvas
      const dataUrl = await captureElementAsJpg(receiptRef.current);

      let targetUrl = '';
      if (type === 'admission' || type === 'family') {
        const targetId = student?.id || payment?.student_id || student?.student_id || data?.students?.[0]?.student_id || data?.students?.[0]?.id || 1;
        targetUrl = `/admissions/send-whatsapp-jpg/${targetId}`;
      } else if (type === 'dues') {
        const targetId = student?.id || payment?.student_id;
        targetUrl = `/receipts/send-dues-whatsapp-jpg/${targetId}`;
      } else {
        const targetId = payment?.id || receipt?.payment_id || student?.id;
        targetUrl = `/receipts/send-whatsapp-jpg/${targetId}`;
      }

      const res = await api.post(targetUrl, {
        imageBase64: dataUrl,
        phone: parentPhone,
      });

      if (res.data && res.data.success) {
        setSentSuccess(true);
        toast.success(`✓ Official JPEG Receipt sent to parent's WhatsApp (${parentPhone || 'Parent'}) in background!`);
        setTimeout(() => setSentSuccess(false), 4000);
      } else {
        throw new Error(res.data?.message || 'Failed to send');
      }
    } catch (err) {
      console.error('[Send WhatsApp Background]', err);
      toast.error(err.response?.data?.message || 'Failed to send JPEG via WhatsApp. Make sure your WhatsApp phone is linked in Settings.');
    } finally {
      setSendingWa(false);
    }
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      printReceiptElement(receiptRef.current, `Receipt_${receiptNumber}_${student?.full_name || 'Student'}`);
    } else {
      window.print();
    }
  };

  return (
    <div className="jpg-receipt-overlay" onClick={onClose}>
      <div className="jpg-receipt-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="jpg-receipt-modal-header">
          <div className="modal-title-chip">
            <Receipt size={18} />
            <span>Official Fee Receipt (JPG &amp; Print)</span>
          </div>
          <button type="button" className="btn-close-receipt" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Receipt Canvas Container */}
        <div className="jpg-receipt-scroll-body" ref={scrollBodyRef}>
          {/* Scaled Preview Wrapper to guarantee full visibility on mobile */}
          <div
            className="receipt-scale-wrapper"
            style={{
              width: scale < 1 ? `${580 * scale}px` : '100%',
              maxWidth: '580px',
              height: scale < 1 ? scaledHeight : 'auto',
              minHeight: scale < 1 ? scaledHeight : 'auto',
              position: 'relative',
              margin: '0 auto',
            }}
          >
            {/* Printable / Capturable Receipt Card */}
            <div
              className="official-receipt-sheet"
              ref={receiptRef}
              style={{
                width: '580px',
                minWidth: '580px',
                maxWidth: '580px',
                transform: scale < 1 ? `scale(${scale})` : 'none',
                transformOrigin: 'top left',
                position: scale < 1 ? 'absolute' : 'relative',
                top: 0,
                left: 0,
              }}
            >
              {/* Decorative Top Border */}
              <div className="receipt-sheet-top-stripe" />

              {/* School Letterhead Header */}
              <div className="receipt-letterhead">
                <div className="letterhead-logo">
                  {schoolLogoUrl ? (
                    <img src={schoolLogoUrl} alt="School Logo" className="school-logo-img" />
                  ) : (
                    <GraduationCap size={36} className="school-cap-icon" />
                  )}
                </div>
                <div className="letterhead-content">
                  <h1 className="school-title">{schoolName}</h1>
                  <p className="school-tagline">Excellence in Education &amp; Holistic Student Development</p>
                  <p className="school-contact-line">
                    📍 {schoolAddress} &bull; 📞 {schoolPhone}
                  </p>
                </div>
              </div>

              {/* Receipt Type & Serial Banner */}
              <div className="receipt-banner-strip">
                <div className="receipt-badge-title">
                  {type === 'admission'
                    ? 'OFFICIAL ADMISSION & ENROLLMENT RECEIPT'
                    : type === 'family'
                    ? 'FAMILY MULTI-STUDENT FEE RECEIPT'
                    : type === 'dues'
                    ? 'OFFICIAL FEE DUES STATEMENT'
                    : 'FEE PAYMENT ACKNOWLEDGEMENT RECEIPT'}
                </div>
                <div className="receipt-meta-grid">
                  <div>
                    <span className="meta-lbl">Receipt No:</span>
                    <span className="meta-val highlight">{receiptNumber}</span>
                  </div>
                  <div>
                    <span className="meta-lbl">Issue Date:</span>
                    <span className="meta-val">{paymentDate}</span>
                  </div>
                </div>
              </div>

              {/* Student Demographics Grid */}
              <div className="receipt-student-details">
                <div className="detail-col">
                  <div className="detail-row">
                    <span className="lbl">Student Name:</span>
                    <span className="val font-bold">{student.full_name || payment.full_name || 'Student Name'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="lbl">Admission No:</span>
                    <span className="val font-mono">{student.admission_no || payment.admission_no || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="lbl">Class &amp; Section:</span>
                    <span className="val">
                      {student.class_name || payment.class_name || 'Class'}{' '}
                      {(student.section_name || payment.section_name) ? `(${student.section_name || payment.section_name})` : ''}
                    </span>
                  </div>
                </div>

                <div className="detail-col">
                  <div className="detail-row">
                    <span className="lbl">Father / Guardian:</span>
                    <span className="val font-bold">{parentName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="lbl">Contact Number:</span>
                    <span className="val">{parentPhone || '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="lbl">Category:</span>
                    <span className="val">
                      {(student.category || payment.category) === 'hosteller' ? 'Hosteller (Hostel Accommodation)' : 'Day Scholar'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Itemized Fee Breakdown Table */}
              <div className="receipt-table-wrapper">
                <table className="receipt-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th>Fee Description / Period</th>
                      <th className="text-right">Total Fee</th>
                      <th className="text-right">Amount Paid</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations && allocations.length > 0 ? (
                      allocations.map((item, idx) => {
                        let itemDesc = 'Fee Payment';
                        if (item.fee_month) {
                          const monthName = new Date(2000, Number(item.fee_month) - 1).toLocaleString('en-IN', {
                            month: 'long',
                          });
                          itemDesc = `${monthName} ${item.fee_year || ''} Monthly Tuition Fee`;
                        } else if (item.description || item.fee_type_name) {
                          itemDesc = item.description || item.fee_type_name;
                        } else if (item.additional_description) {
                          itemDesc = item.additional_description;
                        } else if (payment?.payment_category === 'ADMISSION_CHARGE') {
                          itemDesc = 'Admission / Enrollment Fee';
                        }
                        const itemFee = Number(item.fee_amount || item.amount || item.allocated_amount || totalAmount);
                        const itemPaid = Number(item.allocated_amount || item.paid_amount || item.amount || totalAmount);

                        return (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td className="font-medium">{itemDesc}</td>
                            <td className="text-right">
                              ₹{itemFee.toLocaleString('en-IN')}
                            </td>
                            <td className="text-right text-green font-bold">
                              ₹{itemPaid.toLocaleString('en-IN')}
                            </td>
                            <td className="text-center">
                              <span className="paid-tag">PAID</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td>1</td>
                        <td className="font-medium">
                          {payment.payment_category === 'ADMISSION_CHARGE'
                            ? 'Admission & Initial Enrollment Fees'
                            : (payment.notes ? payment.notes.replace(/^\[.*?\]\s*/, '') : 'School Fee Payment')}
                        </td>
                        <td className="text-right">₹{Number(totalAmount).toLocaleString('en-IN')}</td>
                        <td className="text-right text-green font-bold">
                          ₹{Number(totalAmount).toLocaleString('en-IN')}
                        </td>
                        <td className="text-center">
                          <span className="paid-tag">PAID</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payment Summary & Stamp Section */}
              <div className="receipt-footer-section">
                <div className="payment-mode-box">
                  <div className="pay-mode-row">
                    <span className="pm-label">Payment Channel:</span>
                    <span className="pm-badge">
                      {payment.payment_mode === 'IN_ACCOUNT' ? '🏦 Bank / In Account' : '💵 Cash Handover'}
                    </span>
                  </div>
                  {payment.notes && (
                    <div className="pay-mode-row">
                      <span className="pm-label">Remarks:</span>
                      <span className="pm-val">{payment.notes}</span>
                    </div>
                  )}
                  <div className="thank-you-msg">
                    ✓ Computer Generated Valid Financial Receipt. Keep safe for future reference.
                  </div>
                </div>

                <div className="total-summary-card">
                  <div className="grand-total-row">
                    <span>Grand Total Paid:</span>
                    <strong className="grand-total-val">₹{Number(totalAmount).toLocaleString('en-IN')}</strong>
                  </div>

                  <div className="stamp-signature-grid">
                    <div className="official-stamp-circle">
                      <span>ARYAVART</span>
                      <small>OFFICIAL SEAL</small>
                      <span>✓ VERIFIED</span>
                    </div>
                    <div className="signature-line">
                      <div className="sig-rule" />
                      <span>Authorized Signatory</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="jpg-receipt-modal-actions">
          <button
            type="button"
            className={`btn-action-wa ${sentSuccess ? 'success' : ''}`}
            onClick={handleSendWhatsAppBackground}
            disabled={sendingWa}
            title="Send JPEG receipt directly to WhatsApp in the background"
          >
            {sendingWa ? (
              <Loader2 size={16} className="spin" />
            ) : sentSuccess ? (
              <CheckCircle2 size={16} />
            ) : (
              <WhatsAppIcon size={16} />
            )}
            <span>
              {sendingWa
                ? 'Sending in Background…'
                : sentSuccess
                ? '✓ JPEG Sent to WhatsApp!'
                : 'Send JPEG via WhatsApp (Background)'}
            </span>
          </button>

          <button
            type="button"
            className="btn-action-jpg"
            onClick={handleDownloadJpg}
            disabled={downloading}
            title="Download full page high quality JPG image"
          >
            {downloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            <span>{downloading ? 'Exporting Full JPG…' : 'Download JPG Receipt'}</span>
          </button>

          <button
            type="button"
            className="btn-action-print"
            onClick={handlePrint}
            title="Print receipt"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
}
