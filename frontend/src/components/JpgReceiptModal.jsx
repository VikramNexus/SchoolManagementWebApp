/**
 * JpgReceiptModal Component — School Management System
 * Universal High-Resolution JPG Receipt & Statement Viewer with WhatsApp Share
 */

import React, { useRef, useState } from 'react';
import {
  Download,
  Share2,
  Printer,
  X,
  Loader2,
  Check,
  Receipt,
  GraduationCap,
  MessageCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { downloadElementAsJpg, shareReceiptViaWhatsApp } from '../utils/receiptGenerator';
import { useToast } from './Toast';
import './JpgReceiptModal.css';

export default function JpgReceiptModal({
  isOpen,
  onClose,
  data = {},
  type = 'payment', // 'payment' | 'admission' | 'family' | 'ledger'
}) {
  const receiptRef = useRef(null);
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!isOpen || !data) return null;

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
  } = data;

  const receiptNumber = receipt?.receipt_number || payment?.receipt_number || `RCP-${payment?.id || Date.now().toString().slice(-6)}`;
  const paymentDate = payment?.payment_date
    ? new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const parentPhone = student?.phone || student?.father_phone || student?.contact_no || payment?.phone || '';
  const totalAmount = payment?.amount || summary?.total_amount || 0;

  const handleDownloadJpg = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const filename = `Receipt_${receiptNumber}_${student?.full_name || 'Student'}`;
      await downloadElementAsJpg(receiptRef.current, filename);
      toast.success('JPG Receipt downloaded successfully!');
    } catch (err) {
      console.error('[Download JPG]', err);
      toast.error('Failed to generate JPG receipt');
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!receiptRef.current) return;
    setSharing(true);
    try {
      await shareReceiptViaWhatsApp({
        element: receiptRef.current,
        phone: parentPhone,
        studentName: student?.full_name || 'Student',
        receiptNo: receiptNumber,
        amount: totalAmount,
      });
      toast.success('Opening WhatsApp share...');
    } catch (err) {
      console.error('[Share WhatsApp]', err);
      toast.error('Failed to share via WhatsApp');
    } finally {
      setSharing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="jpg-receipt-overlay" onClick={onClose}>
      <div className="jpg-receipt-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="jpg-receipt-modal-header">
          <div className="modal-title-chip">
            <Receipt size={18} />
            <span>Official Fee Receipt (JPG Format)</span>
          </div>
          <button type="button" className="btn-close-receipt" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Receipt Canvas Container */}
        <div className="jpg-receipt-scroll-body">
          {/* Printable / Capturable Receipt Card */}
          <div className="official-receipt-sheet" ref={receiptRef}>
            {/* Decorative Top Border */}
            <div className="receipt-sheet-top-stripe" />

            {/* School Letterhead Header */}
            <div className="receipt-letterhead">
              <div className="letterhead-logo">
                <GraduationCap size={40} className="school-cap-icon" />
              </div>
              <div className="letterhead-content">
                <h1 className="school-title">{school.school_name || 'Aryavart Shikshan Sansthan'}</h1>
                <p className="school-tagline">Excellence in Education &amp; Holistic Student Development</p>
                <p className="school-contact-line">
                  📍 {school.address || 'Main Campus'} &bull; 📞 {school.phone || '+91-9876543210'}
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
                <div>
                  <span className="meta-lbl">Academic Year:</span>
                  <span className="meta-val">{school.academic_year || '2025-2026'}</span>
                </div>
              </div>
            </div>

            {/* Student Profile Info Grid */}
            <div className="receipt-info-box">
              <div className="info-col">
                <div className="info-row">
                  <span className="info-k">Student Name:</span>
                  <span className="info-v font-bold">{student.full_name || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="info-k">Admission No:</span>
                  <span className="info-v">{student.admission_no || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="info-k">Class &amp; Section:</span>
                  <span className="info-v">
                    {student.class_name || 'N/A'} {student.section_name ? `(${student.section_name})` : ''}
                  </span>
                </div>
              </div>

              <div className="info-col">
                <div className="info-row">
                  <span className="info-k">Father's Name:</span>
                  <span className="info-v">{student.father_name || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="info-k">Category:</span>
                  <span className="info-v capitalize">
                    {student.category === 'hosteller' ? 'Hostel Resident' : 'Day Scholar'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-k">Contact No:</span>
                  <span className="info-v">{parentPhone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Fee Items Table */}
            <div className="receipt-table-wrapper">
              <table className="official-table">
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
                    allocations.map((item, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td className="font-medium">
                          {item.fee_month
                            ? `${new Date(2000, item.fee_month - 1).toLocaleString('en-IN', { month: 'long' })} ${item.fee_year || ''} Tuition Fee`
                            : item.description || item.fee_type_name || 'Fee Installment'}
                        </td>
                        <td className="text-right">₹{Number(item.fee_amount || item.amount || totalAmount).toLocaleString('en-IN')}</td>
                        <td className="text-right text-green font-bold">
                          ₹{Number(item.allocated_amount || item.amount || totalAmount).toLocaleString('en-IN')}
                        </td>
                        <td className="text-center">
                          <span className="paid-tag">PAID</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td>1</td>
                      <td className="font-medium">School Fee Payment</td>
                      <td className="text-right">₹{Number(totalAmount).toLocaleString('en-IN')}</td>
                      <td className="text-right text-green font-bold">₹{Number(totalAmount).toLocaleString('en-IN')}</td>
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

              {/* Total Box */}
              <div className="total-and-signature-box">
                <div className="grand-total-card">
                  <div className="gt-title">TOTAL RECEIVED</div>
                  <div className="gt-amount">₹{Number(totalAmount).toLocaleString('en-IN')}</div>
                </div>

                <div className="official-stamp-box">
                  <div className="seal-stamp-circle">
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

        {/* Modal Action Buttons Footer */}
        <div className="jpg-receipt-modal-actions">
          <button
            type="button"
            className="btn-action-wa"
            onClick={handleWhatsAppShare}
            disabled={sharing}
            title="Share receipt image & details on WhatsApp"
          >
            {sharing ? <Loader2 size={16} className="spin" /> : <MessageCircle size={16} />}
            <span>{sharing ? 'Opening WhatsApp…' : 'Share on WhatsApp'}</span>
          </button>

          <button
            type="button"
            className="btn-action-jpg"
            onClick={handleDownloadJpg}
            disabled={downloading}
            title="Download high quality JPG image"
          >
            {downloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            <span>{downloading ? 'Exporting JPG…' : 'Download JPG Receipt'}</span>
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
