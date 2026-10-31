import React from 'react';
import { FileText } from 'lucide-react';
import Button from './Button';

export default function EmptyState({
  icon: Icon = FileText,
  title = 'No Data Found',
  description = 'There are no records to display at this time.',
  actionText,
  onAction,
  compact = false,
  className = '',
}) {
  return (
    <div
      className={`
        border-2 border-ink rounded-[4px] shadow-neo bg-white text-center flex flex-col items-center justify-center
        ${compact ? 'p-6 border-dashed shadow-none' : 'p-10'}
        ${className}
      `}
    >
      <div className="w-14 h-14 rounded-[4px] border-2 border-ink bg-cream flex items-center justify-center shadow-neo-sm mb-4 text-ink">
        <Icon size={28} strokeWidth={2} />
      </div>

      <h3 className="font-archivo font-extrabold uppercase tracking-wide text-lg text-ink mb-1">
        {title}
      </h3>

      <p className="text-sm font-medium text-ink-muted max-w-sm mb-5 leading-normal">
        {description}
      </p>

      {actionText && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
}
