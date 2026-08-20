/**
 * Topbar — School Management System (Frontend)
 *
 * Day 4: Settings, Fees & Application Shell.
 *
 * Top navigation bar with page title, breadcrumb, user menu, and notifications.
 */

import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Search,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  CreditCard,
  Database,
  Users,
  ShieldCheck,
  Key,
  CheckCircle2,
} from 'lucide-react';
import { useAuth, api } from '../context/AuthContext';
import './Topbar.css';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/admissions': 'New Admission Desk',
  '/students': 'Students',
  '/pending-fees': 'Pending Dues',
  '/payments': 'Payments',
  '/receipts': 'Receipts',
  '/messages': 'Messages',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/backup': 'Backup & Restore',
};

export default function Topbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fetchingNotifs, setFetchingNotifs] = useState(false);
  const userMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  // Fetch real-time notifications
  const fetchNotifications = async () => {
    try {
      setFetchingNotifs(true);
      const res = await api.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch (err) {
      console.warn('[Topbar.fetchNotifications] Could not fetch notifications:', err.message);
    } finally {
      setFetchingNotifs(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000); // 45s refresh
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setUserMenuOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/students?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoForward = () => {
    navigate(1);
  };

  const handleReloadPage = () => {
    window.location.reload();
  };

  const handleNotificationClick = (link) => {
    setNotificationsOpen(false);
    if (link) {
      navigate(link);
    }
  };

  const handleMarkAllRead = () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleClearAll = () => {
    setUnreadCount(0);
    setNotifications([]);
  };

  const pageTitle = PAGE_TITLES[location.pathname] || 'School Management';

  return (
    <header className="topbar" role="banner">
      {/* Left: Brand / Current Section title */}
      <div className="topbar-left">
        <h1 className="page-title">{pageTitle}</h1>
      </div>

      {/* Center: Search */}
      <div className="topbar-center">
        <form className="search-wrapper" onSubmit={handleSearchSubmit}>
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search students, fees, payments…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            aria-label="Global search"
          />
        </form>
      </div>

      {/* Right: Notifications, User menu */}
      <div className="topbar-right">
        {/* Notifications */}
        <div className="dropdown" ref={notificationsRef}>
          <button
            className="icon-btn notification-btn"
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              if (!notificationsOpen) fetchNotifications();
            }}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="true"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="notification-badge" aria-label={`${unreadCount} unread`}>
                {unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="dropdown-menu dropdown-menu-right notification-dropdown" role="menu">
              <div className="dropdown-header">
                <div className="notif-header-title">
                  <span>Live System Alerts</span>
                  {unreadCount > 0 && <span className="notif-unread-pill">{unreadCount} New</span>}
                </div>
                <div className="notif-header-actions">
                  <button
                    className="icon-btn sm notif-action-btn"
                    onClick={fetchNotifications}
                    title="Refresh Alerts"
                    aria-label="Refresh alerts"
                  >
                    <RefreshCw size={14} className={fetchingNotifs ? 'spin' : ''} />
                  </button>
                  {unreadCount > 0 && (
                    <button
                      className="notif-mark-btn"
                      onClick={handleMarkAllRead}
                      title="Mark all as read"
                    >
                      Mark Read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      className="notif-clear-btn"
                      onClick={handleClearAll}
                      title="Clear all notifications"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="dropdown-divider" />
              <div className="notification-list custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="notif-empty-state">
                    <CheckCircle2 size={24} className="text-success" />
                    <p>All caught up! No critical alerts.</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-item ${notif.unread ? 'unread' : ''} type-${notif.type}`}
                      role="menuitem"
                      tabIndex="0"
                      onClick={() => handleNotificationClick(notif.link)}
                    >
                      <div className={`notification-icon ${notif.type}`}>
                        {notif.type === 'warning' && <AlertTriangle size={16} />}
                        {notif.type === 'success' && <CreditCard size={16} />}
                        {notif.type === 'info' && <Users size={16} />}
                        {notif.type === 'system' && <Database size={16} />}
                      </div>
                      <div className="notification-content">
                        <div className="notif-title-row">
                          <p className="notification-title">{notif.title}</p>
                          {notif.badge && <span className="notif-card-badge">{notif.badge}</span>}
                        </div>
                        <p className="notification-message">{notif.message}</p>
                        <span className="notification-time">{notif.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="dropdown-divider" />
              <button
                className="dropdown-footer"
                role="menuitem"
                onClick={() => {
                  setNotificationsOpen(false);
                  navigate('/pending-fees');
                }}
              >
                View Fee Dues Center →
              </button>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="dropdown user-dropdown" ref={userMenuRef}>
          <button
            className="user-btn"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <div className="user-avatar">
              {user?.full_name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <span className="user-name-text">{user?.full_name || user?.username || 'Admin'}</span>
            <ChevronDown size={16} className="chevron" />
          </button>

          {userMenuOpen && (
            <div className="dropdown-menu dropdown-menu-right user-dropdown-menu" role="menu">
              <div className="dropdown-header user-header">
                <div className="user-avatar large">
                  {user?.full_name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div>
                  <p className="user-full-name">{user?.full_name || user?.username || 'Administrator'}</p>
                  <p className="user-email">{user?.email || 'admin@school.local'}</p>
                  <span className="user-role-badge">
                    <ShieldCheck size={12} /> {user?.role || 'Admin'}
                  </span>
                </div>
              </div>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate('/settings?tab=profile');
                }}
              >
                <User size={18} /> Admin Profile &amp; Account
              </button>
              <button
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate('/settings?tab=profile');
                }}
              >
                <Key size={18} /> Change Password
              </button>
              <button
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate('/settings');
                }}
              >
                <Settings size={18} /> System Settings
              </button>
              <div className="dropdown-divider" />
              <button className="dropdown-item danger" onClick={logout} role="menuitem">
                <LogOut size={18} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}