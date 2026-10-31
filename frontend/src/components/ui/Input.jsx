import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function Input({
  label,
  error,
  helperText,
  icon: Icon,
  className = '',
  containerClassName = '',
  id,
  type = 'text',
  disabled = false,
  required = false,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5"
        >
          {label} {required && <span className="text-brand-orange">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 text-ink-muted pointer-events-none">
            <Icon size={16} />
          </div>
        )}

        <input
          id={inputId}
          type={type}
          disabled={disabled}
          className={`
            w-full bg-white text-ink text-sm font-sans font-medium px-3.5 py-2 rounded-[4px]
            border-2 transition-all outline-none
            ${Icon ? 'pl-9' : ''}
            ${error ? 'pr-9 border-[#FF453A] focus:shadow-neo-orange' : 'border-ink focus:shadow-neo'}
            ${disabled ? 'bg-cream/50 cursor-not-allowed opacity-70' : 'hover:border-ink'}
            ${className}
          `}
          {...props}
        />

        {error && (
          <div className="absolute right-3 text-[#FF453A] pointer-events-none">
            <AlertCircle size={16} />
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-1 text-xs font-semibold text-[#FF453A] flex items-center gap-1">
          {error}
        </p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-ink-muted font-medium">{helperText}</p>
      ) : null}
    </div>
  );
}
