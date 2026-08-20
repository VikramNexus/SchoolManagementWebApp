/**
 * Messages Page — School Management System (Frontend)
 * Eye-Comfort, Receipt-Themed Parent Communications & Due Reminders
 */

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  Save,
  Trash2,
  Edit2,
  X,
  Loader2,
  Send,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Smartphone,
  MessageCircle,
  Sparkles,
  SendHorizontal,
  FileCode,
  Calendar,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './Messages.css';

const PLACEHOLDERS = [
  '{student_name}',
  '{admission_no}',
  '{due_amount}',
  '{school_name}',
  '{payment_date}',
  '{receipt_number}',
  '{class_name}',
  '{section_name}',
  '{category}',
];

const TABS = [
  { id: 'templates', label: 'Message Templates', icon: MessageSquare },
  { id: 'send', label: 'Send Due Reminders', icon: SendHorizontal },
  { id: 'logs', label: 'Delivery Dispatch Logs', icon: Eye },
];

export default function Messages() {
  const [activeTab, setActiveTab] = useState('templates');
  const [loading, setLoading] = useState(false);

  return (
    <div className="messages-container">
      {/* Header Card (Eye-Comfort Theme) */}
      <div className="messages-header-card">
        <div className="header-left-wrap">
          <div className="messages-icon-badge">
            <MessageSquare size={26} />
          </div>
          <div>
            <h1 className="messages-heading">Parent Communication &amp; Fee Reminders</h1>
            <p className="messages-subheading">
              Manage dynamic WhatsApp &amp; SMS message templates, broadcast fee reminder notices to parents, and inspect delivery logs.
            </p>
          </div>
        </div>
      </div>

      {/* Modern Segmented Tab Bar */}
      <div className="messages-tab-bar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`msg-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'templates' && <TemplatesTab loading={loading} setLoading={setLoading} />}
      {activeTab === 'send' && <SendTab loading={loading} setLoading={setLoading} />}
      {activeTab === 'logs' && <LogsTab loading={loading} setLoading={setLoading} />}
    </div>
  );
}

/**
 * Templates Tab
 */
