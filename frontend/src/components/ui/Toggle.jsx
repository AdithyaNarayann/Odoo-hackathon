import React from 'react';

export default function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  id,
  className = '',
}) {
  const toggleId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      {(label || description) && (
        <div className="flex-1">
          {label && (
            <label
              htmlFor={toggleId}
              className="text-xs font-archivo font-extrabold uppercase tracking-wider text-ink block cursor-pointer select-none"
            >
              {label}
            </label>
          )}
          {description && <p className="text-xs text-ink-muted mt-0.5 font-medium">{description}</p>}
        </div>
      )}

      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-ink
          transition-colors duration-150 ease-in-out outline-none
          ${checked ? 'bg-brand-orange' : 'bg-[#D6D3CD]'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-neo-sm'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white border border-ink
            shadow-sm transition duration-150 ease-in-out mt-0.5
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  );
}
