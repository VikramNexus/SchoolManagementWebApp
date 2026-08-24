import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  CreditCard,
  Receipt,
  AlertTriangle,
  MessageSquare,
  BarChart2,
  Settings,
  Database,
  School,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import './Sidebar.css';

// Full navigation suite for Desktop view
const DESKTOP_NAV_GROUPS = [
  {
    group: 'CORE',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admissions', label: 'New Admission', icon: UserPlus, badge: 'Desk' },
      { path: '/students', label: 'Students', icon: Users },
    ],
  },
  {
    group: 'FINANCE & ACCOUNTS',
    items: [
      { path: '/pending-fees', label: 'Pending Dues', icon: AlertTriangle, badge: 'Dues' },
      { path: '/payments', label: 'Payments', icon: CreditCard },
      { path: '/receipts', label: 'Receipts', icon: Receipt },
    ],
  },
  {
    group: 'MANAGEMENT',
    items: [
      { path: '/messages', label: 'Messages', icon: MessageSquare },
      { path: '/reports', label: 'Reports', icon: BarChart2 },
      { path: '/settings', label: 'Settings', icon: Settings },
      { path: '/backup', label: 'Backup & Restore', icon: Database },
    ],
  },
];

// Curated 6 essential options strictly for Phone / Mobile view
const MOBILE_NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admissions', label: 'New Admission', icon: UserPlus, badge: 'Desk' },
  { path: '/students', label: 'Manage Students', icon: Users },
  { path: '/pending-fees', label: 'Pending Dues', icon: AlertTriangle, badge: 'Dues' },
  { path: '/receipts', label: 'Receipts', icon: Receipt },
  { path: '/backup', label: 'Backup & Restore', icon: Database },
];

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Monitor window resize for responsive mode detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-close sidebar whenever navigating to any section
  useEffect(() => {
    setMobileOpen(false);
    setHoverExpanded(false);
    setCollapsed(true);
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLinkClick = () => {
    setHoverExpanded(false);
    setMobileOpen(false);
    setCollapsed(true);
  };

  // Mobile view: completely remove sidebar (navigation is handled via MobileBottomNav)
  if (isMobile) {
    return null;
  }

  return (
    <>
      {/* Mobile background overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`sidebar ${!isMobile && collapsed ? 'collapsed' : ''} ${!isMobile && hoverExpanded ? 'hover-expanded' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        onMouseEnter={() => {
          if (collapsed && !isMobile) setHoverExpanded(true);
        }}
        onMouseLeave={() => {
          if (!isMobile) setHoverExpanded(false);
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-content">
            <div className="brand-icon-wrapper">
              <School size={22} className="brand-icon-svg" />
              <span className="brand-pulse-dot" />
            </div>
            <div className="brand-text-col">
              <span className="brand-title">Aryavart Portal</span>
              <span className="brand-badge">{isMobile ? 'Mobile Menu' : 'Academic Suite'}</span>
            </div>
            {!isMobile && (
              <button
                type="button"
                className="desktop-sidebar-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed(!collapsed);
                  setHoverExpanded(false);
                }}
                title={collapsed ? 'Lock Sidebar Open' : 'Collapse Sidebar'}
                aria-label={collapsed ? 'Lock Sidebar Open' : 'Collapse Sidebar'}
              >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            )}
          </div>
          {mobileOpen && (
            <button
              type="button"
              className="mobile-close-drawer-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav custom-scrollbar">
          {isMobile ? (
            /* PHONE VIEW: ONLY the 6 requested menu items */
            <div className="nav-group-section mobile-curated-group">
              <span className="nav-group-heading">MAIN MENU</span>
              <ul className="nav-list" role="list">
                {MOBILE_NAV_ITEMS.map((item) => (
                  <li key={item.path} className="nav-item">
                    <NavLink
                      to={item.path}
                      onClick={handleLinkClick}
                      className={({ isActive: active }) => `nav-pill-link ${active ? 'active' : ''}`}
                      aria-current={isActive(item.path) ? 'page' : undefined}
                    >
                      <div className="nav-icon-container">
                        <item.icon size={20} className="nav-icon-svg" aria-hidden="true" />
                      </div>
                      <div className="nav-label-wrapper">
                        <span className="nav-label-text">{item.label}</span>
                        {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                      </div>
                      <span className="nav-active-bar" />
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            /* DESKTOP VIEW: Full navigation suite intact */
            DESKTOP_NAV_GROUPS.map((group, gIdx) => (
              <div key={gIdx} className="nav-group-section">
                <span className="nav-group-heading">{group.group}</span>
                <ul className="nav-list" role="list">
                  {group.items.map((item) => (
                    <li key={item.path} className="nav-item">
                      <NavLink
                        to={item.path}
                        onClick={handleLinkClick}
                        className={({ isActive: active }) => `nav-pill-link ${active ? 'active' : ''}`}
                        title={collapsed && !hoverExpanded ? item.label : undefined}
                        aria-current={isActive(item.path) ? 'page' : undefined}
                      >
                        <div className="nav-icon-container">
                          <item.icon size={19} className="nav-icon-svg" aria-hidden="true" />
                        </div>
                        <div className="nav-label-wrapper">
                          <span className="nav-label-text">{item.label}</span>
                          {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                        </div>
                        <span className="nav-active-bar" />
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>
      </aside>

      {/* Mobile Hamburger Toggle Button (Clean floating or topbar integrated) */}
      <button
        type="button"
        className="mobile-menu-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
      >
        <Menu size={22} />
      </button>
    </>
  );
}