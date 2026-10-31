import React from 'react';
import { Check } from 'lucide-react';

export default function Checkbox({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  id,
  className = '',
}) {
  const checkboxId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label
      htmlFor={checkboxId}
      className={`inline-flex items-start gap-2.5 cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`
            w-5 h-5 rounded-[3px] border-2 border-ink flex items-center justify-center transition-all
            ${checked ? 'bg-brand-orange text-white shadow-neo-sm' : 'bg-white hover:bg-cream-light'}
          `}
        >
          {checked && <Check size={14} strokeWidth={3.5} />}
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
