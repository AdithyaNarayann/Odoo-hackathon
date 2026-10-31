import React, { useState } from 'react';
import { Info } from 'lucide-react';

export default function Tooltip({
  content,
  children,
  position = 'top',
  showIcon = false,
  className = '',
}) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position] || 'bottom-full left-1/2 -translate-x-1/2 mb-2';

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children ? (
        children
      ) : showIcon ? (
        <button
          type="button"
          className="text-ink-muted hover:text-ink transition-colors cursor-help inline-flex"
        >
          <Info size={14} />
        </button>
      ) : null}

      {isVisible && content && (
        <div
          role="tooltip"
          className={`
            absolute z-50 whitespace-normal min-w-max max-w-xs bg-ink text-white text-xs font-medium px-2.5 py-1.5
            rounded-[4px] border-2 border-ink shadow-neo pointer-events-none animate-in fade-in-0 duration-100
            ${positionClasses}
          `}
        >
          {content}
        </div>
      )}
    </div>
  );
}
