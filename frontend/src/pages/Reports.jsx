/**
 * Reports Page — School Management System (Frontend)
 * Professional 4-Pillar Executive Intelligence Suite
 *
 * 1. Executive Command Center & Today's Day-Book
 * 2. 3-Tier Defaulter Intelligence & Aging Recovery
 * 3. Student Demographics & Capacity Matrix
 * 4. Auditing, Master Excel & Printable Exports
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  AlertTriangle,
  Users,
  BarChart3,
  FileSpreadsheet,
  Download,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Building2,
  DollarSign,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Filter,
  UserCheck,
  Loader2,
  ExternalLink,
  Receipt,
  GraduationCap
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { saveFileToDeviceStorage } from '../utils/fileDownloader';
import './Reports.css';

export default function Reports() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('executive');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Executive Data State
  const [executiveData, setExecutiveData] = useState(null);

  // Defaulters Tab State
  const [pendingStudents, setPendingStudents] = useState([]);
  const [pendingSummary, setPendingSummary] = useState({
    total_students_with_dues: 0,
    total_monthly_dues: 0,
    total_additional_dues: 0,
    total_outstanding: 0,
  });
  const [classesList, setClassesList] = useState([]);
  const [duesSearch, setDuesSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAging, setSelectedAging] = useState('all'); // 'all' | 'mild' | 'moderate' | 'critical'
  const [duesPage, setDuesPage] = useState(1);
  const [duesTotalPages, setDuesTotalPages] = useState(1);
  const [loadingDues, setLoadingDues] = useState(false);

  // Action states
  const [sendingWaId, setSendingWaId] = useState(null);
  const [exportingZip, setExportingZip] = useState(false);

  const TABS = [
    { id: 'executive', label: 'Executive & Day-Book', icon: BarChart3, badge: 'Live Today' },
    { id: 'defaulters', label: 'Defaulters & Aging', icon: AlertTriangle, badge: 'Recovery' },
    { id: 'demographics', label: 'Student Demographics', icon: Users },
    { id: 'audit-exports', label: 'Auditing & Exports', icon: FileSpreadsheet },
  ];

  // 1. Fetch Executive Overview Data
  const fetchExecutiveOverview = useCallback(async () => {
    try {
      const res = await api.get('/reports/executive-overview');
      if (res.data.success) {
        setExecutiveData(res.data.data);
      }
    } catch (err) {
      console.error('[fetchExecutiveOverview]', err);
      setError(err.response?.data?.message || 'Failed to load executive overview.');
    }
  }, []);

  // 2. Fetch Classes
  const fetchClasses = useCallback(async () => {
    try {
      const res = await api.get('/settings/classes');
      if (res.data.success) {
        setClassesList(res.data.classes || []);
      }
    } catch (err) {
      console.error('[fetchClasses]', err);
    }
  }, []);

  // 3. Fetch Pending Dues with Aging Filter
  const fetchPendingDues = useCallback(async () => {
    try {
      setLoadingDues(true);
      const params = new URLSearchParams({
        page: duesPage,
        limit: 50,
      });
      if (duesSearch) params.append('search', duesSearch.trim());
      if (selectedClass) params.append('class_id', selectedClass);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedAging !== 'all') params.append('aging', selectedAging);

      const res = await api.get(`/reports/pending-dues-list?${params.toString()}`);
      if (res.data.success) {
        setPendingStudents(res.data.students || []);
        setPendingSummary(res.data.summary || {});
        setDuesTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('[fetchPendingDues]', err);
      toast.error('Failed to load defaulter students list.');
    } finally {
      setLoadingDues(false);
    }
  }, [duesPage, duesSearch, selectedClass, selectedCategory, selectedAging, toast]);

  // Initial Load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchExecutiveOverview(), fetchClasses(), fetchPendingDues()]);
      setLoading(false);
    }
    init();
  }, [fetchExecutiveOverview, fetchClasses, fetchPendingDues]);

  // Handle Manual Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchExecutiveOverview(), fetchPendingDues()]);
    setRefreshing(false);
    toast.success('✓ Reports data refreshed live!');
  };

  // Export Class-Wise ZIP Archive
  const handleExportZip = async () => {
    try {
      setExportingZip(true);
      const res = await api.get('/backup/export-excel-archive', {
        responseType: 'arraybuffer',
      });
      const filename = `Aryavart_ClassWise_Dossiers_${new Date().toISOString().slice(0, 10)}.zip`;
      const blob = new Blob([res.data], { type: 'application/zip' });
      await saveFileToDeviceStorage({
        data: blob,
        filename,
        mimeType: 'application/zip',
      });
      toast.success('✓ Class-Wise Student Excel Archive (.zip) downloaded successfully!');
    } catch (err) {
      console.error('[handleExportZip]', err);
      toast.error('Failed to export Class-Wise ZIP archive.');
    } finally {
      setExportingZip(false);
    }
  };

  // Send WhatsApp Reminder
  const handleSendWhatsApp = async (student) => {
    const phone = student.whatsapp_number || student.phone;
    if (!phone) {
      toast.error('No contact number available for this student.');
      return;
    }
    const cleanPhone = String(phone).replace(/\D/g, '');
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `Dear Parent,\nThis is a gentle fee reminder from Aryavart (P.S.G) Shikshan Sansthan for ${student.full_name} (${student.class_name}). Outstanding dues: Rs. ${Number(student.total_dues || 0).toLocaleString('en-IN')}.\nPlease clear at the school counter.\nThank you.`;

    try {
      setSendingWaId(student.id);
      // Attempt backend direct gateway dispatch first
      const res = await api.post('/messages/send-single', {
        student_id: student.id,
        phone: targetPhone,
        message: msg,
      }).catch(() => null);

      if (res?.data?.success) {
        toast.success(`✓ Dues reminder sent to ${student.full_name}'s phone!`);
      } else {
        // Fallback to WhatsApp Web Direct URL
        const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
        toast.info('Opened in WhatsApp Web.');
      }
    } catch (e) {
      const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
    } finally {
      setSendingWaId(null);
    }
  };

  // Print Dues Notice
  const handlePrintDuesNotice = async (studentId) => {
    try {
      const res = await api.get(`/reports/dues-notice/${studentId}`, {
        responseType: 'blob',
      }).catch(async () => {
        return await api.get(`/students/${studentId}/dues-notice`, { responseType: 'blob' });
      });
      const fileUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const printWindow = window.open(fileUrl);
      if (printWindow) {
        printWindow.focus();
      }
    } catch (err) {
      console.error('[handlePrintDuesNotice]', err);
      toast.error('Could not generate dues notice PDF.');
    }
  };

  // Helper formatting
  const formatRs = (num) => `₹${Number(num || 0).toLocaleString('en-IN')}`;

  const todayData = executiveData?.today || { total: 0, cash: 0, bank: 0, transactions: 0, recent_receipts: [] };
  const fin = executiveData?.financials || { assessed: 0, collected: 0, outstanding: 0, recovery_rate: 0 };
  const demo = executiveData?.demographics || { total_students: 0, hostellers: 0, day_scholars: 0, families: 0 };
  const classesMatrix = executiveData?.classes || [];
  const modesData = executiveData?.modes || [];
  const feeHeads = executiveData?.fee_heads || { tuition: 0, admission: 0 };

  return (
    <div className="reports-page-wrapper">
      {/* 1. Executive Top Header */}
      <div className="reports-header-card">
        <div className="header-left">
          <div className="school-shield-icon">
            <GraduationCap size={28} />
          </div>
          <div>
            <h1 className="reports-main-title">Reports &amp; Financial Intelligence</h1>
            <p className="reports-sub-title">
              Aryavart (P.S.G) Shikshan Sansthan &bull; Academic Session 2025–2026 &bull; Real-time Analytics
            </p>
          </div>
        </div>

        <div className="header-right-actions">
          <button
            type="button"
            className="btn-refresh-data"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh live data"
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Refreshing…' : 'Sync Live Data'}</span>
          </button>

          <button
            type="button"
            className="btn-header-export-zip"
            onClick={handleExportZip}
            disabled={exportingZip}
          >
            {exportingZip ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />}
            <span>{exportingZip ? 'Packing ZIP…' : 'Class-Wise Excel Dossiers (.zip)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4-KPI Command Ribbon */}
      <div className="reports-kpi-ribbon">
        {/* KPI 1: Today's Collection */}
        <div className="kpi-ribbon-card glow-blue">
          <div className="kpi-top-row">
            <span className="kpi-tag blue">Today's Counter Day-Book</span>
            <span className="kpi-count-pill">{todayData.transactions} Receipts</span>
          </div>
          <div className="kpi-number-val">{formatRs(todayData.total)}</div>
          <div className="kpi-bottom-row">
            <span className="channel-split-badge cash">💵 Cash: {formatRs(todayData.cash)}</span>
            <span className="channel-split-badge bank">🏦 Bank: {formatRs(todayData.bank)}</span>
          </div>
        </div>

        {/* KPI 2: Session Recovery Rate */}
        <div className="kpi-ribbon-card glow-green">
          <div className="kpi-top-row">
            <span className="kpi-tag green">Session Revenue Recovery</span>
            <span className="kpi-pct-badge">{fin.recovery_rate}% Cleared</span>
          </div>
          <div className="kpi-number-val text-green">{formatRs(fin.collected)}</div>
          <div className="recovery-progress-bar-bg">
            <div className="recovery-progress-bar-fill" style={{ width: `${Math.min(100, fin.recovery_rate)}%` }} />
          </div>
          <div className="kpi-sub-text">Assessed Target: {formatRs(fin.assessed)}</div>
        </div>

        {/* KPI 3: Outstanding Dues */}
        <div className="kpi-ribbon-card glow-red">
          <div className="kpi-top-row">
            <span className="kpi-tag red">Total Outstanding Dues</span>
            <span className="kpi-count-pill red">{pendingSummary.total_students_with_dues || 0} Students</span>
          </div>
          <div className="kpi-number-val text-red">{formatRs(fin.outstanding)}</div>
          <div className="kpi-sub-text">
            Monthly: {formatRs(pendingSummary.total_monthly_dues)} &bull; Term/Admission: {formatRs(pendingSummary.total_additional_dues)}
          </div>
        </div>

        {/* KPI 4: Active Strength */}
        <div className="kpi-ribbon-card glow-purple">
          <div className="kpi-top-row">
            <span className="kpi-tag purple">Active School Strength</span>
            <span className="kpi-count-pill">{demo.families} Families</span>
          </div>
          <div className="kpi-number-val">{demo.total_students} Students</div>
          <div className="kpi-bottom-row">
            <span className="category-pill hosteller">🏠 {demo.hostellers} Hostellers</span>
            <span className="category-pill dayscholar">🚶 {demo.day_scholars} Day Scholars</span>
          </div>
        </div>
      </div>

      {/* 3. Tab Navigation Bar */}
      <div className="reports-tab-bar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`report-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
              {tab.badge && <span className="tab-pill-badge">{tab.badge}</span>}
            </button>
          );
        })}
      </div>

      {/* 4. Tab Content Area */}
      <div className="reports-tab-body">
        {loading ? (
          <div className="reports-loading-state">
            <Loader2 size={36} className="spin text-blue" />
            <p>Loading real-time financial intelligence &amp; rosters…</p>
          </div>
        ) : error ? (
          <div className="reports-error-state">
            <AlertTriangle size={32} />
            <p>{error}</p>
            <button type="button" onClick={handleRefresh} className="btn-retry">Try Again</button>
          </div>
        ) : (
          <>
            {/* ============================================================ */}
            {/* TAB 1: EXECUTIVE COMMAND CENTER & TODAY'S DAY-BOOK            */}
            {/* ============================================================ */}
            {activeTab === 'executive' && (
              <div className="tab-pane-fade">
                {/* Day-Book Section */}
                <div className="executive-grid-2col">
                  {/* Left: Today's Receipts Log */}
                  <div className="card-panel">
                    <div className="panel-header">
                      <div className="panel-title-wrap">
                        <Receipt size={18} className="text-blue" />
                        <div>
                          <h3 className="panel-title">Today's Counter Day-Book Receipts</h3>
                          <span className="panel-sub">Validated collections cut on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <span className="badge-chip blue">{todayData.transactions} Receipts Cut</span>
                    </div>

                    {todayData.recent_receipts && todayData.recent_receipts.length > 0 ? (
                      <div className="table-responsive">
                        <table className="clean-report-table">
                          <thead>
                            <tr>
                              <th>Receipt No</th>
                              <th>Student</th>
                              <th>Class</th>
                              <th>Channel</th>
                              <th className="text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {todayData.recent_receipts.map((rcp) => (
                              <tr key={rcp.id}>
                                <td>
                                  <span className="mono-receipt-tag">{rcp.receipt_number || `RCP-${rcp.id}`}</span>
                                </td>
                                <td>
                                  <strong className="student-click-link" onClick={() => navigate(`/students/${rcp.student_id}`)}>
                                    {rcp.student_name}
                                  </strong>
                                  <small className="student-adm-sub">({rcp.admission_no || 'N/A'})</small>
                                </td>
                                <td>{rcp.class_name || 'Class'}</td>
                                <td>
                                  <span className={`channel-pill ${rcp.payment_mode === 'IN_ACCOUNT' ? 'bank' : 'cash'}`}>
                                    {rcp.payment_mode === 'IN_ACCOUNT' ? '🏦 Bank/UPI' : '💵 Cash'}
                                  </span>
                                </td>
                                <td className="text-right font-bold text-green">{formatRs(rcp.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-panel-msg">
                        <Receipt size={24} className="text-gray" />
                        <p>No receipts cut yet today. Counter collections will stream here in real time.</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Revenue Breakdown & Channel Split */}
                  <div className="card-panel">
                    <div className="panel-header">
                      <div className="panel-title-wrap">
                        <Layers size={18} className="text-indigo" />
                        <div>
                          <h3 className="panel-title">Revenue Composition &amp; Channels</h3>
                          <span className="panel-sub">Payment methods and fee heads breakdown</span>
                        </div>
                      </div>
                    </div>

                    <div className="breakdown-cards-stack">
                      {/* Payment Channels Card */}
                      <div className="sub-stat-card">
                        <h4 className="sub-stat-title">Payment Method Distribution</h4>
                        <div className="channels-progress-grid">
                          {modesData.map((m) => (
                            <div key={m.mode} className="channel-box">
                              <div className="channel-box-header">
                                <span>{m.mode === 'IN_ACCOUNT' ? '🏦 Bank / UPI Transfer' : '💵 Cash Handover'}</span>
                                <strong>{formatRs(m.amount)}</strong>
                              </div>
                              <div className="channel-box-bar">
                                <div
                                  className={`channel-bar-fill ${m.mode === 'IN_ACCOUNT' ? 'bank' : 'cash'}`}
                                  style={{ width: `${fin.collected > 0 ? (m.amount / fin.collected) * 100 : 50}%` }}
                                />
                              </div>
                              <small className="channel-count-lbl">{m.count} Total Transactions</small>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Fee Heads Card */}
                      <div className="sub-stat-card">
                        <h4 className="sub-stat-title">Fee Head Collections</h4>
                        <div className="feeheads-split-grid">
                          <div className="feehead-item">
                            <span className="head-lbl">Monthly Tuition Fees</span>
                            <span className="head-val text-blue">{formatRs(feeHeads.tuition)}</span>
                          </div>
                          <div className="feehead-item">
                            <span className="head-lbl">Admission &amp; Term Fees</span>
                            <span className="head-val text-green">{formatRs(feeHeads.admission)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Class-Wise Performance & Recovery Matrix Table */}
                <div className="card-panel full-width-panel">
                  <div className="panel-header">
                    <div className="panel-title-wrap">
                      <Building2 size={18} className="text-purple" />
                      <div>
                        <h3 className="panel-title">Class-Wise Recovery &amp; Financial Performance Matrix</h3>
                        <span className="panel-sub">Assessed vs. Collected Revenue by Class for Session 2025–2026</span>
                      </div>
                    </div>
                    <span className="badge-chip purple">{classesMatrix.length} Classes Tracked</span>
                  </div>

                  <div className="table-responsive">
                    <table className="clean-report-table matrix-table">
                      <thead>
                        <tr>
                          <th>Class Name</th>
                          <th className="text-center">Enrolled</th>
                          <th className="text-right">Total Assessed</th>
                          <th className="text-right">Collected</th>
                          <th className="text-right">Outstanding Due</th>
                          <th style={{ width: '180px' }}>Recovery %</th>
                          <th className="text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classesMatrix.map((cm) => (
                          <tr key={cm.class_id}>
                            <td>
                              <strong className="class-name-badge">{cm.class_name}</strong>
                            </td>
                            <td className="text-center font-semibold">{cm.student_count}</td>
                            <td className="text-right font-medium">{formatRs(cm.assessed_fee)}</td>
                            <td className="text-right text-green font-bold">{formatRs(cm.collected_fee)}</td>
                            <td className="text-right text-red font-bold">{formatRs(cm.due_fee)}</td>
                            <td>
                              <div className="matrix-recovery-bar-wrap">
                                <div className="matrix-progress-bg">
                                  <div
                                    className={`matrix-progress-fill ${cm.recovery_rate >= 80 ? 'high' : cm.recovery_rate >= 50 ? 'mid' : 'low'}`}
                                    style={{ width: `${Math.min(100, cm.recovery_rate)}%` }}
                                  />
                                </div>
                                <span className="matrix-pct-text">{cm.recovery_rate}%</span>
                              </div>
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn-table-action"
                                onClick={() => {
                                  setSelectedClass(String(cm.class_id));
                                  setActiveTab('defaulters');
                                }}
                              >
                                View Dues
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 2: DEFAULTER INTELLIGENCE & AGING RECOVERY               */}
            {/* ============================================================ */}
            {activeTab === 'defaulters' && (
              <div className="tab-pane-fade">
                {/* 3-Tier Aging Filter Bar */}
                <div className="defaulter-tier-bar">
                  <div className="tier-pill-group">
                    <button
                      type="button"
                      className={`tier-btn ${selectedAging === 'all' ? 'active' : ''}`}
                      onClick={() => { setSelectedAging('all'); setDuesPage(1); }}
                    >
                      <span>All Defaulters</span>
                      <span className="tier-count">{pendingSummary.total_students_with_dues}</span>
                    </button>

                    <button
                      type="button"
                      className={`tier-btn mild ${selectedAging === 'mild' ? 'active' : ''}`}
                      onClick={() => { setSelectedAging('mild'); setDuesPage(1); }}
                    >
                      <span>🟢 1 Month Due (Mild)</span>
                    </button>

                    <button
                      type="button"
                      className={`tier-btn moderate ${selectedAging === 'moderate' ? 'active' : ''}`}
                      onClick={() => { setSelectedAging('moderate'); setDuesPage(1); }}
                    >
                      <span>🟡 2 Months Due (Moderate)</span>
                    </button>

                    <button
                      type="button"
                      className={`tier-btn critical ${selectedAging === 'critical' ? 'active' : ''}`}
                      onClick={() => { setSelectedAging('critical'); setDuesPage(1); }}
                    >
                      <span>🔴 3+ Months Due (Critical)</span>
                    </button>
                  </div>
                </div>

                {/* Filter Controls Row */}
                <div className="dues-filter-row">
                  <div className="search-input-wrap">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      className="report-search-field"
                      value={duesSearch}
                      onChange={(e) => { setDuesSearch(e.target.value); setDuesPage(1); }}
                      placeholder="Search student by name, admission no, father's name or phone…"
                    />
                  </div>

                  <div className="select-filters-group">
                    <select
                      className="report-select-field"
                      value={selectedClass}
                      onChange={(e) => { setSelectedClass(e.target.value); setDuesPage(1); }}
                    >
                      <option value="">All Classes</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    <select
                      className="report-select-field"
                      value={selectedCategory}
                      onChange={(e) => { setSelectedCategory(e.target.value); setDuesPage(1); }}
                    >
                      <option value="">All Categories</option>
                      <option value="day_scholar">Day Scholar</option>
                      <option value="hosteller">Hosteller</option>
                    </select>
                  </div>
                </div>

                {/* Defaulter Students Table */}
                <div className="card-panel full-width-panel">
                  <div className="panel-header">
                    <div className="panel-title-wrap">
                      <AlertTriangle size={18} className="text-red" />
                      <div>
                        <h3 className="panel-title">Students with Outstanding Balances</h3>
                        <span className="panel-sub">Total Overdue: {formatRs(pendingSummary.total_outstanding)} across {pendingSummary.total_students_with_dues} students</span>
                      </div>
                    </div>
                  </div>

                  {loadingDues ? (
                    <div className="reports-loading-state mini">
                      <Loader2 size={24} className="spin text-blue" />
                      <span>Filtering defaulters roster…</span>
                    </div>
                  ) : pendingStudents.length > 0 ? (
                    <div className="table-responsive">
                      <table className="clean-report-table">
                        <thead>
                          <tr>
                            <th>Student &amp; Parent</th>
                            <th>Class</th>
                            <th>Contact</th>
                            <th>Aging Urgency</th>
                            <th className="text-right">Monthly Due</th>
                            <th className="text-right">Term/Other Due</th>
                            <th className="text-right">Total Outstanding</th>
                            <th className="text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingStudents.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <strong className="student-click-link" onClick={() => navigate(`/students/${s.id}`)}>
                                  {s.full_name}
                                </strong>
                                <div className="student-parent-sub">Father: {s.father_name || s.parent_name || '—'}</div>
                                <span className="mono-badge">Adm: {s.admission_no || 'N/A'}</span>
                              </td>
                              <td>
                                <span className="class-badge-pill">{s.class_name} {s.section_name ? `(${s.section_name})` : ''}</span>
                              </td>
                              <td>
                                <span className="phone-text">{s.whatsapp_number || s.phone || '—'}</span>
                              </td>
                              <td>
                                <span className={`urgency-badge ${s.tier || 'mild'}`}>
                                  {s.tier === 'critical' ? '🔴 Critical (3+ Mo)' : s.tier === 'moderate' ? '🟡 Moderate (2 Mo)' : '🟢 1 Month'}
                                </span>
                              </td>
                              <td className="text-right font-medium">{formatRs(s.monthly_dues)}</td>
                              <td className="text-right font-medium">{formatRs(s.additional_dues)}</td>
                              <td className="text-right text-red font-bold">{formatRs(s.total_dues)}</td>
                              <td className="text-center">
                                <div className="action-btn-cluster">
                                  <button
                                    type="button"
                                    className="btn-action-wa-icon"
                                    onClick={() => handleSendWhatsApp(s)}
                                    disabled={sendingWaId === s.id}
                                    title="Send WhatsApp Dues Reminder"
                                  >
                                    <Send size={14} />
                                    <span>{sendingWaId === s.id ? 'Sending…' : 'WhatsApp'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="btn-action-print-icon"
                                    onClick={() => handlePrintDuesNotice(s.id)}
                                    title="Print A4 Dues Notice"
                                  >
                                    <Printer size={14} />
                                    <span>Notice</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-panel-msg">
                      <CheckCircle2 size={32} className="text-green" />
                      <p>No outstanding dues found matching this filter criteria!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 3: STUDENT DEMOGRAPHICS & CAPACITY                      */}
            {/* ============================================================ */}
            {activeTab === 'demographics' && (
              <div className="tab-pane-fade">
                <div className="executive-grid-2col">
                  {/* Category Breakdown Card */}
                  <div className="card-panel">
                    <div className="panel-header">
                      <div className="panel-title-wrap">
                        <Users size={18} className="text-blue" />
                        <div>
                          <h3 className="panel-title">Student Category Distribution</h3>
                          <span className="panel-sub">Hostellers vs. Day Scholars Breakdown</span>
                        </div>
                      </div>
                    </div>

                    <div className="demo-category-grid">
                      <div className="demo-box dayscholar">
                        <div className="demo-box-icon">🚶</div>
                        <div className="demo-box-val">{demo.day_scholars}</div>
                        <div className="demo-box-lbl">Day Scholars (Local Commuters)</div>
                        <div className="demo-box-pct">
                          {demo.total_students > 0 ? ((demo.day_scholars / demo.total_students) * 100).toFixed(0) : 0}% of Total
                        </div>
                      </div>

                      <div className="demo-box hosteller">
                        <div className="demo-box-icon">🏠</div>
                        <div className="demo-box-val">{demo.hostellers}</div>
                        <div className="demo-box-lbl">Hostel Residents (Boarders)</div>
                        <div className="demo-box-pct">
                          {demo.total_students > 0 ? ((demo.hostellers / demo.total_students) * 100).toFixed(0) : 0}% of Total
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sibling & Household Distribution */}
                  <div className="card-panel">
                    <div className="panel-header">
                      <div className="panel-title-wrap">
                        <Users size={18} className="text-indigo" />
                        <div>
                          <h3 className="panel-title">Household &amp; Family Stats</h3>
                          <span className="panel-sub">Consolidated parent units and sibling accounts</span>
                        </div>
                      </div>
                    </div>

                    <div className="family-metrics-box">
                      <div className="metric-row">
                        <span>Total Active Households / Families:</span>
                        <strong>{demo.families} Households</strong>
                      </div>
                      <div className="metric-row">
                        <span>Total Enrolled Children:</span>
                        <strong>{demo.total_students} Students</strong>
                      </div>
                      <div className="metric-row">
                        <span>Average Children per Household:</span>
                        <strong>{demo.families > 0 ? (demo.total_students / demo.families).toFixed(1) : 1}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 4: AUDITING, EXCEL & PRINTABLE EXPORT CENTER             */}
            {/* ============================================================ */}
            {activeTab === 'audit-exports' && (
              <div className="tab-pane-fade">
                <div className="audit-export-grid">
                  {/* Export Card 1: Class-Wise Student Excel Dossiers */}
                  <div className="export-action-card">
                    <div className="export-icon-box green">
                      <FileSpreadsheet size={28} />
                    </div>
                    <div className="export-info">
                      <h4 className="export-title">Class-Wise Student Excel Dossiers (.zip)</h4>
                      <p className="export-desc">
                        Generates a structured ZIP archive with separate folders for every class (I, II, X...). Each student receives an individualized Excel workbook containing their profile, running-balance ledger, and official signature block for offline CA auditing.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-export-action green"
                      onClick={handleExportZip}
                      disabled={exportingZip}
                    >
                      {exportingZip ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                      <span>{exportingZip ? 'Building ZIP Archive…' : 'Download Class-Wise ZIP'}</span>
                    </button>
                  </div>

                  {/* Export Card 2: Full SQL Database Snapshot */}
                  <div className="export-action-card">
                    <div className="export-icon-box blue">
                      <ShieldCheck size={28} />
                    </div>
                    <div className="export-info">
                      <h4 className="export-title">Disaster Recovery SQL Database Snapshot</h4>
                      <p className="export-desc">
                        1-Click native database snapshot covering all 28 tables, fee structures, student archives, and payment logs for cloud safety and disaster recovery.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-export-action blue"
                      onClick={() => navigate('/settings')}
                    >
                      <ExternalLink size={16} />
                      <span>Go to Backup Vault</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}