/**
 * FeeLedgerTable — School Management System (Frontend)
 *
 * Exact Excel-Style School Fee Register matching attached photo spec.
 * Columns: Month, Opening Balance, Other Charges, Monthly Fee, Total, Paid, Closing Balance, Payment Date, Remark, Actions.
 * Admin Features: Edit Monthly Fee, Delete Month Entry, 1-Click + Assign Next Month.
 */

import React, { useState } from 'react';
import { Loader2, CalendarPlus, BookOpen, Edit2, Trash2, Check, X, ChevronDown, ChevronRight, Receipt } from 'lucide-react';
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
        <span>Loading fee register…</span>
      </div>
    );
  }

  // Sort rows chronologically by fee_year ASC, fee_month ASC
  const sortedFees = [...monthlyFees].sort((a, b) => {
    if (a.fee_year !== b.fee_year) return a.fee_year - b.fee_year;
    return a.fee_month - b.fee_month;
  });

  // Determine next month and year to assign automatically (starts AFTER admission month if no entries exist)
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

  // Calculate dynamic running balances (including advance credit carry-forward)
  let runningOpeningBalance = 0;
  let sumTotalFees = 0;
  let sumTotalPaid = 0;

  const ledgerRows = sortedFees.map((fee) => {
    const openingBalance = runningOpeningBalance;
    const monthlyFee = Number(fee.fee_amount || 0);
    const otherCharges = Number(fee.other_charges || 0);
    const total = openingBalance + monthlyFee + otherCharges;

    // Use payments made IN this specific month (month_actual_paid) or fallback
    const paidInMonth = fee.month_actual_paid !== undefined ? Number(fee.month_actual_paid) : Number(fee.paid_amount || 0);
    const paid = paidInMonth;

    // Net balance (positive = dues, negative = advance credit)
    const netBalance = total - paid;
    const closingBalance = Math.max(0, netBalance);

    // Carry forward exact net balance (positive dues OR negative advance) to next month
    runningOpeningBalance = netBalance;

    sumTotalFees += monthlyFee + otherCharges;
    sumTotalPaid += paid;

    // Month label format: e.g. "Sep-25", "Oct-25"
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
          <span className="box-label">Total Paid</span>
          <span className="box-value text-green">{formatCurrency(sumTotalPaid)}</span>
        </div>

        {/* Most Prominent Current Balance Card */}
        <div className="summary-box-dark prominent-balance-box-dark">
          <span className="box-label">Current Balance</span>
          <span className="box-value prominent-value">{formatCurrency(finalCurrentBalance)}</span>
        </div>
      </div>

      {/* Traditional School Fee Register Table - Excel Style Theme */}
      <div className="register-card-dark">
        <div className="register-header-dark">
          <div className="header-left">
            <BookOpen size={20} className="register-icon-teal" />
            <span className="register-title">Student Fee Register</span>
          </div>
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

        <div className="register-table-responsive">
          <table className="dark-register-table excel-style-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Opening Balance</th>
                <th className="text-right">Other Charge</th>
                <th className="text-right">Monthly Fee</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Closing Balance</th>
                <th className="text-center">Payment Date</th>
                <th className="text-left">Remark</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty-register-cell-dark">
                    No fee records generated yet. Click <strong>"+ Assign Next Month"</strong> to assign first month.
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
                                title={isExpanded ? 'Hide installment breakdown' : 'View installment breakdown'}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}
                            <span>{row.monthLabel}</span>
                            {hasInstallments && row.installments.length > 1 && (
                              <span className="parts-badge">{row.installments.length} parts</span>
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
                            <span>{formatCurrency(row.monthlyFee)}</span>
                          )}
                        </td>
                        <td className={`text-right font-medium ${row.total < 0 ? 'text-advance-green' : ''}`}>
                          {row.total < 0 ? `-₹${Math.abs(row.total).toLocaleString('en-IN')}` : formatCurrency(row.total)}
                        </td>
                        <td className="text-right text-light-paid">
                          {row.paid > 0 ? formatCurrency(row.paid) : '—'}
                        </td>
                        <td className={`text-right closing-cell-dark ${row.closingBalance > 0 ? 'has-balance-red' : 'zero-balance-white'}`}>
                          {formatCurrency(row.closingBalance)}
                        </td>
                        <td className="text-center date-cell-dark">{row.paid > 0 ? row.paymentDate : '—'}</td>
                        <td className="text-left remark-cell-dark">
                          {row.remark === 'in acc.' && <span className="remark-in-account">{row.remark}</span>}
                          {row.remark === 'cash' && <span className="remark-cash">{row.remark}</span>}
                          {row.remark === 'advance' && <span className="remark-advance">advance</span>}
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
                                title={row.paid > 0 ? "Cannot delete month with payments" : "Delete Month Entry"}
                              >
                                {deletingId === row.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Sub-Row for Half-Month / Multi-Installment Breakdown */}
                      {isExpanded && hasInstallments && (
                        <tr key={`${row.id}-installments`} className="installments-subrow-dark">
                          <td colSpan={10}>
                            <div className="installments-container-dark">
                              <span className="installments-title-dark">
                                🗓️ Installment Payment Breakdown for {row.monthLabel}:
                              </span>
                              <div className="installments-chips-wrap">
                                {row.installments.map((inst, idx) => {
                                  const instMode = (inst.payment_mode || inst.mode || 'CASH').toLowerCase();
                                  const isAccount = instMode.includes('account') || instMode.includes('bank') || instMode.includes('online');
                                  return (
                                    <div key={inst.id || idx} className="installment-chip-dark">
                                      <span className="chip-part-badge">Part #{idx + 1}</span>
                                      <span className="chip-date-text">{formatDateDDMMYY(inst.payment_date || inst.created_at)}</span>
                                      <span className="chip-amount-text">{formatCurrency(inst.amount)}</span>
                                      <span className={`chip-mode-badge ${isAccount ? 'in-acc' : 'cash'}`}>
                                        {isAccount ? 'in acc.' : 'cash'}
                                      </span>
                                      {inst.receipt_number && (
                                        <span className="chip-receipt-text">📄 {inst.receipt_number}</span>
                                      )}
                                      {inst.notes && <span className="chip-notes-text">({inst.notes})</span>}
                                    </div>
                                  );
                                })}
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