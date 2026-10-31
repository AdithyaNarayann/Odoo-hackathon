import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function StatCard({
  title,
  value,
  subvalue,
  icon: Icon,
  trend, // { value: number | string, positive?: boolean, label?: string }
  highlight = false, // Orange hero variant
  className = '',
}) {
  return (
    <div
      className={`
        border-2 border-ink rounded-[4px] shadow-neo p-4 transition-all
        ${highlight ? 'bg-brand-orange text-white' : 'bg-white text-ink'}
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`
            text-xs font-archivo font-extrabold uppercase tracking-wider
            ${highlight ? 'text-white/90' : 'text-ink-muted'}
          `}
        >
          {title}
        </span>
        {Icon && (
          <div
            className={`
              w-7 h-7 rounded-[4px] border-2 border-ink flex items-center justify-center shadow-neo-sm
              ${highlight ? 'bg-white text-brand-orange' : 'bg-cream text-ink'}
            `}
          >
            <Icon size={16} strokeWidth={2.5} />
          </div>
        )}
      </div>

      <div className="my-1.5">
        <div
          className={`
            font-anton text-3xl tracking-wide tabular-nums leading-none
            ${highlight ? 'text-white' : 'text-ink'}
          `}
        >
          {value}
        </div>
        {subvalue && (
          <div
            className={`
              text-xs mt-1 font-semibold
              ${highlight ? 'text-white/80' : 'text-ink-muted'}
            `}
          >
            {subvalue}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 pt-2 border-t border-black/10 flex items-center justify-between text-xs">
          <div
            className={`
              flex items-center gap-1 font-bold
              ${
                highlight
                  ? 'text-white'
                  : trend.positive
                  ? 'text-brand-teal'
                  : 'text-[#E53E3E]'
              }
            `}
          >
            {trend.positive ? (
              <ArrowUpRight size={14} strokeWidth={3} />
            ) : (
              <ArrowDownRight size={14} strokeWidth={3} />
            )}
            <span>{trend.value}</span>
            {trend.label && (
              <span className={`font-normal ${highlight ? 'text-white/75' : 'text-ink-muted'}`}>
                {trend.label}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
