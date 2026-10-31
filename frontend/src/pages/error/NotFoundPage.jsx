import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { useAuth, getRoleHome } from '../../context/AuthContext';
import Button from '../../components/ui/Button';

export default function NotFoundPage() {
  const { user } = useAuth();
  const roleHome = getRoleHome(user?.role);

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-4">
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-8 shadow-neo max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-[4px] border-2 border-ink bg-brand-orange text-white flex items-center justify-center mx-auto mb-4 shadow-neo-sm">
          <Compass size={32} />
        </div>
        <div className="font-anton text-6xl text-ink mb-1">404</div>
        <h2 className="font-anton text-2xl uppercase tracking-wider text-ink mb-2">
          Page Not Found
        </h2>
        <p className="text-xs font-medium text-ink/70 mb-6 font-inter">
          The page you are looking for doesn't exist or has been moved to another location.
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
