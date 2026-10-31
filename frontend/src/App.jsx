import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CustomersListPage from './pages/customers/CustomersListPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import SubscriptionsListPage from './pages/subscriptions/SubscriptionsListPage';
import SubscriptionFormPage from './pages/subscriptions/SubscriptionFormPage';
import SubscriptionDetailPage from './pages/subscriptions/SubscriptionDetailPage';
import BillingRunPage from './pages/billing/BillingRunPage';
import ProductsPage from './pages/catalog/ProductsPage';
import PlansPage from './pages/catalog/PlansPage';
import TemplatesPage from './pages/catalog/TemplatesPage';
import DiscountsPage from './pages/discounts/DiscountsPage';
import SettingsPage from './pages/settings/SettingsPage';
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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomersListPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/subscriptions" element={<SubscriptionsListPage />} />
        <Route path="/subscriptions/new" element={<SubscriptionFormPage />} />
        <Route path="/subscriptions/:id/edit" element={<SubscriptionFormPage />} />
        <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/billing" element={<BillingRunPage />} />
        <Route path="/invoices" element={<PagePlaceholder title="Invoices" />} />
        <Route path="/payments" element={<PagePlaceholder title="Payments" />} />
        <Route path="/discounts" element={<DiscountsPage />} />
        <Route path="/reports" element={<PagePlaceholder title="Reports" />} />
        <Route path="/settings" element={<SettingsPage />} />
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
        <Route path="/portal/profile" element={<SettingsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
