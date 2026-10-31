import React from 'react';

export default function Badge({
  status,
  type = 'subscription', // 'subscription' | 'invoice' | 'custom'
  label,
  variant,
  className = '',
}) {
  const normStatus = (status || '').toLowerCase();

  // Color mapping strictly obeying PDF rules:
  // Subscription: Draft grey, Quotation slate blue, Confirmed amber, Active teal, Closed black, Paused outlined grey.
  // Invoice: Draft grey, Confirmed slate blue, Paid teal, Overdue orange (derived from is_overdue), Cancelled black.
  let colorClasses = 'bg-[#E5E7EB] text-ink border-ink'; // fallback default

  if (variant) {
    const variantMap = {
      teal: 'bg-brand-teal text-white border-ink',
      orange: 'bg-brand-orange text-white border-ink',
      amber: 'bg-brand-amber text-ink border-ink',
      slate: 'bg-brand-slate text-white border-ink',
      black: 'bg-brand-dark text-white border-ink',
      grey: 'bg-[#D1D5DB] text-ink border-ink',
      outline: 'bg-transparent text-ink border-ink border-dashed',
    };
    colorClasses = variantMap[variant] || colorClasses;
  } else if (type === 'subscription') {
    switch (normStatus) {
      case 'active':
        colorClasses = 'bg-brand-teal text-white border-ink';
        break;
      case 'quotation':
        colorClasses = 'bg-brand-slate text-white border-ink';
        break;
      case 'confirmed':
        colorClasses = 'bg-brand-amber text-ink border-ink';
        break;
      case 'closed':
        colorClasses = 'bg-brand-dark text-white border-ink';
        break;
      case 'paused':
        colorClasses = 'bg-cream-light text-ink border-ink border-dashed';
        break;
      case 'draft':
      default:
        colorClasses = 'bg-[#D1D5DB] text-ink border-ink';
        break;
    }
  } else if (type === 'invoice') {
    switch (normStatus) {
      case 'paid':
        colorClasses = 'bg-brand-teal text-white border-ink';
        break;
      case 'confirmed':
      case 'posted':
        colorClasses = 'bg-brand-slate text-white border-ink';
        break;
      case 'overdue':
        colorClasses = 'bg-brand-orange text-white border-ink';
        break;
      case 'cancelled':
        colorClasses = 'bg-brand-dark text-white border-ink';
        break;
      case 'draft':
      default:
        colorClasses = 'bg-[#D1D5DB] text-ink border-ink';
        break;
    }
  }

  const displayLabel = label || normStatus.replace(/_/g, ' ');

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-[4px] border-2 text-[11px] font-archivo font-extrabold
        uppercase tracking-wider shadow-neo-sm select-none
        ${colorClasses}
        ${className}
      `}
    >
      {displayLabel}
    </span>
  );
}
