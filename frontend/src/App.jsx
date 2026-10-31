import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import { useAuth } from './context/AuthContext';

function IndexRedirect() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return role === 'customer' ? (
    <Navigate to="/portal/subscriptions" replace />
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

function PagePlaceholder({ title }) {
  return (
    <div className="bg-cream-light border-2 border-ink rounded-[4px] p-8 shadow-neo">
      <h1 className="font-anton text-2xl uppercase tracking-wide text-ink mb-2">
        {title}
      </h1>
      <p className="text-xs text-ink/70 font-inter">
        This view is being loaded.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Root redirect */}
      <Route path="/" element={<IndexRedirect />} />

      {/* Authenticated Staff/Admin App Routes */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<PagePlaceholder title="Dashboard" />} />
        <Route path="/customers" element={<PagePlaceholder title="Customers" />} />
        <Route path="/customers/:id" element={<PagePlaceholder title="Customer Details" />} />
        <Route path="/subscriptions" element={<PagePlaceholder title="Subscriptions" />} />
        <Route path="/subscriptions/:id" element={<PagePlaceholder title="Subscription Details" />} />
        <Route path="/templates" element={<PagePlaceholder title="Quotation Templates" />} />
        <Route path="/products" element={<PagePlaceholder title="Products" />} />
        <Route path="/plans" element={<PagePlaceholder title="Subscription Plans" />} />
        <Route path="/invoices" element={<PagePlaceholder title="Invoices" />} />
        <Route path="/payments" element={<PagePlaceholder title="Payments" />} />
        <Route path="/discounts" element={<PagePlaceholder title="Discounts" />} />
        <Route path="/reports" element={<PagePlaceholder title="Reports" />} />
        <Route path="/settings" element={<PagePlaceholder title="Settings" />} />
      </Route>

      {/* Customer Portal Routes */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/portal/subscriptions" element={<PagePlaceholder title="My Subscriptions" />} />
        <Route path="/portal/invoices" element={<PagePlaceholder title="My Invoices" />} />
        <Route path="/portal/profile" element={<PagePlaceholder title="My Profile" />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