function TemplatesTab({ loading, setLoading }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    channel: 'sms',
    body: '',
    is_active: true,
  });
  const [previewText, setPreviewText] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/messages/templates');
      if (res.data.success) setTemplates(res.data.templates || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [toast, setLoading]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setFormData({ name: '', channel: 'sms', body: '', is_active: true });
    setEditingId(null);
    setPreviewText('');
    setShowForm(false);
  };

  const handleEdit = (template) => {
    setFormData({
      name: template.name,
      channel: template.channel,
      body: template.body,
      is_active: template.is_active === 1,
    });
    setEditingId(template.id);
    setPreviewText(template.body);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.body.trim()) {
      toast.error('Name and message body are required');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/messages/templates/${editingId}`, formData);
        toast.success('Template updated successfully');
      } else {
        await api.post('/messages/templates', formData);
        toast.success('Template created successfully');
      }
      resetForm();
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/messages/templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete template');
    }
  };

  const insertPlaceholder = (placeholder) => {
    setFormData((prev) => ({ ...prev, body: prev.body + ' ' + placeholder }));
    setPreviewText((prev) => (prev ? prev + ' ' + placeholder : placeholder));
  };

  const renderPreview = (body) => {
    return body
      .replace(/\{student_name\}/g, 'Vikram Kumar')
      .replace(/\{admission_no\}/g, '01')
      .replace(/\{due_amount\}/g, '₹13,000')
      .replace(/\{school_name\}/g, 'Aryavart Shikshan Sansthan')
      .replace(/\{payment_date\}/g, '20 Aug 2026')
      .replace(/\{receipt_number\}/g, 'REC-2026-0001')
      .replace(/\{class_name\}/g, 'Class 10')
      .replace(/\{section_name\}/g, 'A')
      .replace(/\{category\}/g, 'Hosteller');
  };

  return (
    <div className="templates-tab-container">
      <div className="tab-action-bar">
        <div>
          <h2 className="tab-section-title">Message Templates Directory</h2>
          <p className="tab-section-subtitle">
            Create reusable notification templates with dynamic parameters for WhatsApp and SMS.
          </p>
        </div>
        <button
          type="button"
          className="btn-add-template"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus size={17} />
          <span>+ New Template</span>
        </button>
      </div>

      {showForm && (
        <form className="template-editor-card" onSubmit={handleSubmit}>
          <div className="card-header-bar">
            <span className="card-header-title">
              {editingId ? 'Edit Message Template' : 'Create New Message Template'}
            </span>
            <button type="button" className="btn-close-form" onClick={resetForm}>
              <X size={18} />
            </button>
          </div>

          <div className="form-grid-row">
            <div className="form-field-group">
              <label>Template Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Monthly Fee Overdue Reminder - Hindi"
                required
              />
            </div>
            <div className="form-field-group">
              <label>Communication Channel *</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData((prev) => ({ ...prev, channel: e.target.value }))}
              >
                <option value="sms">SMS Text Message</option>
                <option value="whatsapp">WhatsApp Message</option>
                <option value="both">Both (SMS + WhatsApp)</option>
              </select>
            </div>
          </div>

          <div className="form-field-group">
            <label>Template Body (Supports dynamic tags) *</label>
            <textarea
              value={formData.body}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, body: e.target.value }));
                setPreviewText(e.target.value);
              }}
              placeholder="Dear Parent, this is a reminder from {school_name}. {student_name}'s pending fee balance is {due_amount}..."
              rows={4}
              required
            />
          </div>

          <div className="placeholder-helper-box">
            <span className="placeholder-tag-label">Click tag to insert:</span>
            <div className="placeholder-tag-cluster">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="placeholder-chip"
                  onClick={() => insertPlaceholder(p)}
                >
                  <FileCode size={12} />
                  <span>{p}</span>
                </button>
              ))}
            </div>
          </div>

          {previewText && (
            <div className="live-preview-box">
              <span className="preview-heading">Live Dynamic Preview:</span>
              <p className="preview-text-content">{renderPreview(previewText)}</p>
            </div>
          )}

          <div className="form-submit-row">
            <button type="button" className="btn-cancel-action" onClick={resetForm}>
              Cancel
            </button>
            <button type="submit" className="btn-save-action" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              <span>{editingId ? 'Update Template' : 'Save Template'}</span>
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="tab-loading-box">
          <Loader2 size={32} className="spin text-primary" />
          <span>Loading message templates...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="tab-empty-box">
          <MessageSquare size={44} className="text-muted" />
          <h3>No Templates Created Yet</h3>
          <p>Click "+ New Template" above to configure your first WhatsApp or SMS reminder message.</p>
        </div>
      ) : (
        <div className="templates-cards-grid">
          {templates.map((template) => (
            <div key={template.id} className="template-receipt-card">
              <div className="tpl-card-top">
                <span className={`tpl-channel-badge ${template.channel}`}>
                  {template.channel === 'sms' && <Smartphone size={14} />}
                  {template.channel === 'whatsapp' && <MessageCircle size={14} />}
                  {template.channel === 'both' && <MessageSquare size={14} />}
                  <span>{template.channel.toUpperCase()}</span>
                </span>
                <div className="tpl-action-btns">
                  <button
                    type="button"
                    className="tpl-btn edit"
                    onClick={() => handleEdit(template)}
                    title="Edit Template"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="tpl-btn delete"
                    onClick={() => handleDelete(template.id)}
                    title="Delete Template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <h3 className="tpl-title">{template.name}</h3>
              <p className="tpl-body">{template.body}</p>

              <div className="tpl-card-footer">
                <span className="tpl-status-tag active">
                  <CheckCircle2 size={13} /> Active
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Send Reminders Tab
 */
function SendTab({ loading: _loading, setLoading: _setLoading }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [channel, setChannel] = useState('both');
  const [customMessage, setCustomMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/messages/templates');
      if (res.data.success) setTemplates(res.data.templates || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load templates');
    }
  }, [toast]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await api.get('/settings/classes');
      if (res.data.success) setClasses(res.data.classes || []);
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setLoadingStudents(true);
      const params = new URLSearchParams({ page: 1, limit: 100 });
      if (classFilter) params.append('class_id', classFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await api.get(`/reports/pending-dues-list?${params.toString()}`);
      if (res.data.success) {
        setStudents(res.data.students || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }, [classFilter, categoryFilter, searchQuery, toast]);

  useEffect(() => {
    fetchTemplates();
    fetchClasses();
  }, [fetchTemplates, fetchClasses]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const toggleStudent = (studentId) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map((s) => s.id));
    }
  };

  const handleSendReminders = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }
    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    try {
      setSending(true);
      const res = await api.post('/messages/send-reminders', {
        template_id: selectedTemplate,
        channel,
        student_ids: selectedStudents,
        custom_message: customMessage.trim() || null,
      });

      if (res.data.success) {
        toast.success(`Reminders sent successfully: ${res.data.sent} sent, ${res.data.failed} failed`);
        setSelectedStudents([]);
        setCustomMessage('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reminders');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="send-tab-split-layout">
      {/* Left: Configuration Card */}
      <div className="send-config-card">
        <div className="card-header-bar">
          <span className="card-header-title">Reminder Dispatch Settings</span>
        </div>

        <div className="form-field-group">
          <label>Select Message Template *</label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="send-config-select"
          >
            <option value="">Choose a reminder template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.channel.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <div className="form-field-group">
          <label>Delivery Channel</label>
          <div className="channel-pill-selector">
            {['sms', 'whatsapp', 'both'].map((c) => (
              <button
                key={c}
                type="button"
                className={`channel-pill-btn ${channel === c ? 'active' : ''}`}
                onClick={() => setChannel(c)}
              >
                {c === 'sms' && <Smartphone size={14} />}
                {c === 'whatsapp' && <MessageCircle size={14} />}
                {c === 'both' && <MessageSquare size={14} />}
                <span>{c === 'both' ? 'Both (SMS+WA)' : c.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-field-group">
          <label>Custom Note / Override (Optional)</label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Leave empty to use standard template text..."
            rows={3}
          />
        </div>

        <div className="dispatch-summary-box">
          <div className="dispatch-summary-row">
            <span>Recipients Selected:</span>
            <strong>{selectedStudents.length} Students</strong>
          </div>
          <div className="dispatch-summary-row">
            <span>Channel:</span>
            <strong className="text-primary">{channel.toUpperCase()}</strong>
          </div>
        </div>

        <button
          type="button"
          className="btn-dispatch-reminders"
          onClick={handleSendReminders}
          disabled={sending || selectedStudents.length === 0 || !selectedTemplate}
        >
          {sending ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
          <span>
            Broadcast Reminder{selectedStudents.length > 0 ? ` (${selectedStudents.length})` : ''}
          </span>
        </button>
      </div>

      {/* Right: Student Overdue Selection Ledger */}
      <div className="send-students-card">
        <div className="card-header-bar">
          <div className="students-header-left">
            <span className="card-header-title">Select Students with Pending Dues</span>
            <span className="selection-count-pill">{selectedStudents.length} Selected</span>
          </div>
          {students.length > 0 && (
            <button
              type="button"
              className="btn-select-all"
              onClick={handleSelectAll}
            >
              {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="send-filters-row">
          <div className="send-search-wrap">
            <Search size={16} className="send-search-icon" />
            <input
              type="search"
              placeholder="Search student by name, adm no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="send-filter-select"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="send-filter-select"
          >
            <option value="">All Categories</option>
            <option value="day_scholar">Day Scholar</option>
            <option value="hosteller">Hosteller</option>
          </select>
        </div>

        {loadingStudents ? (
          <div className="tab-loading-box">
            <Loader2 size={28} className="spin text-primary" />
            <span>Loading students with pending dues...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="tab-empty-box small">
            <CheckCircle2 size={36} className="text-success" />
            <p>No students with pending dues found.</p>
          </div>
        ) : (
          <div className="students-select-ledger">
            {students.map((student) => {
              const isSelected = selectedStudents.includes(student.id);
              const due = Number(student.total_dues || student.total_due || 0);
              return (
                <div
                  key={student.id}
                  className={`student-select-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleStudent(student.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="student-info-meta">
                    <strong className="std-name">{student.full_name}</strong>
                    <span className="std-sub">
                      {student.admission_no} • {student.class_name || 'Class'} {student.section_name && `(${student.section_name})`}
                    </span>
                  </div>
                  <strong className="std-due-amount">
                    ₹{due.toLocaleString('en-IN')}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Message Logs Tab
 */
function LogsTab() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLocalLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    channel: '',
    status: '',
    start_date: '',
    end_date: '',
  });

  const fetchLogs = useCallback(async () => {
    try {
      setLocalLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 50,
      });
      if (filters.channel) params.append('channel', filters.channel);
      if (filters.status) params.append('status', filters.status);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const res = await api.get(`/messages/logs?${params.toString()}`);
      if (res.data.success) {
        setLogs(res.data.logs || []);
        setTotalPages(res.data.pagination?.total_pages || 1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load logs');
    } finally {
      setLocalLoading(false);
    }
  }, [page, filters, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="logs-tab-container">
      <div className="tab-action-bar">
        <div>
          <h2 className="tab-section-title">Message Dispatch &amp; Delivery Logs</h2>
          <p className="tab-section-subtitle">
            Audit trail of all WhatsApp and SMS fee reminder notifications sent to parents.
          </p>
        </div>
        <button type="button" className="btn-refresh-logs" onClick={fetchLogs}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="logs-filters-card">
        <div className="filter-field-wrap">
          <select
            value={filters.channel}
            onChange={(e) => setFilters((prev) => ({ ...prev, channel: e.target.value }))}
            className="log-select"
          >
            <option value="">All Channels</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>

        <div className="filter-field-wrap">
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="log-select"
          >
            <option value="">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="mock">Mock</option>
          </select>
        </div>

        <div className="filter-field-wrap date-wrap">
          <span className="date-label">From:</span>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
            className="log-date-input"
          />
        </div>

        <div className="filter-field-wrap date-wrap">
          <span className="date-label">To:</span>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
            className="log-date-input"
          />
        </div>
      </div>

      {loading ? (
        <div className="tab-loading-box">
          <Loader2 size={32} className="spin text-primary" />
          <span>Loading dispatch audit logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="tab-empty-box">
          <Eye size={44} className="text-muted" />
          <h3>No Delivery Logs Found</h3>
          <p>Message delivery logs will appear here once fee reminders are broadcasted.</p>
        </div>
      ) : (
        <div className="logs-table-card">
          <div className="table-responsive-wrapper">
            <table className="logs-ledger-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Student &amp; Parent</th>
                  <th>Channel</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Message Snippet</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="log-time-cell">
                      {new Date(log.sent_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <div className="std-log-meta">
                        <strong>{log.student_name || '—'}</strong>
                        {log.admission_no && <small>Adm: {log.admission_no}</small>}
                      </div>
                    </td>
                    <td>
                      <span className={`channel-pill-badge ${log.channel}`}>
                        {log.channel === 'sms' ? <Smartphone size={13} /> : <MessageCircle size={13} />}
                        <span>{log.channel?.toUpperCase()}</span>
                      </span>
                    </td>
                    <td>{log.template_name || '—'}</td>
                    <td>
                      <span className={`status-pill-badge ${log.status}`}>
                        {log.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="log-body-snippet" title={log.message}>
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination-footer">
              <span className="pagination-info-text">
                Page {page} of {totalPages}
              </span>
              <div className="pagination-buttons">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-page-nav"
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-page-nav"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
