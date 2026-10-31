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
import InvoicesListPage from './pages/invoices/InvoicesListPage';
import InvoiceDetailPage from './pages/invoices/InvoiceDetailPage';
import InvoicePrintPage from './pages/invoices/InvoicePrintPage';
import PaymentsListPage from './pages/payments/PaymentsListPage';
import ReportsPage from './pages/reports/ReportsPage';
import CustomerSubscriptionsPage from './pages/portal/CustomerSubscriptionsPage';
import CustomerProfilePage from './pages/portal/CustomerProfilePage';
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
        <Route path="/invoices" element={<InvoicesListPage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/invoices/:id/print" element={<InvoicePrintPage />} />
        <Route path="/payments" element={<PaymentsListPage />} />
        <Route path="/discounts" element={<DiscountsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
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
        <Route path="/portal/subscriptions" element={<CustomerSubscriptionsPage />} />
        <Route path="/portal/invoices" element={<InvoicesListPage />} />
        <Route path="/portal/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/portal/invoices/:id/print" element={<InvoicePrintPage />} />
        <Route path="/portal/profile" element={<CustomerProfilePage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
