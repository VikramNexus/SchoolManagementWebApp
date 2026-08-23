/**
 * FeeLedgerTable — School Management System (Frontend)
 *
 * Professional School Fee Register & Ledger.
 * Columns: Month, Opening Balance, Other Charges, Monthly Fee, Total Due, Amount Paid, Closing Balance, Status, Payment Date, Remark, Actions.
 * Features: Edit Monthly Fee, Delete Month Entry, 1-Click + Assign Next Month, Direct Receipt Viewing.
 */

import React, { useState } from 'react';
import {
  Loader2,
  CalendarPlus,
  BookOpen,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
} from 'lucide-react';
import './FeeLedgerTable.css';

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateDDMMYY(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch (err) {
    return '—';
  }
}

export default function FeeLedgerTable({
  monthlyFees = [],
  studentMonthlyRate = 0,
  admissionDate = null,
  loading = false,
  onAssignMonth = null,
  onUpdateMonthFee = null,
  onDeleteMonthFee = null,
  onViewReceipt = null,
  onRecordPayment = null,
}) {
  const [assigning, setAssigning] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRowExpansion = (rowId) => {
    setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  if (loading) {
    return (
      <div className="register-loading-dark">
        <Loader2 size={24} className="spin" />
        <span>Loading fee register &amp; ledger records…</span>
      </div>
    );
  }

  // Sort rows chronologically by fee_year ASC, fee_month ASC
  const sortedFees = [...monthlyFees].sort((a, b) => {
    if (a.fee_year !== b.fee_year) return a.fee_year - b.fee_year;
    return a.fee_month - b.fee_month;
  });

  // Determine next month and year to assign automatically
  let nextMonth;
  let nextYear;

  if (sortedFees.length > 0) {
    const lastRow = sortedFees[sortedFees.length - 1];
    if (lastRow.fee_month === 12) {
      nextMonth = 1;
      nextYear = lastRow.fee_year + 1;
    } else {
      nextMonth = lastRow.fee_month + 1;
      nextYear = lastRow.fee_year;
    }
  } else if (admissionDate) {
    const adm = new Date(admissionDate);
    const admMonth = !isNaN(adm.getTime()) ? adm.getMonth() + 1 : new Date().getMonth() + 1;
    const admYear = !isNaN(adm.getTime()) ? adm.getFullYear() : new Date().getFullYear();

    if (admMonth === 12) {
      nextMonth = 1;
      nextYear = admYear + 1;
    } else {
      nextMonth = admMonth + 1;
      nextYear = admYear;
    }
  } else {
    const now = new Date();
    nextMonth = now.getMonth() + 1;
    nextYear = now.getFullYear();
  }

  const nextMonthLabel = `${SHORT_MONTHS[nextMonth - 1]}-${String(nextYear).slice(-2)}`;

  // Calculate dynamic running balances
  let runningOpeningBalance = 0;
  let sumTotalFees = 0;
  let sumTotalPaid = 0;

  const ledgerRows = sortedFees.map((fee) => {
    const openingBalance = runningOpeningBalance;
    const monthlyFee = Number(fee.fee_amount || 0);
    const otherCharges = Number(fee.other_charges || 0);
    const total = openingBalance + monthlyFee + otherCharges;

    // Use exact paid amount recorded/allocated to this monthly fee
    const paid = Number(fee.paid_amount || 0);

    // Net balance (positive = dues, negative = advance credit)
    const netBalance = total - paid;
    const closingBalance = Math.max(0, netBalance);

    // Carry forward exact net balance (positive dues OR negative advance) to next month
    runningOpeningBalance = netBalance;

    sumTotalFees += monthlyFee + otherCharges;
    sumTotalPaid += paid;

    // Month label format: e.g. "Apr-25", "May-25"
    const monthName = SHORT_MONTHS[fee.fee_month - 1] || `M${fee.fee_month}`;
    const yearShort = String(fee.fee_year).slice(-2);
    const monthLabel = `${monthName}-${yearShort}`;

    // Payment Date format
    const payDate = fee.actual_payment_date || fee.payment_date;
    const paymentDateFormatted = paid > 0 ? formatDateDDMMYY(payDate || fee.updated_at) : '—';

    // Remark determination (cash / in acc. / advance)
    let remark = '—';
    if (paid > 0) {
      const mode = (fee.actual_payment_mode || fee.payment_mode || 'cash').toLowerCase();
      if (mode.includes('account') || mode.includes('bank') || mode.includes('online') || mode.includes('in_account')) {
        remark = 'in acc.';
      } else {
        remark = 'cash';
      }
    } else if (openingBalance < 0 || total <= 0) {
      remark = 'advance';
    }

    // Clearance status
    const isCleared = (monthlyFee + otherCharges) > 0 && closingBalance === 0;
    const isPartial = paid > 0 && closingBalance > 0;
    const statusLabel = isCleared ? 'PAID' : (isPartial ? 'PARTIAL' : 'DUE');

    return {
      id: fee.id,
      fee_month: fee.fee_month,
      fee_year: fee.fee_year,
      monthLabel,
      openingBalance,
      otherCharges,
      monthlyFee,
      total,
      paid,
      netBalance,
      closingBalance,
      paymentDate: paymentDateFormatted,
      remark,
      statusLabel,
      isCleared,
      isPartial,
      installments: fee.installments || [],
    };
  });

  const finalCurrentBalance = Math.max(0, runningOpeningBalance);
  const activeRate = Number(studentMonthlyRate) > 0 ? Number(studentMonthlyRate) : (sortedFees[0]?.fee_amount || 0);

  const handleQuickAssignNextMonth = async () => {
    if (!onAssignMonth) return;
    try {
      setAssigning(true);
      await onAssignMonth(nextMonth, nextYear);
    } finally {
      setAssigning(false);
    }
  };

  const handleStartEdit = (row) => {
    setEditingFeeId(row.id);
    setEditAmount(String(row.monthlyFee));
  };

  const handleSaveEdit = async (feeId) => {
    if (!onUpdateMonthFee) return;
    try {
      setUpdating(true);
      await onUpdateMonthFee(feeId, Number(editAmount));
      setEditingFeeId(null);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteMonth = async (row) => {
    if (!onDeleteMonthFee) return;
    if (!window.confirm(`Are you sure you want to delete the assigned month fee for ${row.monthLabel}?`)) return;
    try {
      setDeletingId(row.id);
      await onDeleteMonthFee(row.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fee-register-wrapper-dark">
      {/* Top Register Summary Bar */}
      <div className="register-summary-bar-dark">
        <div className="summary-box-dark">
          <span className="box-label">Monthly Fee Rate</span>
          <span className="box-value">{formatCurrency(activeRate)}</span>
        </div>

        <div className="summary-box-dark">
          <span className="box-label">Total Fee Charged</span>
          <span className="box-value">{formatCurrency(sumTotalFees)}</span>
        </div>

        <div className="summary-box-dark">
          <span className="box-label">Total Paid &amp; Cleared</span>
          <span className="box-value text-green">{formatCurrency(sumTotalPaid)}</span>
        </div>

        {/* Most Prominent Current Balance Card */}
        <div className="summary-box-dark prominent-balance-box-dark">
          <span className="box-label">Current Outstanding Balance</span>
          <span className={`box-value prominent-value ${finalCurrentBalance > 0 ? 'text-due-orange' : 'text-green'}`}>
            {formatCurrency(finalCurrentBalance)}
          </span>
        </div>
      </div>

      {/* Traditional School Fee Register Table - Excel Style Theme */}
      <div className="register-card-dark">
        <div className="register-header-dark">
          <div className="header-left">
            <BookOpen size={20} className="register-icon-teal" />
            <span className="register-title">Student Fee Register &amp; Ledger</span>
          </div>
          <div className="header-right-actions">
            {onAssignMonth && (
              <button
                className="btn btn-assign-next"
                onClick={handleQuickAssignNextMonth}
                disabled={assigning}
                title={`Assign fee for ${FULL_MONTHS[nextMonth - 1]} ${nextYear}`}
              >
                {assigning ? <Loader2 size={15} className="spin" /> : <CalendarPlus size={15} />}
                + Assign Next Month ({nextMonthLabel})
              </button>
            )}
          </div>
        </div>

        <div className="register-table-responsive">
          <table className="dark-register-table excel-style-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Opening Balance</th>
                <th className="text-right">Other Charge</th>
                <th className="text-right">Monthly Fee</th>
                <th className="text-right">Total</th>
                <th className="text-right">Amount Paid</th>
                <th className="text-right">Closing Balance</th>
                <th className="text-center">Status</th>
                <th className="text-center">Payment Date</th>
                <th className="text-left">Remark</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-register-cell-dark">
                    No fee records generated yet. Click <strong>"+ Assign Next Month"</strong> to generate the first month fee schedule.
                  </td>
                </tr>
              ) : (
                ledgerRows.map((row) => {
                  const isExpanded = !!expandedRows[row.id];
                  const hasInstallments = row.installments && row.installments.length > 0;

                  return (
                    <React.Fragment key={row.id}>
                      <tr className={isExpanded ? 'row-expanded' : ''}>
                        <td className="month-cell-bold">
                          <div className="month-cell-content" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {hasInstallments && (
                              <button
                                type="button"
                                className="expand-toggle-btn"
                                onClick={() => toggleRowExpansion(row.id)}
                                title={isExpanded ? 'Hide payment receipts breakdown' : 'View payment receipts breakdown'}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}
                            <span className="month-tag-pill">{row.monthLabel}</span>
                            {hasInstallments && (
                              <span className="parts-badge" title="Validated receipts allocated to this month">
                                {row.installments.length} receipt{row.installments.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`text-right ${row.openingBalance < 0 ? 'text-advance-green' : ''}`}>
                          {row.openingBalance < 0 ? `-₹${Math.abs(row.openingBalance).toLocaleString('en-IN')}` : formatCurrency(row.openingBalance)}
                        </td>
                        <td className="text-right">{formatCurrency(row.otherCharges)}</td>
                        <td className="text-right">
                          {editingFeeId === row.id ? (
                            <div className="edit-fee-input-wrap">
                              <input
                                type="number"
                                className="edit-fee-input"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span className="font-semibold">{formatCurrency(row.monthlyFee)}</span>
                          )}
                        </td>
                        <td className={`text-right font-medium ${row.total < 0 ? 'text-advance-green' : ''}`}>
                          {row.total < 0 ? `-₹${Math.abs(row.total).toLocaleString('en-IN')}` : formatCurrency(row.total)}
                        </td>
                        <td className="text-right text-light-paid font-bold">
                          {row.paid > 0 ? (
                            <span className="paid-amount-highlight">{formatCurrency(row.paid)}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={`text-right closing-cell-dark ${row.closingBalance > 0 ? 'has-balance-red' : 'zero-balance-white'}`}>
                          {formatCurrency(row.closingBalance)}
                        </td>
                        <td className="text-center">
                          <span className={`ledger-status-pill ${row.isCleared ? 'status-cleared' : (row.isPartial ? 'status-partial' : 'status-due')}`}>
                            {row.isCleared && '🟢 PAID'}
                            {row.isPartial && '🟡 PARTIAL'}
                            {!row.isCleared && !row.isPartial && '🔴 DUE'}
                          </span>
                        </td>
                        <td className="text-center date-cell-dark">{row.paid > 0 ? row.paymentDate : '—'}</td>
                        <td className="text-left remark-cell-dark">
                          {row.remark === 'in acc.' && <span className="remark-in-account">🏦 in acc.</span>}
                          {row.remark === 'cash' && <span className="remark-cash">💵 cash</span>}
                          {row.remark === 'advance' && <span className="remark-advance">💎 advance</span>}
                          {row.remark === '—' && <span className="remark-dash">—</span>}
                        </td>
                        <td className="text-center action-cell-dark">
                          {editingFeeId === row.id ? (
                            <div className="action-inline-btns">
                              <button
                                className="btn-icon check-btn"
                                onClick={() => handleSaveEdit(row.id)}
                                disabled={updating}
                                title="Save Fee Amount"
                              >
                                {updating ? <Loader2 size={13} className="spin" /> : <Check size={14} />}
                              </button>
                              <button
                                className="btn-icon cancel-btn"
                                onClick={() => setEditingFeeId(null)}
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="action-inline-btns">
                              <button
                                className="btn-icon edit-btn"
                                onClick={() => handleStartEdit(row)}
                                title="Edit Monthly Fee Amount"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="btn-icon delete-btn"
                                onClick={() => handleDeleteMonth(row)}
                                disabled={deletingId === row.id || row.paid > 0}
                                title={row.paid > 0 ? "Cannot delete month with recorded payments" : "Delete Month Entry"}
                              >
                                {deletingId === row.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Installment / Receipts Row */}
                      {isExpanded && hasInstallments && (
                        <tr className="installments-subrow">
                          <td colSpan={11} className="installments-drawer-cell">
                            <div className="installments-drawer-content">
                              <div className="drawer-header">
                                <Receipt size={14} className="drawer-icon" />
                                <span>Validated Payment Receipts Allocated to {row.monthLabel}</span>
                              </div>
                              <div className="drawer-receipts-list">
                                {row.installments.map((inst, idx) => (
                                  <div key={idx} className="drawer-receipt-item">
                                    <span className="inst-rcp-num">{inst.receipt_number || `RCP-${inst.id}`}</span>
                                    <span className="inst-rcp-date">
                                      📅 {inst.payment_date ? formatDateDDMMYY(inst.payment_date) : '—'}
                                    </span>
                                    <span className="inst-rcp-mode">
                                      {inst.payment_mode === 'IN_ACCOUNT' ? '🏦 In Account' : '💵 Cash'}
                                    </span>
                                    <span className="inst-rcp-amount">
                                      Allocated: <strong>{formatCurrency(inst.allocated_amount || inst.amount)}</strong>
                                    </span>
                                    {onViewReceipt && (
                                      <button
                                        type="button"
                                        className="btn-view-rcp-mini"
                                        onClick={() => onViewReceipt(inst.id)}
                                        title="View Official JPG Receipt & WhatsApp Share"
                                      >
                                        <Receipt size={12} /> View Receipt
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}