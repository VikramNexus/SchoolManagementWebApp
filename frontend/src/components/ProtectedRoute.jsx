/**
 * ProtectedRoute — School Management System (Frontend)
 *
 * Day 3: Authentication & Security.
 *
 * Wrapper that redirects unauthenticated users to /login with the
 * intended destination preserved so they return after signing in.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import './ProtectedRoute.css';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="protected-route-loading" role="status" aria-label="Checking authentication…">
        <Loader2 size={28} className="spin" />
        <span>Verifying session…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
