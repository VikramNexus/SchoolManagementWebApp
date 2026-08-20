/**
 * Reports Page — School Management System (Frontend)
 *
 * Day 9: Reminders, Messages & Financial Reports.
 *
 * Three report tabs:
 * - Pending Dues List: Students with outstanding balances
 * - Demographics: Student counts by class, category
 * - Collections: Monthly collection trends
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart2,
  FileText,
  RefreshCw,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './Reports.css';

export default function Reports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending-dues');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pending Dues
  const [pendingStudents, setPendingStudents] = useState([]);
  const [pendingSummary, setPendingSummary] = useState({
    total_students_with_dues: 0,
    total_outstanding: 0,
    total_monthly_dues: 0,
    total_additional_dues: 0,
  });
  const [pendingClasses, setPendingClasses] = useState([]);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingClassFilter, setPendingClassFilter] = useState('');
  const [pendingCategoryFilter, setPendingCategoryFilter] = useState('');
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);

  // Demographics
  const [demographics, setDemographics] = useState({ by_class: [], by_category: [] });

  // Collections
  const [collections, setCollections] = useState([]);

  const TABS = [
    { id: 'pending-dues', label: 'Pending Dues List', icon: AlertTriangle },
    { id: 'demographics', label: 'Demographics', icon: Users },
    { id: 'collections', label: 'Collections', icon: BarChart2 },
  ];

  // Fetch classes for filters
  const fetchClasses = useCallback(async () => {
    try {
      const res = await api.get('/settings/classes');
      if (res.data.success) setPendingClasses(res.data.classes || []);
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // --- PENDING DUES TAB ---
  const fetchPendingDues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: pendingPage,
        limit: 50,
      });
      if (pendingSearch) params.append('search', pendingSearch);
      if (pendingClassFilter) params.append('class_id', pendingClassFilter);
      if (pendingCategoryFilter) params.append('category', pendingCategoryFilter);

      const res = await api.get(`/reports/pending-dues-list?${params.toString()}`);
      if (res.data.success) {
        setPendingStudents(res.data.students || []);
        setPendingSummary(res.data.summary || {});
        setPendingTotalPages(res.data.pagination?.total_pages || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending dues');
      toast.error(err.response?.data?.message || 'Failed to load pending dues');
    } finally {
      setLoading(false);
    }
  }, [pendingPage, pendingSearch, pendingClassFilter, pendingCategoryFilter, toast]);

  useEffect(() => {
    if (activeTab === 'pending-dues') {
      fetchPendingDues();
    }
  }, [activeTab, fetchPendingDues]);

  // --- DEMOGRAPHICS TAB ---
  const fetchDemographics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/demographics');
      if (res.data.success) {
        setDemographics(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load demographics');
      toast.error(err.response?.data?.message || 'Failed to load demographics');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'demographics') {
      fetchDemographics();
    }
  }, [activeTab, fetchDemographics]);

  // --- COLLECTIONS TAB ---
  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/collections');
      if (res.data.success) {
        setCollections(res.data.collections || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load collections');
      toast.error(err.response?.data?.message || 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'collections') {
      fetchCollections();
    }
  }, [activeTab, fetchCollections]);

  const handlePendingSearch = (e) => {
    setPendingSearch(e.target.value);
    setPendingPage(1);
  };

  const handlePendingClassFilter = (e) => {
    setPendingClassFilter(e.target.value);
    setPendingPage(1);
  };

  const handlePendingCategoryFilter = (e) => {
    setPendingCategoryFilter(e.target.value);
    setPendingPage(1);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'pending-dues':
        return (
          <div className="reports-tab">
            {/* Filters */}
            <div className="filters-bar">
              <div className="filter-group">
                <Search className="filter-icon" />
                <input
                  type="text"
                  placeholder="Search by name, admission no, phone..."
                  value={pendingSearch}
                  onChange={handlePendingSearch}
                  className="filter-input"
                />
              </div>
              <div className="filter-group">
                <Filter className="filter-icon" />
                <select value={pendingClassFilter} onChange={handlePendingClassFilter} className="filter-select">
                  <option value="">All Classes</option>
                  {pendingClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <Filter className="filter-icon" />
                <select value={pendingCategoryFilter} onChange={handlePendingCategoryFilter} className="filter-select">
                  <option value="">All Categories</option>
                  <option value="day_scholar">Day Scholar</option>
                  <option value="hosteller">Hosteller</option>
                </select>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-icon warning">
                  <AlertTriangle size={20} />
                </div>
                <div className="summary-info">
                  <span className="summary-label">Students with Dues</span>
                  <span className="summary-value">{pendingSummary.total_students_with_dues || 0}</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon danger">
                  <DollarSign size={20} />
                </div>
                <div className="summary-info">
                  <span className="summary-label">Total Outstanding</span>
                  <span className="summary-value">{formatCurrency(pendingSummary.total_outstanding)}</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon primary">
                  <FileText size={20} />
                </div>
                <div className="summary-info">
                  <span className="summary-label">Monthly Dues</span>
                  <span className="summary-value">{formatCurrency(pendingSummary.total_monthly_dues)}</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon info">
                  <BarChart2 size={20} />
                </div>
                <div className="summary-info">
                  <span className="summary-label">Additional Dues</span>
                  <span className="summary-value">{formatCurrency(pendingSummary.total_additional_dues)}</span>
                </div>
              </div>
            </div>

            {/* Pending Dues Table */}
            <div className="table-container">
              {loading ? (
                <div className="loading-state">
                  <Loader2 className="spinner" />
                  <p>Loading pending dues...</p>
                </div>
              ) : pendingStudents.length === 0 ? (
                <div className="empty-state">
                  <AlertTriangle size={48} />
                  <h3>No Pending Dues Found</h3>
                  <p>All students are up to date with their payments.</p>
                </div>
              ) : (
                <>
                  <div className="table-header">
                    <table>
                      <thead>
                        <tr>
                          <th>Admission No</th>
                          <th>Student Name</th>
                          <th>Class / Section</th>
                          <th>Category</th>
                          <th>Phone</th>
                          <th className="text-right">Monthly Dues</th>
                          <th className="text-right">Additional Dues</th>
                          <th className="text-right">Total Outstanding</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className="table-body">
                    <table>
                      <tbody>
                        {pendingStudents.map((student) => (
                          <tr key={student.id}>
                            <td>{student.admission_no}</td>
                            <td>{student.full_name}</td>
                            <td>
                              {student.class_name || '-'} / {student.section_name || '-'}
                            </td>
                            <td>
                              <span className={`category-badge ${student.category}`}>
                                {student.category === 'day_scholar' ? 'Day Scholar' : 'Hosteller'}
                              </span>
                            </td>
                            <td>{student.phone || '-'}</td>
                            <td className="text-right">{formatCurrency(student.monthly_dues)}</td>
                            <td className="text-right">{formatCurrency(student.additional_dues)}</td>
                            <td className="text-right">
                              <strong>{formatCurrency(student.total_due)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {pendingTotalPages > 1 && (
                    <div className="pagination">
                      <button
                        onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                        disabled={pendingPage === 1}
                        className="pagination-btn"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="pagination-info">
                        Page {pendingPage} of {pendingTotalPages}
                      </span>
                      <button
                        onClick={() => setPendingPage((p) => Math.min(pendingTotalPages, p + 1))}
                        disabled={pendingPage === pendingTotalPages}
                        className="pagination-btn"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );

      case 'demographics':
        return (
          <div className="reports-tab">
            <div className="demographics-grid">
              {/* By Class */}
              <div className="report-section">
                <div className="report-header">
                  <Users className="report-icon" size={24} />
                  <h3>Students by Class</h3>
                </div>
                {demographics.by_class?.length > 0 ? (
                  <div className="report-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Class</th>
                          <th className="text-right">Students</th>
                          <th>Visualization</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demographics.by_class.map((item) => (
                          <tr key={item.class_name}>
                            <td>{item.class_name}</td>
                            <td className="text-right">{item.student_count}</td>
                            <td>
                              <div className="bar-visualization">
                                <div
                                  className="bar"
                                  style={{ width: `${Math.min(100, (item.student_count / Math.max(...demographics.by_class.map(c => c.student_count), 1)) * 100)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state-small">No class data available</div>
                )}
              </div>

              {/* By Category */}
              <div className="report-section">
                <div className="report-header">
                  <BarChart2 className="report-icon" size={24} />
                  <h3>Students by Category</h3>
                </div>
                {demographics.by_category?.length > 0 ? (
                  <div className="category-stats">
                    {demographics.by_category.map((item) => (
                      <div key={item.category} className="category-stat">
                        <span className={`category-badge ${item.category}`}>
                          {item.category === 'day_scholar' ? 'Day Scholars' : 'Hostellers'}
                        </span>
                        <span className="category-count">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-small">No category data available</div>
                )}
              </div>
            </div>
          </div>
        );

      case 'collections':
        return (
          <div className="reports-tab">
            <div className="collections-header">
              <h3>Monthly Collections (Last 12 Months)</h3>
              <p className="collections-subtitle">Track fee collection trends over time</p>
            </div>
            {collections.length > 0 ? (
              <div className="collections-table">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-right">Total Collected</th>
                      <th className="text-right">Transactions</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((item, index) => {
                      const prevItem = collections[index + 1];
                      const change = prevItem
                        ? (((item.total_collected - prevItem.total_collected) / prevItem.total_collected) * 100)
                        : 0;
                      return (
                        <tr key={item.month}>
                          <td>{new Date(item.month + '-01').toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}</td>
                          <td className="text-right">{formatCurrency(item.total_collected)}</td>
                          <td className="text-right">{item.transaction_count}</td>
                          <td>
                            <span className={`trend ${change >= 0 ? 'positive' : 'negative'}`}>
                              {change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                              {Math.abs(change).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <BarChart2 size={48} />
                <h3>No Collection Data</h3>
                <p>No payments have been recorded yet.</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <p>Financial insights and student demographics</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={() => fetchPendingDues()} className="retry-btn">
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {renderTabContent()}
    </div>
  );
}