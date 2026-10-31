import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  type = 'button',
  onClick,
  ...props
}) {
  const baseClasses =
    'inline-flex items-center justify-center font-bold font-sans transition-all select-none border-2 border-ink cursor-pointer';

  const variants = {
    primary:
      'bg-brand-orange text-white shadow-neo hover:-translate-y-0.5 hover:shadow-neo-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed',
    secondary:
      'bg-white text-ink shadow-neo hover:-translate-y-0.5 hover:shadow-neo-lg hover:bg-cream-light active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed',
    success:
      'bg-brand-teal text-white shadow-neo hover:-translate-y-0.5 hover:shadow-neo-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed',
    danger:
      'bg-[#FF453A] text-white shadow-neo hover:-translate-y-0.5 hover:shadow-neo-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed',
    ghost:
      'bg-transparent border-transparent shadow-none hover:bg-black/5 hover:border-ink hover:shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5',
    icon:
      'bg-white text-ink shadow-neo hover:-translate-y-0.5 hover:shadow-neo-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed p-2',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1 rounded-[4px] gap-1.5',
    md: 'text-sm px-4 py-2 rounded-[4px] gap-2',
    lg: 'text-base px-5 py-2.5 rounded-[4px] gap-2.5',
  };

  const disabledClasses = disabled || loading
    ? '!opacity-60 !cursor-not-allowed !transform-none !shadow-neo-sm'
    : '';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        ${baseClasses}
        ${variants[variant] || variants.primary}
        ${variant !== 'icon' ? sizes[size] || sizes.md : 'rounded-[4px]'}
        ${disabledClasses}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : Icon && iconPosition === 'left' ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : null}

      <span>{children}</span>

      {!loading && Icon && iconPosition === 'right' ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : null}
    </button>
  );
}
