/**
 * App — School Management System (Frontend)
 *
 * Day 5: Settings Integration & Students.
 *
 * Routes:
 *   /login           → public login page
 *   /dashboard       → protected (requires JWT)
 *   /settings        → protected settings page
 *   /students        → protected students list
 *   /students/:id    → protected student profile
 *   * (fallback)     → redirect to /dashboard
 */

import React, { Component } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Admissions from './pages/Admissions';
import Students from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import PendingFees from './pages/PendingFees';
import Payments from './pages/Payments';
import Receipts from './pages/Receipts';
import Messages from './pages/Messages';
import Reports from './pages/Reports';
import Backup from './pages/Backup';
import './App.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('App ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'sans-serif', color: '#1e293b' }}>
          <h2 style={{ color: '#ef4444' }}>⚠️ Something went wrong</h2>
          <p style={{ color: '#64748b' }}>{this.state.error?.message || 'Unknown error occurred'}</p>
          <button
            style={{ padding: '10px 20px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '12px' }}
            onClick={() => { localStorage.clear(); window.location.reload(); }}
          >
            Reset &amp; Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Layout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading" role="status" aria-label="Loading application…">
        <div className="loading-spinner" />
        <p>Initializing…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <main className="page-content" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes with layout */}
      <Route element={<Layout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admissions"
          element={
            <ProtectedRoute>
              <Admissions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students"
          element={
            <ProtectedRoute>
              <Students />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/:id"
          element={
            <ProtectedRoute>
              <StudentProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pending-fees"
          element={
            <ProtectedRoute>
              <PendingFees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/receipts"
          element={
            <ProtectedRoute>
              <Receipts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/backup"
          element={
            <ProtectedRoute>
              <Backup />
            </ProtectedRoute>
          }
        />
        {/* Default: redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <div className="app-root">
            <AppRoutes />
          </div>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}