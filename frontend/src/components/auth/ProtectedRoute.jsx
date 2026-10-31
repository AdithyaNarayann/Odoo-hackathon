import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth, getRoleHome } from '../../context/AuthContext';
import { ShieldAlert, Home } from 'lucide-react';
import Button from '../ui/Button';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-8 font-inter">
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-8 shadow-neo max-w-sm w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[4px] border-2 border-ink bg-brand-orange text-white shadow-neo font-anton text-2xl mb-1">
            BL
          </div>
          <div className="font-anton text-2xl uppercase tracking-wider text-ink">Brightloop</div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="w-5 h-5 border-2 border-ink border-t-brand-orange rounded-full animate-spin" />
            <p className="font-bold text-ink text-sm">Loading Brightloop...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    const roleHome = getRoleHome(user?.role);
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-4">
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-8 shadow-neo max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-[4px] border-2 border-ink bg-brand-danger text-white flex items-center justify-center mx-auto mb-4 shadow-neo-sm">
            <ShieldAlert size={32} />
          </div>
          <h2 className="font-anton text-2xl uppercase tracking-wider text-ink mb-2">
            Access Denied
          </h2>
          <p className="text-xs font-medium text-ink/70 mb-6 font-inter">
            Your role (<strong className="text-ink uppercase">{user?.role}</strong>) does not have permission to access this view.
          </p>
          <Link to={roleHome}>
            <Button variant="primary" className="mx-auto">
              <Home size={14} className="mr-2" />
              <span>Return to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
