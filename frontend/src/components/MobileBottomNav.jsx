/**
 * Mobile Bottom Navigation Bar — Aryavart School Portal
 * Touch-optimized bottom bar for Android & mobile screens (< 768px).
 * Displays ONLY the 6 requested core actions with active indicator glow.
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  AlertTriangle,
  Receipt,
  CreditCard,
} from 'lucide-react';
import './MobileBottomNav.css';

const BOTTOM_NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admissions', label: 'Admission', icon: UserPlus },
  { path: '/students', label: 'Students', icon: Users },
  { path: '/pending-fees', label: 'Dues', icon: AlertTriangle },
  { path: '/receipts', label: 'Receipts', icon: Receipt },
  { path: '/payments', label: 'Payments', icon: CreditCard },
];

export default function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label="Mobile Bottom Navigation">
      <div className="mobile-bottom-nav-inner">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `mobile-tab-item ${isActive ? 'active' : ''}`}
          >
            <div className="tab-icon-wrap">
              <item.icon size={20} className="tab-icon" />
            </div>
            <span className="tab-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
