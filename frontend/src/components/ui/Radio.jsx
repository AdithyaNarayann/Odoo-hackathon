import React from 'react';

export default function Radio({
  checked = false,
  onChange,
  value,
  name,
  label,
  description,
  disabled = false,
  id,
  className = '',
}) {
  const radioId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label
      htmlFor={radioId}
      className={`inline-flex items-start gap-2.5 cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          id={radioId}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => onChange(value)}
          className="sr-only"
        />
        <div
          className={`
            w-5 h-5 rounded-full border-2 border-ink flex items-center justify-center transition-all bg-white
            ${checked ? 'shadow-neo-sm' : 'hover:bg-cream-light'}
          `}
        >
          {checked && <div className="w-2.5 h-2.5 rounded-full bg-brand-orange" />}
        </div>
      </div>

      {(label || description) && (
        <div className="text-sm">
          {label && <span className="font-bold text-ink text-sm block leading-tight">{label}</span>}
          {description && <span className="text-xs text-ink-muted block mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  );
}
