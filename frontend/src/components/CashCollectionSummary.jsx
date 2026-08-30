/**
 * CashCollectionSummary — School Management System (Frontend)
 *
 * Renders live, responsive 4-KPI Collection Cards (2x2 on Mobile).
 */

import { IndianRupee, Calendar, TrendingUp, Receipt, Building2, Wallet } from 'lucide-react';
import './CashCollectionSummary.css';

export default function CashCollectionSummary({ summary, loading }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonthStr = new Date().toISOString().slice(0, 7);

  const grandTotal = Number(
    summary?.total_amount ?? summary?.grand_total ?? (typeof summary?.total === 'object' ? summary?.total?.amount : summary?.total) ?? 0
  );
  const totalCount = Number(
    summary?.total_count ?? summary?.total_records ?? (typeof summary?.total === 'object' ? summary?.total?.count : 0) ?? 0
  );

  const todayTotal = Number(
    summary?.today_amount ?? summary?.today_total ?? (summary?.daily?.find(d => d.date === todayStr || d.date_str === todayStr)?.total || 0)
  );
  const todayCount = Number(
    summary?.today_count ?? (summary?.daily?.find(d => d.date === todayStr || d.date_str === todayStr)?.count || (todayTotal > 0 ? 1 : 0))
  );

  const monthTotal = Number(
    summary?.month_amount ?? summary?.month_total ?? (summary?.monthly?.find(m => m.month === thisMonthStr || m.month_str === thisMonthStr)?.total || 0)
  );

  const cashTotal = Number(summary?.cash_total ?? summary?.cash_amount ?? 0);
  const bankTotal = Number(summary?.bank_total ?? summary?.bank_amount ?? 0);

  const todayFormatted = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const monthFormatted = new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  return (
    <div className="collection-summary-container">
      {/* Card 1: Total Collections */}
      <div className="summary-card primary">
        <div className="card-icon">
          <IndianRupee size={20} />
        </div>
        <div className="card-details">
          <span className="card-title">Total Revenue</span>
          <span className="card-amount">{formatCurrency(grandTotal)}</span>
          <span className="card-subtitle">{totalCount} Validated Receipts</span>
        </div>
      </div>

      {/* Card 2: Today's Collections */}
      <div className="summary-card success">
        <div className="card-icon">
          <Calendar size={20} />
        </div>
        <div className="card-details">
          <span className="card-title">Today's Collection</span>
          <span className="card-amount text-success">{formatCurrency(todayTotal)}</span>
          <span className="card-subtitle">{todayFormatted} &bull; {todayCount} Today</span>
        </div>
      </div>

      {/* Card 3: This Month's Collections */}
      <div className="summary-card info">
        <div className="card-icon">
          <TrendingUp size={20} />
        </div>
        <div className="card-details">
          <span className="card-title">Monthly Intake</span>
          <span className="card-amount text-info">{formatCurrency(monthTotal)}</span>
          <span className="card-subtitle">{monthFormatted}</span>
        </div>
      </div>

      {/* Card 4: Digital / Bank & Cash Split */}
      <div className="summary-card purple">
        <div className="card-icon">
          <Building2 size={20} />
        </div>
        <div className="card-details">
          <span className="card-title">Bank &amp; Digital</span>
          <span className="card-amount text-purple">{formatCurrency(bankTotal)}</span>
          <span className="card-subtitle">💵 {formatCurrency(cashTotal)} in Cash</span>
        </div>
      </div>
    </div>
  );
}