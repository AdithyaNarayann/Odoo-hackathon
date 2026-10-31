import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export default function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  error,
  disabled = false,
  required = false,
  className = '',
  containerClassName = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const handleSelect = (optValue) => {
    if (disabled) return;
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div className={`w-full relative ${containerClassName}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
          {label} {required && <span className="text-brand-orange">*</span>}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`
          w-full bg-white text-ink text-sm font-sans font-medium px-3.5 py-2 rounded-[4px]
          border-2 border-ink flex items-center justify-between transition-all outline-none
          ${isOpen ? 'shadow-neo' : 'hover:shadow-neo-sm'}
          ${error ? 'border-[#FF453A]' : ''}
          ${disabled ? 'bg-cream/50 cursor-not-allowed opacity-70' : 'cursor-pointer'}
          ${className}
        `}
      >
        <span className={selectedOption ? 'text-ink font-semibold' : 'text-ink-muted'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-150 text-ink ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border-2 border-ink rounded-[4px] shadow-neo-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-3 text-xs text-ink-muted text-center font-medium">No options available</div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`
                    px-3.5 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between
                    ${
                      isSelected
                        ? 'bg-brand-orange text-white font-bold'
                        : 'text-ink hover:bg-cream-light font-medium'
                    }
                  `}
                >
                  <span>{opt.label}</span>
                  {opt.sublabel && (
                    <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-ink-muted'}`}>
                      {opt.sublabel}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs font-semibold text-[#FF453A] flex items-center gap-1">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
