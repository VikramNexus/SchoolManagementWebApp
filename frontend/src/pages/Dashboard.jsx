/**
 * Dashboard — School Management System (Frontend)
 * Eye-Comfort, Receipt-Themed Interactive Executive Dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  User,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  Plus,
  AlertTriangle,
  Receipt,
  CreditCard,
  ArrowRight,
  MessageSquare,
  Database,
  BarChart2,
  CheckCircle2,
  GraduationCap,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import StudentModal from '../components/StudentModal';
import './Dashboard.css';

export default function Dashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState({});
  const [school, setSchool] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Admission Modal state
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [kpiRes, schoolRes, classesRes, sectionsRes] = await Promise.all([
        api.get('/dashboard/kpis'),
        api.get('/settings/school'),
        api.get('/settings/classes'),
        api.get('/settings/sections'),
      ]);

      if (kpiRes.data.success) {
        setKpis(kpiRes.data.kpis || {});
      }
      if (schoolRes.data.success && schoolRes.data.school) {
        setSchool(schoolRes.data.school);
      }
      if (classesRes.data.success) {
        setClasses(classesRes.data.classes || []);
      }
      if (sectionsRes.data.success) {
        setSections(sectionsRes.data.sections || []);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load dashboard data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '0';
    return new Intl.NumberFormat('en-IN').format(value);
  };

  // Calculate collection efficiency percentage
  const expectedTotal = Number(kpis.expected_fees || 0);
  const collectedTotal = Number(kpis.collected_fees || 0);
  const collectionRate =
    expectedTotal > 0 ? Math.min(100, Math.round((collectedTotal / expectedTotal) * 100)) : 0;

  return (
    <div className="dashboard-container">
      {/* Header Card (Eye-Comfort Theme matching Receipts) */}
      <div className="dashboard-header-card">
        <div className="header-left-wrap">
          <div className="dashboard-icon-badge">
            <LayoutDashboard size={26} />
          </div>
          <div>
            <h1 className="dashboard-heading">
              {school.school_name || 'Aryavart Shikshan Sansthan'} — Dashboard
            </h1>
            <p className="dashboard-subheading">
              Real-time operational summary, collection metrics, and administrative shortcuts.
            </p>
          </div>
        </div>

        <div className="dashboard-header-actions">
          <button
            type="button"
            className="btn-admission-primary"
            onClick={() => navigate('/admissions')}
          >
            <Plus size={18} />
            <span>+ New Admission</span>
          </button>
          <button
            type="button"
            className="btn-dashboard-refresh"
            onClick={fetchData}
            disabled={loading}
            title="Refresh Dashboard"
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={17} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="dashboard-alert-banner" role="alert">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={fetchData} className="alert-retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Branded Institution Status Banner (Receipt Letterhead Look) */}
      <div className="institution-letterhead-banner">
        <div className="letterhead-left">
          <div className="institution-badge-icon">
            <GraduationCap size={22} />
          </div>
          <div className="institution-meta">
            <span className="inst-session-badge">
              <Calendar size={13} /> Session {school.academic_year || '2025-2026'}
            </span>
            <h2 className="inst-name">{school.school_name || 'Aryavart Shikshan Sansthan'}</h2>
            <p className="inst-address">
              {school.address || 'Shastri Nagar Bara Chakia, East Champaran - 845412'}
            </p>
          </div>
        </div>

        <div className="letterhead-stats">
          <div className="mini-stat-box">
            <span className="mini-stat-label">Collection Rate</span>
            <div className="mini-stat-bar-wrap">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${collectionRate}%` }} />
              </div>
              <span className="progress-percent">{collectionRate}%</span>
            </div>
          </div>
          <div className="mini-stat-divider" />
          <div className="mini-stat-box">
            <span className="mini-stat-label">Enrolled Students</span>
            <span className="mini-stat-value">{formatNumber(kpis.total_students)} Active</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid — Demographics & Overview */}
      <div className="dashboard-kpi-grid">
        {/* Total Students */}
        <div
          className="kpi-receipt-card primary"
          onClick={() => navigate('/students')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top-row">
            <span className="kpi-tag primary">Enrollment</span>
            <div className="kpi-icon-bubble primary">
              <Users size={20} />
            </div>
          </div>
          <p className="kpi-title">Total Active Students</p>
          <p className="kpi-amount">{loading ? '…' : formatNumber(kpis.total_students)}</p>
          <div className="kpi-footer-hint">
            <span>View all enrolled students</span>
            <ArrowRight size={13} />
          </div>
        </div>

        {/* Hostellers */}
        <div
          className="kpi-receipt-card blue"
          onClick={() => navigate('/students?category=hosteller')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top-row">
            <span className="kpi-tag blue">Hostel Wing</span>
            <div className="kpi-icon-bubble blue">
              <Building2 size={20} />
            </div>
          </div>
          <p className="kpi-title">Hosteller Students</p>
          <p className="kpi-amount">{loading ? '…' : formatNumber(kpis.hostellers)}</p>
          <div className="kpi-footer-hint">
            <span>Filter hosteller directory</span>
            <ArrowRight size={13} />
          </div>
        </div>

        {/* Day Scholars */}
        <div
          className="kpi-receipt-card green"
          onClick={() => navigate('/students?category=day_scholar')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top-row">
            <span className="kpi-tag green">Day Wing</span>
            <div className="kpi-icon-bubble green">
              <User size={20} />
            </div>
          </div>
          <p className="kpi-title">Day Scholar Students</p>
          <p className="kpi-amount">{loading ? '…' : formatNumber(kpis.day_scholars)}</p>
          <div className="kpi-footer-hint">
            <span>Filter day scholar directory</span>
            <ArrowRight size={13} />
          </div>
        </div>

        {/* Net Outstanding Dues */}
        <div
          className="kpi-receipt-card danger"
          onClick={() => navigate('/pending-fees')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top-row">
            <span className="kpi-tag danger">Unpaid Dues</span>
            <div className="kpi-icon-bubble danger">
              <TrendingDown size={20} />
            </div>
          </div>
          <p className="kpi-title">Net Outstanding Dues</p>
          <p className="kpi-amount">{loading ? '…' : formatCurrency(kpis.outstanding_fees)}</p>
          <div className="kpi-footer-hint">
            <span>Review unpaid student ledger</span>
            <ArrowRight size={13} />
          </div>
        </div>
      </div>

      {/* Revenue Collections Breakdown Section (Split Categories) */}
      <div className="revenue-split-section">
        <div className="revenue-section-header">
          <div className="d-flex align-center gap-2">
            <div className="revenue-badge-icon">
              <IndianRupee size={20} />
            </div>
            <div>
              <h2 className="revenue-section-title">Fee Collections Breakdown &amp; Revenue Channels</h2>
              <p className="revenue-section-sub">
                Categorized payment metrics distinguishing regular monthly fees from admission desk collections.
              </p>
            </div>
          </div>
        </div>

        <div className="revenue-split-grid">
          {/* Total Collections */}
          <div
            className="revenue-stat-card total"
            onClick={() => navigate('/payments')}
            role="button"
            tabIndex={0}
          >
            <div className="rev-card-top">
              <span className="rev-tag total">Total Revenue</span>
              <div className="rev-icon total">
                <TrendingUp size={20} />
              </div>
            </div>
            <span className="rev-label">Total Payment Collected</span>
            <span className="rev-value text-emerald">
              {loading ? '…' : formatCurrency(kpis.collected_fees)}
            </span>
            <span className="rev-subtext">All revenue collected across all categories</span>
          </div>

          {/* Monthly Fees Collected */}
          <div
            className="revenue-stat-card monthly"
            onClick={() => navigate('/payments')}
            role="button"
            tabIndex={0}
          >
            <div className="rev-card-top">
              <span className="rev-tag monthly">Monthly Fees</span>
              <div className="rev-icon monthly">
                <Calendar size={20} />
              </div>
            </div>
            <span className="rev-label">Collected through Monthly Fees</span>
            <span className="rev-value text-blue">
              {loading ? '…' : formatCurrency(kpis.monthly_fees_collected ?? kpis.collected_fees)}
            </span>
            <span className="rev-subtext">Tuition, regular monthly hostel &amp; family fees</span>
          </div>

          {/* Admission Desk Collections */}
          <div
            className="revenue-stat-card admission"
            onClick={() => navigate('/admissions')}
            role="button"
            tabIndex={0}
          >
            <div className="rev-card-top">
              <span className="rev-tag admission">Admission Desk</span>
              <div className="rev-icon admission">
                <GraduationCap size={20} />
              </div>
            </div>
            <span className="rev-label">Collected through Admission Desk</span>
            <span className="rev-value text-purple">
              {loading ? '…' : formatCurrency(kpis.admission_fees_collected ?? 0)}
            </span>
            <span className="rev-subtext">Admission charges, caution money &amp; advance fees</span>
          </div>
        </div>
      </div>

      {/* Quick Administrative Action Hub */}
      <div className="quick-actions-card">
        <div className="actions-card-header">
          <div className="actions-header-left">
            <Sparkles size={20} className="text-primary" />
            <div>
              <h2 className="actions-title">Administrative Quick Operations</h2>
              <p className="actions-subtitle">Direct shortcuts for daily fee desk and student operations.</p>
            </div>
          </div>
        </div>

        <div className="quick-actions-grid">
          <button
            type="button"
            className="action-tile primary-tile"
            onClick={() => navigate('/admissions')}
          >
            <div className="tile-icon-box primary">
              <Plus size={22} />
            </div>
            <div className="tile-text">
              <span className="tile-label">Admission Desk</span>
              <span className="tile-desc">Enroll &amp; collect advance fees</span>
            </div>
          </button>

          <button
            type="button"
            className="action-tile"
            onClick={() => navigate('/payments')}
          >
            <div className="tile-icon-box green">
              <CreditCard size={22} />
            </div>
            <div className="tile-text">
              <span className="tile-label">Record Payment</span>
              <span className="tile-desc">Collect fees &amp; generate receipt</span>
            </div>
          </button>

          <button
            type="button"
            className="action-tile"
            onClick={() => navigate('/pending-fees')}
          >
            <div className="tile-icon-box orange">
              <AlertTriangle size={22} />
            </div>
            <div className="tile-text">
              <span className="tile-label">Pending Dues</span>
              <span className="tile-desc">Review student fee dues</span>
            </div>
          </button>

          <button
            type="button"
            className="action-tile"
            onClick={() => navigate('/receipts')}
          >
            <div className="tile-icon-box cyan">
              <Receipt size={22} />
            </div>
            <div className="tile-text">
              <span className="tile-label">Receipt History</span>
              <span className="tile-desc">Print &amp; download PDF receipts</span>
            </div>
          </button>

          <button
            type="button"
            className="action-tile"
            onClick={() => navigate('/messages')}
          >
            <div className="tile-icon-box purple">
              <MessageSquare size={22} />
            </div>
            <div className="tile-text">
              <span className="tile-label">Due Reminders</span>
              <span className="tile-desc">Send WhatsApp &amp; SMS alerts</span>
            </div>
          </button>

          <button
            type="button"
            className="action-tile"
            onClick={() => navigate('/backup')}
          >
            <div className="tile-icon-box slate">
              <Database size={22} />
            </div>
            <div className="tile-text">
              <span className="tile-label">Backup &amp; Restore</span>
              <span className="tile-desc">Download safe SQL snapshots</span>
            </div>
          </button>
        </div>
      </div>

      {/* New Admission Modal */}
      {showAdmissionModal && (
        <StudentModal
          classes={classes}
          sections={sections}
          onClose={() => setShowAdmissionModal(false)}
          onSaved={() => {
            setShowAdmissionModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}