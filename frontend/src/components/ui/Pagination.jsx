import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  page = 1,
  pageSize = 25,
  total = 0,
  onPageChange,
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className={`flex items-center justify-between gap-4 py-3 select-none ${className}`}>
      <div className="text-xs font-semibold text-ink-muted">
        Showing{' '}
        <span className="font-bold text-ink">
          {total === 0 ? 0 : (page - 1) * pageSize + 1}
        </span>{' '}
        to{' '}
        <span className="font-bold text-ink">
          {Math.min(page * pageSize, total)}
        </span>{' '}
        of <span className="font-bold text-ink">{total}</span> results
      </div>

      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="w-8 h-8 rounded-[4px] border-2 border-ink bg-white flex items-center justify-center font-bold shadow-neo-sm hover:bg-cream-light active:shadow-neo-pressed disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <ChevronLeft size={16} />
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs font-bold text-ink-muted">
                ...
              </span>
            );
          }

          const isCurrent = p === page;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`
                w-8 h-8 rounded-[4px] border-2 border-ink text-xs font-archivo font-extrabold flex items-center justify-center transition-all cursor-pointer
                ${
                  isCurrent
                    ? 'bg-brand-orange text-white shadow-neo-sm -translate-y-0.5'
                    : 'bg-white text-ink shadow-neo-sm hover:bg-cream-light active:shadow-neo-pressed'
                }
              `}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="w-8 h-8 rounded-[4px] border-2 border-ink bg-white flex items-center justify-center font-bold shadow-neo-sm hover:bg-cream-light active:shadow-neo-pressed disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
