/**
 * Reports Page — School Management System (Frontend)
 * Professional Executive Intelligence Suite
 *
 * 1. Executive Command Center & Today's Day-Book
 * 2. 3-Tier Defaulter Intelligence & Aging Recovery
 * 3. Student Demographics & Capacity Matrix
 * 4. Dynamic On-Demand Excel Report Generators (Collections & Dues)
 */

import { useState, useEffect, useCallback } from 'react';
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
  Send,
  Building2,
  DollarSign,
  Layers,
  ShieldCheck,
  ChevronRight,
  Filter,
  Loader2,
  Receipt,
  GraduationCap,
  Calendar,
  X,
  CreditCard,
  Wallet
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
  const [loadingDues, setLoadingDues] = useState(false);

  // Action states
  const [sendingWaId, setSendingWaId] = useState(null);

  // Excel Modal States
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showDuesModal, setShowDuesModal] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Collection Export Form
  const [collPreset, setCollPreset] = useState('today'); // 'today' | 'this_week' | 'this_month' | 'session' | 'custom'
  const [collFromDate, setCollFromDate] = useState('');
  const [collToDate, setCollToDate] = useState('');
  const [collClassId, setCollClassId] = useState('');
  const [collMode, setCollMode] = useState('');

  // Dues Export Form
  const [duesType, setDuesType] = useState('all'); // 'all' | 'monthly' | 'admission'
  const [duesAging, setDuesAging] = useState('all'); // 'all' | 'mild' | 'moderate' | 'critical'
  const [duesClassId, setDuesClassId] = useState('');
  const [duesCategory, setDuesCategory] = useState('');

  const TABS = [
    { id: 'executive', label: 'Executive & Day-Book', icon: BarChart3, badge: 'Live Today' },
    { id: 'defaulters', label: 'Defaulters & Aging', icon: AlertTriangle, badge: 'Recovery' },
    { id: 'demographics', label: 'Student Demographics', icon: Users },
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

  // Download Collections Excel (.xlsx)
  const handleDownloadCollectionsExcel = async (e) => {
    if (e) e.preventDefault();
    try {
      setDownloadingExcel(true);
      const params = new URLSearchParams();
      params.append('preset', collPreset);
      if (collPreset === 'custom') {
        if (!collFromDate || !collToDate) {
          toast.error('Please select both From Date and To Date for custom range.');
          setDownloadingExcel(false);
          return;
        }
        params.append('from_date', collFromDate);
        params.append('to_date', collToDate);
      }
      if (collClassId) params.append('class_id', collClassId);
      if (collMode) params.append('payment_mode', collMode);

      const res = await api.get(`/reports/export-collections-excel?${params.toString()}`, {
        responseType: 'arraybuffer',
      });

      const filename = `Collections_${collPreset}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await saveFileToDeviceStorage({
        data: blob,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      toast.success(`✓ Collection Excel Report (${filename}) generated successfully!`);
      setShowCollectionModal(false);
    } catch (err) {
      console.error('[handleDownloadCollectionsExcel]', err);
      toast.error('Failed to generate collection Excel report.');
    } finally {
      setDownloadingExcel(false);
    }
  };

  // Download Dues Excel (.xlsx)
  const handleDownloadDuesExcel = async (e) => {
    if (e) e.preventDefault();
    try {
      setDownloadingExcel(true);
      const params = new URLSearchParams();
      params.append('type', duesType);
      params.append('aging', duesAging);
      if (duesClassId) params.append('class_id', duesClassId);
      if (duesCategory) params.append('category', duesCategory);

      const res = await api.get(`/reports/export-dues-excel?${params.toString()}`, {
        responseType: 'arraybuffer',
      });

      const filename = `Outstanding_Dues_${duesAging}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await saveFileToDeviceStorage({
        data: blob,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      toast.success(`✓ Outstanding Dues Excel (${filename}) generated successfully!`);
      setShowDuesModal(false);
    } catch (err) {
      console.error('[handleDownloadDuesExcel]', err);
      toast.error('Failed to generate outstanding dues Excel report.');
    } finally {
      setDownloadingExcel(false);
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
      const res = await api.post('/messages/send-single', {
        student_id: student.id,
        phone: targetPhone,
        message: msg,
      }).catch(() => null);

      if (res?.data?.success) {
        toast.success(`✓ Dues reminder sent to ${student.full_name}'s phone!`);
      } else {
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
              Aryavart (P.S.G) Shikshan Sansthan &bull; Session 2025–2026 &bull; Real-time Accounting
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
            <span>{refreshing ? 'Refreshing…' : 'Sync Live'}</span>
          </button>

          {/* Primary Excel Generator Buttons */}
          <button
            type="button"
            className="btn-header-excel green"
            onClick={() => setShowCollectionModal(true)}
          >
            <FileSpreadsheet size={16} />
            <span>📊 Collection Excel</span>
          </button>

          <button
            type="button"
            className="btn-header-excel red"
            onClick={() => setShowDuesModal(true)}
          >
            <FileSpreadsheet size={16} />
            <span>⚠️ Dues Excel</span>
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

                  {/* Right: Revenue Breakdown & Channel Split — FULLY ENHANCED UI */}
                  <div className="card-panel">
                    <div className="panel-header">
                      <div className="panel-title-wrap">
                        <Layers size={18} className="text-indigo" />
                        <div>
                          <h3 className="panel-title">Revenue Composition &amp; Channels</h3>
                          <span className="panel-sub">Payment channels and fee heads breakdown</span>
                        </div>
                      </div>
                    </div>

                    <div className="revenue-composition-container">
                      {/* Section 1: Payment Channels */}
                      <div className="composition-block">
                        <h4 className="composition-section-title">
                          <Wallet size={15} />
                          <span>Payment Method Distribution</span>
                        </h4>

                        <div className="payment-channels-tiles">
                          {/* Cash Card */}
                          <div className="channel-tile cash-tile">
                            <div className="tile-top-row">
                              <div className="tile-title-group">
                                <span className="tile-emoji">💵</span>
                                <div>
                                  <div className="tile-label">Cash Handover</div>
                                  <div className="tile-tx-count">{modesData.find(m => m.mode === 'CASH')?.count || 0} Total Transactions</div>
                                </div>
                              </div>
                              <div className="tile-amount text-amber">
                                {formatRs(modesData.find(m => m.mode === 'CASH')?.amount || 0)}
                              </div>
                            </div>
                            <div className="tile-bar-bg">
                              <div
                                className="tile-bar-fill cash"
                                style={{ width: `${fin.collected > 0 ? ((modesData.find(m => m.mode === 'CASH')?.amount || 0) / fin.collected) * 100 : 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Bank / UPI Card */}
                          <div className="channel-tile bank-tile">
                            <div className="tile-top-row">
                              <div className="tile-title-group">
                                <span className="tile-emoji">🏦</span>
                                <div>
                                  <div className="tile-label">Bank / UPI Transfer</div>
                                  <div className="tile-tx-count">{modesData.find(m => m.mode === 'IN_ACCOUNT')?.count || 0} Total Transactions</div>
                                </div>
                              </div>
                              <div className="tile-amount text-indigo">
                                {formatRs(modesData.find(m => m.mode === 'IN_ACCOUNT')?.amount || 0)}
                              </div>
                            </div>
                            <div className="tile-bar-bg">
                              <div
                                className="tile-bar-fill bank"
                                style={{ width: `${fin.collected > 0 ? ((modesData.find(m => m.mode === 'IN_ACCOUNT')?.amount || 0) / fin.collected) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Fee Head Collections */}
                      <div className="composition-block">
                        <h4 className="composition-section-title">
                          <CreditCard size={15} />
                          <span>Fee Head Collections</span>
                        </h4>

                        <div className="feehead-tiles-grid">
                          <div className="feehead-card tuition-card">
                            <div className="feehead-card-lbl">Monthly Tuition Fees</div>
                            <div className="feehead-card-val text-blue">{formatRs(feeHeads.tuition)}</div>
                            <div className="feehead-card-sub">Academic tuition collections</div>
                          </div>

                          <div className="feehead-card admission-card">
                            <div className="feehead-card-lbl">Admission &amp; Term Fees</div>
                            <div className="feehead-card-val text-green">{formatRs(feeHeads.admission)}</div>
                            <div className="feehead-card-sub">Enrollment &amp; charges</div>
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

                    {/* Quick Excel Export button inside Defaulters tab */}
                    <button
                      type="button"
                      className="btn-quick-export-excel red"
                      onClick={() => {
                        setDuesAging(selectedAging);
                        setDuesClassId(selectedClass);
                        setDuesCategory(selectedCategory);
                        setShowDuesModal(true);
                      }}
                      title="Export Dues as Excel"
                    >
                      <FileSpreadsheet size={15} />
                      <span>Export Dues Excel</span>
                    </button>
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
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: DYNAMIC COLLECTIONS EXCEL GENERATOR                 */}
      {/* ============================================================ */}
      {showCollectionModal && (
        <div className="report-modal-overlay" onClick={() => setShowCollectionModal(false)}>
          <div className="report-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <div className="modal-title-wrap">
                <div className="modal-badge-icon green">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Export Fee Collections Excel</h3>
                  <p className="modal-sub">Generate formatted collection ledger spreadsheet (.xlsx)</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-btn-close"
                onClick={() => setShowCollectionModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDownloadCollectionsExcel} className="report-modal-body">
              {/* Preset Selector */}
              <div className="form-field-group">
                <label className="form-field-lbl">Collection Time Period:</label>
                <div className="preset-radio-grid">
                  <label className={`preset-pill ${collPreset === 'today' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="collPreset"
                      value="today"
                      checked={collPreset === 'today'}
                      onChange={() => setCollPreset('today')}
                    />
                    <span>⚡ Today's Day-Book</span>
                  </label>

                  <label className={`preset-pill ${collPreset === 'this_week' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="collPreset"
                      value="this_week"
                      checked={collPreset === 'this_week'}
                      onChange={() => setCollPreset('this_week')}
                    />
                    <span>📅 This Week</span>
                  </label>

                  <label className={`preset-pill ${collPreset === 'this_month' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="collPreset"
                      value="this_month"
                      checked={collPreset === 'this_month'}
                      onChange={() => setCollPreset('this_month')}
                    />
                    <span>🗓️ Current Month</span>
                  </label>

                  <label className={`preset-pill ${collPreset === 'session' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="collPreset"
                      value="session"
                      checked={collPreset === 'session'}
                      onChange={() => setCollPreset('session')}
                    />
                    <span>🏫 Full Session (2025–26)</span>
                  </label>

                  <label className={`preset-pill ${collPreset === 'custom' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="collPreset"
                      value="custom"
                      checked={collPreset === 'custom'}
                      onChange={() => setCollPreset('custom')}
                    />
                    <span>🔍 Custom Date Range</span>
                  </label>
                </div>
              </div>

              {/* Custom Date Inputs if Custom Selected */}
              {collPreset === 'custom' && (
                <div className="custom-date-row">
                  <div className="form-field-group">
                    <label className="form-field-lbl">From Date:</label>
                    <input
                      type="date"
                      className="modal-input-field"
                      value={collFromDate}
                      onChange={(e) => setCollFromDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="form-field-lbl">To Date:</label>
                    <input
                      type="date"
                      className="modal-input-field"
                      value={collToDate}
                      onChange={(e) => setCollToDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Filter Options */}
              <div className="modal-filters-2col">
                <div className="form-field-group">
                  <label className="form-field-lbl">Class Filter (Optional):</label>
                  <select
                    className="modal-select-field"
                    value={collClassId}
                    onChange={(e) => setCollClassId(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="form-field-lbl">Payment Mode (Optional):</label>
                  <select
                    className="modal-select-field"
                    value={collMode}
                    onChange={(e) => setCollMode(e.target.value)}
                  >
                    <option value="">All Payment Modes</option>
                    <option value="CASH">💵 Cash Only</option>
                    <option value="IN_ACCOUNT">🏦 Bank / UPI Transfer Only</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="report-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowCollectionModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit green"
                  disabled={downloadingExcel}
                >
                  {downloadingExcel ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                  <span>{downloadingExcel ? 'Building Excel…' : '📥 Download Collection Excel (.xlsx)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: DYNAMIC OUTSTANDING DUES EXCEL GENERATOR            */}
      {/* ============================================================ */}
      {showDuesModal && (
        <div className="report-modal-overlay" onClick={() => setShowDuesModal(false)}>
          <div className="report-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <div className="modal-title-wrap">
                <div className="modal-badge-icon red">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Export Outstanding Dues Excel</h3>
                  <p className="modal-sub">Generate customized defaulters workbook (.xlsx)</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-btn-close"
                onClick={() => setShowDuesModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDownloadDuesExcel} className="report-modal-body">
              {/* Dues Type Scope */}
              <div className="form-field-group">
                <label className="form-field-lbl">Dues Scope / Type:</label>
                <div className="preset-radio-grid">
                  <label className={`preset-pill ${duesType === 'all' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="duesType"
                      value="all"
                      checked={duesType === 'all'}
                      onChange={() => setDuesType('all')}
                    />
                    <span>All Dues (Monthly + Admission)</span>
                  </label>

                  <label className={`preset-pill ${duesType === 'monthly' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="duesType"
                      value="monthly"
                      checked={duesType === 'monthly'}
                      onChange={() => setDuesType('monthly')}
                    />
                    <span>Monthly Tuition Fees Only</span>
                  </label>

                  <label className={`preset-pill ${duesType === 'admission' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="duesType"
                      value="admission"
                      checked={duesType === 'admission'}
                      onChange={() => setDuesType('admission')}
                    />
                    <span>Admission Charges Only</span>
                  </label>
                </div>
              </div>

              {/* Aging Urgency Filter */}
              <div className="form-field-group">
                <label className="form-field-lbl">Aging Defaulter Urgency:</label>
                <div className="preset-radio-grid">
                  <label className={`preset-pill ${duesAging === 'all' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="duesAging"
                      value="all"
                      checked={duesAging === 'all'}
                      onChange={() => setDuesAging('all')}
                    />
                    <span>All Defaulters</span>
                  </label>

                  <label className={`preset-pill mild ${duesAging === 'mild' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="duesAging"
                      value="mild"
                      checked={duesAging === 'mild'}
                      onChange={() => setDuesAging('mild')}
                    />
                    <span>🟢 1 Month Due (Mild)</span>
                  </label>

                  <label className={`preset-pill moderate ${duesAging === 'moderate' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="duesAging"
                      value="moderate"
                      checked={duesAging === 'moderate'}
                      onChange={() => setDuesAging('moderate')}
                    />
                    <span>🟡 2 Months Due (Moderate)</span>
                  </label>

                  <label className={`preset-pill critical ${duesAging === 'critical' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="duesAging"
                      value="critical"
                      checked={duesAging === 'critical'}
                      onChange={() => setDuesAging('critical')}
                    />
                    <span>🔴 3+ Months Due (Critical)</span>
                  </label>
                </div>
              </div>

              {/* Filter Options */}
              <div className="modal-filters-2col">
                <div className="form-field-group">
                  <label className="form-field-lbl">Class Filter (Optional):</label>
                  <select
                    className="modal-select-field"
                    value={duesClassId}
                    onChange={(e) => setDuesClassId(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="form-field-lbl">Student Category (Optional):</label>
                  <select
                    className="modal-select-field"
                    value={duesCategory}
                    onChange={(e) => setDuesCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    <option value="day_scholar">Day Scholar Only</option>
                    <option value="hosteller">Hosteller Only</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="report-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowDuesModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit red"
                  disabled={downloadingExcel}
                >
                  {downloadingExcel ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                  <span>{downloadingExcel ? 'Building Excel…' : '📥 Download Dues Excel (.xlsx)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}