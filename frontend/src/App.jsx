import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import { useAuth } from './context/AuthContext';

// Eager load core authentication pages
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Route-level code-splitting with dynamic import() for heavy sub-pages (Recharts, Tables, Forms)
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const CustomersListPage = lazy(() => import('./pages/customers/CustomersListPage'));
const CustomerDetailPage = lazy(() => import('./pages/customers/CustomerDetailPage'));
const SubscriptionsListPage = lazy(() => import('./pages/subscriptions/SubscriptionsListPage'));
const SubscriptionFormPage = lazy(() => import('./pages/subscriptions/SubscriptionFormPage'));
const SubscriptionDetailPage = lazy(() => import('./pages/subscriptions/SubscriptionDetailPage'));
const BillingRunPage = lazy(() => import('./pages/billing/BillingRunPage'));
const InvoicesListPage = lazy(() => import('./pages/invoices/InvoicesListPage'));
const InvoiceDetailPage = lazy(() => import('./pages/invoices/InvoiceDetailPage'));
const InvoicePrintPage = lazy(() => import('./pages/invoices/InvoicePrintPage'));
const PaymentsListPage = lazy(() => import('./pages/payments/PaymentsListPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const CustomerSubscriptionsPage = lazy(() => import('./pages/portal/CustomerSubscriptionsPage'));
const CustomerProfilePage = lazy(() => import('./pages/portal/CustomerProfilePage'));
const ProductsPage = lazy(() => import('./pages/catalog/ProductsPage'));
const PlansPage = lazy(() => import('./pages/catalog/PlansPage'));
const TemplatesPage = lazy(() => import('./pages/catalog/TemplatesPage'));
const DiscountsPage = lazy(() => import('./pages/discounts/DiscountsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));

function PageFallback() {
  return (
    <div className="space-y-6 animate-pulse py-2">
      <div className="h-10 w-64 bg-[#E5E0D5] border-2 border-ink rounded-[4px] shadow-neo-sm" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-[#E5E0D5] border-2 border-ink rounded-[4px] shadow-neo" />
        ))}
      </div>
      <div className="h-72 bg-[#E5E0D5] border-2 border-ink rounded-[4px] shadow-neo" />
    </div>
  );
}

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
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<PageFallback />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="/customers"
          element={
            <Suspense fallback={<PageFallback />}>
              <CustomersListPage />
            </Suspense>
          }
        />
        <Route
          path="/customers/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <CustomerDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/subscriptions"
          element={
            <Suspense fallback={<PageFallback />}>
              <SubscriptionsListPage />
            </Suspense>
          }
        />
        <Route
          path="/subscriptions/new"
          element={
            <Suspense fallback={<PageFallback />}>
              <SubscriptionFormPage />
            </Suspense>
          }
        />
        <Route
          path="/subscriptions/:id/edit"
          element={
            <Suspense fallback={<PageFallback />}>
              <SubscriptionFormPage />
            </Suspense>
          }
        />
        <Route
          path="/subscriptions/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <SubscriptionDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/templates"
          element={
            <Suspense fallback={<PageFallback />}>
              <TemplatesPage />
            </Suspense>
          }
        />
        <Route
          path="/products"
          element={
            <Suspense fallback={<PageFallback />}>
              <ProductsPage />
            </Suspense>
          }
        />
        <Route
          path="/plans"
          element={
            <Suspense fallback={<PageFallback />}>
              <PlansPage />
            </Suspense>
          }
        />
        <Route
          path="/billing"
          element={
            <Suspense fallback={<PageFallback />}>
              <BillingRunPage />
            </Suspense>
          }
        />
        <Route
          path="/invoices"
          element={
            <Suspense fallback={<PageFallback />}>
              <InvoicesListPage />
            </Suspense>
          }
        />
        <Route
          path="/invoices/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <InvoiceDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/invoices/:id/print"
          element={
            <Suspense fallback={<PageFallback />}>
              <InvoicePrintPage />
            </Suspense>
          }
        />
        <Route
          path="/payments"
          element={
            <Suspense fallback={<PageFallback />}>
              <PaymentsListPage />
            </Suspense>
          }
        />
        <Route
          path="/discounts"
          element={
            <Suspense fallback={<PageFallback />}>
              <DiscountsPage />
            </Suspense>
          }
        />
        <Route
          path="/reports"
          element={
            <Suspense fallback={<PageFallback />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<PageFallback />}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Route>

      {/* Customer Portal Routes */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/portal/subscriptions"
          element={
            <Suspense fallback={<PageFallback />}>
              <CustomerSubscriptionsPage />
            </Suspense>
          }
        />
        <Route
          path="/portal/invoices"
          element={
            <Suspense fallback={<PageFallback />}>
              <InvoicesListPage />
            </Suspense>
          }
        />
        <Route
          path="/portal/invoices/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <InvoiceDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/portal/invoices/:id/print"
          element={
            <Suspense fallback={<PageFallback />}>
              <InvoicePrintPage />
            </Suspense>
          }
        />
        <Route
          path="/portal/profile"
          element={
            <Suspense fallback={<PageFallback />}>
              <CustomerProfilePage />
            </Suspense>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
