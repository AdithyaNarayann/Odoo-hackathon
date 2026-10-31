import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Layers,
  FileSpreadsheet,
  Package,
  CalendarCheck,
  Receipt,
  CreditCard,
  Percent,
  BarChart3,
  Settings,
  UserCheck,
  FileText,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const { role } = useAuth();

  const isCustomer = role === 'customer';

  const staffNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Customers', path: '/customers', icon: Users },
    { label: 'Subscriptions', path: '/subscriptions', icon: Layers },
    { label: 'Templates', path: '/templates', icon: FileSpreadsheet },
    { label: 'Products', path: '/products', icon: Package },
    { label: 'Plans', path: '/plans', icon: CalendarCheck },
    { label: 'Invoices', path: '/invoices', icon: Receipt },
    { label: 'Payments', path: '/payments', icon: CreditCard },
    { label: 'Discounts', path: '/discounts', icon: Percent },
    { label: 'Reports', path: '/reports', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const customerNavItems = [
    { label: 'My Subscriptions', path: '/subscriptions', icon: Layers },
    { label: 'My Invoices', path: '/invoices', icon: FileText },
    { label: 'Profile', path: '/portal/profile', icon: UserCheck },
  ];

  const navItems = isCustomer ? customerNavItems : staffNavItems;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-ink/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-40 w-64 bg-cream border-r-2 border-ink flex flex-col justify-between
          transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:z-auto
          md:w-16 lg:w-64
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand Header */}
        <div className="p-3 lg:p-4 border-b-2 border-ink flex items-center justify-between md:justify-center lg:justify-between">
          <NavLink to={isCustomer ? '/portal/subscriptions' : '/dashboard'} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[4px] border-2 border-ink bg-brand-orange text-white flex items-center justify-center shadow-neo-sm font-anton text-lg shrink-0">
              BL
            </div>
            <span className="font-anton uppercase tracking-wider text-xl text-ink hidden lg:inline">
              Brightloop
            </span>
          </NavLink>

          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1 rounded-[4px] border border-ink hover:bg-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-2 lg:px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              title={item.label}
              className={({ isActive }) => `
                flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3.5 py-2.5 rounded-[4px] text-xs font-archivo font-extrabold uppercase tracking-wider transition-all
                ${
                  isActive
                    ? 'bg-brand-orange text-white border-2 border-ink shadow-neo-sm -translate-y-0.5'
                    : 'text-ink hover:bg-cream-light hover:border-2 hover:border-ink/40 border-2 border-transparent'
                }
              `}
            >
              <item.icon size={18} strokeWidth={2.5} className="shrink-0" />
              <span className="hidden lg:inline truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom Block from Design Sheet */}
        <div className="p-3 border-t-2 border-ink bg-cream-light relative overflow-hidden hidden md:block">
          <div className="relative z-10 hidden lg:block">
            <div className="text-[10px] font-archivo font-extrabold uppercase tracking-widest text-ink mb-1">
              Brightloop
            </div>
            <div className="text-[11px] font-bold text-ink leading-tight">
              SUBSCRIPTION SYSTEM V1.0
            </div>
          </div>

          {/* Geometric Art Accent (from sheet) */}
          <div className="flex items-end justify-center lg:absolute lg:right-2 lg:bottom-1 lg:justify-end gap-1 opacity-90 pointer-events-none">
            <div className="w-3.5 lg:w-5 h-6 lg:h-8 bg-brand-orange border-2 border-ink rounded-t-full shadow-neo-sm" />
            <div className="w-4 lg:w-6 h-4 lg:h-6 bg-brand-teal border-2 border-ink rounded-[4px] shadow-neo-sm" />
          </div>
        </div>
      </aside>
    </>
  );
}
