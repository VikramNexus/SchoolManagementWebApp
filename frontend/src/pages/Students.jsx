/**
 * Students Page — School Management System (Frontend)
 * Eye-Comfort, Receipt-Themed Student Directory & Management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Users,
  Building2,
  User,
  Search,
  Filter,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Edit2,
  Trash2,
  IndianRupee,
  RotateCcw,
  CheckCircle2,
  Phone,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import StudentModal from '../components/StudentModal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import DeleteStudentModal from '../components/DeleteStudentModal';
import './Students.css';

export default function Students() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters initialized from URL query params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [classFilter, setClassFilter] = useState(searchParams.get('class_id') || '');
  const [sectionFilter, setSectionFilter] = useState(searchParams.get('section_id') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Stats Summary
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    hostellers: 0,
    dayScholars: 0,
    active: 0,
  });

  // Dropdown data
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const navigate = useNavigate();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedStudentForDelete, setSelectedStudentForDelete] = useState(null);

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/kpis');
      if (res.data.success && res.data.kpis) {
        setSummaryStats({
          total: res.data.kpis.total_students || 0,
          hostellers: res.data.kpis.hostellers || 0,
          dayScholars: res.data.kpis.day_scholars || 0,
          active: res.data.kpis.total_students || 0,
        });
      }
    } catch (err) {
      console.error('[Students.fetchStats]', err);
    }
  }, []);

  // Fetch students
  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });
      if (search) params.append('search', search);
      if (classFilter) params.append('class_id', classFilter);
      if (sectionFilter) params.append('section_id', sectionFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/students?${params.toString()}`);
      if (res.data.success) {
        setStudents(res.data.students || []);
        setTotal(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load students';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, search, classFilter, sectionFilter, categoryFilter, statusFilter, toast]);

  // Sync state if URL searchParams change dynamically
  useEffect(() => {
    setCategoryFilter(searchParams.get('category') || '');
    setStatusFilter(searchParams.get('status') || '');
    setClassFilter(searchParams.get('class_id') || '');
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  // Fetch filter options
  const fetchFilters = async () => {
    try {
      const [classesRes, sectionsRes] = await Promise.all([
        api.get('/settings/classes'),
        api.get('/settings/sections'),
      ]);
      if (classesRes.data.success) setClasses(classesRes.data.classes || []);
      if (sectionsRes.data.success) setSections(sectionsRes.data.sections || []);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchFilters();
    fetchStats();
  }, [fetchStudents, fetchStats]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, classFilter, sectionFilter, categoryFilter, statusFilter]);

  const handleResetFilters = () => {
    setSearch('');
    setClassFilter('');
    setSectionFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setSearchParams({});
  };

  const handleCreate = () => {
    setEditingStudent(null);
    setModalOpen(true);
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingStudent(null);
  };

  const handleStudentSaved = () => {
    handleCloseModal();
    fetchStudents();
    fetchStats();
  };

  const formatCategory = (cat) => (cat === 'day_scholar' ? 'Day Scholar' : 'Hosteller');

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(val || 0);
  };

  const hasActiveFilters = Boolean(search || classFilter || sectionFilter || categoryFilter || statusFilter);

  return (
    <div className="students-container">
      {/* Receipt-Themed Header Card */}
      <div className="students-header-card">
        <div className="header-left-wrap">
          <div className="students-icon-badge">
            <GraduationCap size={26} />
          </div>
          <div>
            <h1 className="students-heading">Student Directory &amp; Records</h1>
            <p className="students-subheading">
              Manage student admissions, monthly fee rates, class assignments, and ledger profiles.
            </p>
          </div>
        </div>

        <div className="students-header-actions">
          <button
            type="button"
            className="btn-students-secondary"
            onClick={() => {
              setSelectedStudentForPayment(null);
              setPaymentModalOpen(true);
            }}
          >
            <CreditCard size={17} />
            <span>Record Payment</span>
          </button>
          <button
            type="button"
            className="btn-students-primary"
            onClick={handleCreate}
          >
            <Plus size={18} />
            <span>+ Add Student</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="students-alert-banner" role="alert">
          <span>{error}</span>
          <button onClick={fetchStudents} className="alert-retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards (Receipt Themed) */}
      <div className="students-summary-grid">
        <div
          className={`student-stat-card primary ${!categoryFilter ? 'active-filter' : ''}`}
          onClick={() => {
            setCategoryFilter('');
            setSearchParams({});
          }}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-icon primary">
            <Users size={22} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Total Enrollment</span>
            <span className="stat-card-value">{summaryStats.total}</span>
            <span className="stat-card-subtext">Active student records</span>
          </div>
        </div>

        <div
          className={`student-stat-card blue ${categoryFilter === 'hosteller' ? 'active-filter' : ''}`}
          onClick={() => {
            setCategoryFilter('hosteller');
            setSearchParams({ category: 'hosteller' });
          }}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-icon blue">
            <Building2 size={22} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Hosteller Wing</span>
            <span className="stat-card-value">{summaryStats.hostellers}</span>
            <span className="stat-card-subtext">Hostel accommodation</span>
          </div>
        </div>

        <div
          className={`student-stat-card green ${categoryFilter === 'day_scholar' ? 'active-filter' : ''}`}
          onClick={() => {
            setCategoryFilter('day_scholar');
            setSearchParams({ category: 'day_scholar' });
          }}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-icon green">
            <User size={22} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Day Scholars</span>
            <span className="stat-card-value">{summaryStats.dayScholars}</span>
            <span className="stat-card-subtext">Day boarding students</span>
          </div>
        </div>

        <div className="student-stat-card emerald">
          <div className="stat-card-icon emerald">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Active Status</span>
            <span className="stat-card-value">{summaryStats.active}</span>
            <span className="stat-card-subtext">In-session records</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="students-filter-card">
        <div className="student-search-wrap">
          <div className="student-search-icon">
            <Search size={18} />
          </div>
          <input
            type="search"
            className="student-search-input"
            placeholder="Search by Name, Admission No., Phone, Parent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search students"
          />
        </div>

        <div className="student-filter-controls">
          <div className="filter-select-wrap">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="student-select"
              aria-label="Filter by Class"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrap">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="student-select"
              aria-label="Filter by Section"
            >
              <option value="">All Sections</option>
              {sections
                .filter((s) => !classFilter || s.class_id === Number(classFilter))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.class_name ? `${s.class_name}-${s.name}` : s.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="filter-select-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="student-select"
              aria-label="Filter by Category"
            >
              <option value="">All Categories</option>
              <option value="day_scholar">Day Scholar</option>
              <option value="hosteller">Hosteller</option>
            </select>
          </div>

          <div className="filter-select-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="student-select"
              aria-label="Filter by Status"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn-filter-reset"
              onClick={handleResetFilters}
              title="Reset all filters"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Students Master Table Card */}
      <div className="students-table-card">
        <div className="table-header-bar">
          <div className="table-header-left">
            <span className="table-header-title">Student Records Ledger</span>
            <span className="table-count-pill">{total} Students Listed</span>
          </div>
        </div>

        <div className="table-responsive-wrapper">
          <table className="students-ledger-table" role="table">
            <thead>
              <tr>
                <th>Adm No.</th>
                <th>Student Details</th>
                <th>Class / Sec</th>
                <th>Category</th>
                <th>Monthly Rate</th>
                <th>Contact</th>
                <th>Status</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="table-loading-cell">
                    <div className="cell-loader-wrap">
                      <Loader2 size={24} className="spin text-primary" />
                      <span>Loading student ledger records...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty-cell">
                    <div className="empty-state-box">
                      <Users size={36} className="text-muted" />
                      <p className="empty-title">No student records found</p>
                      <p className="empty-desc">
                        {hasActiveFilters
                          ? 'No students match your filter criteria. Try resetting filters.'
                          : 'No students enrolled yet. Click "+ Add Student" to create your first admission.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-reset-empty"
                          onClick={handleResetFilters}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="student-data-row">
                    <td>
                      <span className="admission-code-pill">{student.admission_no}</span>
                    </td>
                    <td>
                      <div className="student-profile-cell">
                        <strong className="student-fullname">{student.full_name}</strong>
                        {(student.father_name || student.parent_name) && (
                          <small className="student-parent-text">
                            Father: {student.father_name || student.parent_name}
                            {student.mother_name ? ` | Mother: ${student.mother_name}` : ''}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="class-section-pill">
                        <span className="class-name-txt">{student.class_name || 'Class —'}</span>
                        {student.section_name && (
                          <span className="sec-tag">{student.section_name}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`student-cat-pill ${student.category}`}>
                        {formatCategory(student.category)}
                      </span>
                    </td>
                    <td>
                      <strong className="monthly-fee-txt">
                        {formatCurrency(
                          Number(student.monthly_fee_rate) > 0
                            ? Number(student.monthly_fee_rate)
                            : student.category === 'hosteller'
                            ? 5000
                            : 3000
                        )}
                      </strong>
                    </td>
                    <td>
                      <span className="student-phone-txt">
                        {student.phone ? (
                          <>
                            <Phone size={12} className="text-muted" />
                            {student.phone}
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                    <td>
                      <span className={`student-status-badge ${student.status || 'active'}`}>
                        {student.status || 'active'}
                      </span>
                    </td>
                    <td className="td-actions">
                      <div className="student-actions-cluster">
                        <button
                          type="button"
                          className="action-icon-btn view"
                          onClick={() => navigate(`/students/${student.id}`)}
                          title="View Full Ledger Profile"
                          aria-label="View Profile"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn edit"
                          onClick={() => handleEdit(student)}
                          title="Edit Student Info"
                          aria-label="Edit Student"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn pay"
                          onClick={() => {
                            setSelectedStudentForPayment(student);
                            setPaymentModalOpen(true);
                          }}
                          title="Record Fee Payment"
                          aria-label="Record Payment"
                        >
                          <CreditCard size={15} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn delete"
                          onClick={() => {
                            setSelectedStudentForDelete(student);
                            setDeleteModalOpen(true);
                          }}
                          title="Delete Student"
                          aria-label="Delete Student"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="table-pagination-footer">
            <span className="pagination-info-text">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} students)
            </span>
            <div className="pagination-buttons">
              <button
                type="button"
                className="btn-page-nav"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>
              <button
                type="button"
                className="btn-page-nav"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Student Modal */}
      {modalOpen && (
        <StudentModal
          student={editingStudent}
          classes={classes}
          sections={sections}
          onClose={handleCloseModal}
          onSaved={handleStudentSaved}
        />
      )}

      {/* Record Payment Modal */}
      {paymentModalOpen && (
        <RecordPaymentModal
          initialStudent={selectedStudentForPayment}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedStudentForPayment(null);
          }}
          onSaved={() => {
            setPaymentModalOpen(false);
            setSelectedStudentForPayment(null);
            fetchStudents();
            fetchStats();
          }}
        />
      )}

      {/* Delete Student Modal */}
      {deleteModalOpen && selectedStudentForDelete && (
        <DeleteStudentModal
          student={selectedStudentForDelete}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedStudentForDelete(null);
          }}
          onDeleted={() => {
            setDeleteModalOpen(false);
            setSelectedStudentForDelete(null);
            fetchStudents();
            fetchStats();
          }}
        />
      )}
    </div>
  );
}