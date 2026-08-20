/**
 * CashCollectionSummary — School Management System (Frontend)
 *
 * Day 7: Payment History & Financial Validation.
 *
 * Renders daily, weekly, and monthly cash collection summary cards.
 */

import { IndianRupee, Calendar, TrendingUp, Receipt } from 'lucide-react';
import './CashCollectionSummary.css';

export default function CashCollectionSummary({ summary, loading }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const grandTotal = summary?.grand_total || summary?.total_amount || 0;
  const totalCount = summary?.total_count || summary?.total_records || 0;

  // Calculate today's and this month's totals from summary arrays if available
  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonthStr = new Date().toISOString().slice(0, 7);

  const todayCollection = summary?.daily?.find(d => d.date_str === todayStr)?.total_amount || 0;
  const monthCollection = summary?.monthly?.find(m => m.month_str === thisMonthStr)?.total_amount || 0;

  return (
    <div className="collection-summary-container">
      <div className="summary-card primary">
        <div className="card-icon">
          <IndianRupee size={22} />
        </div>
        <div className="card-details">
          <span className="card-title">Total Cash Collected</span>
          <span className="card-amount">{formatCurrency(grandTotal)}</span>
          <span className="card-subtitle">{totalCount} total collections</span>
        </div>
      </div>

      <div className="summary-card success">
        <div className="card-icon">
          <Calendar size={22} />
        </div>
        <div className="card-details">
          <span className="card-title">Today's Collection</span>
          <span className="card-amount text-success">{formatCurrency(todayCollection)}</span>
          <span className="card-subtitle">{todayStr}</span>
        </div>
      </div>

      <div className="summary-card info">
        <div className="card-icon">
          <TrendingUp size={22} />
        </div>
        <div className="card-details">
          <span className="card-title">This Month's Collection</span>
          <span className="card-amount text-info">{formatCurrency(monthCollection)}</span>
          <span className="card-subtitle">{thisMonthStr}</span>
        </div>
      </div>

      <div className="summary-card purple">
        <div className="card-icon">
          <Receipt size={22} />
        </div>
        <div className="card-details">
          <span className="card-title">Total Receipts Issued</span>
          <span className="card-amount">{totalCount}</span>
          <span className="card-subtitle">Validated fee receipts</span>
        </div>
      </div>
    </div>
  );
}