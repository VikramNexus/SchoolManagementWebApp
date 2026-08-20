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
} from 'lucide-react';
import './Sidebar.css';

const NAV_GROUPS = [
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

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-minimize sidebar whenever ANY section/page is opened or navigated to
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

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar Container */}
      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${hoverExpanded ? 'hover-expanded' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        onMouseEnter={() => {
          if (collapsed) setHoverExpanded(true);
        }}
        onMouseLeave={() => {
          setHoverExpanded(false);
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
              <span className="brand-badge">Academic Suite</span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav custom-scrollbar">
          {NAV_GROUPS.map((group, gIdx) => (
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
                      {/* Active glow accent bar */}
                      <span className="nav-active-bar" />
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Hamburger Toggle Button */}
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