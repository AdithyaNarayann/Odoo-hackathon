import React from 'react';

export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  sublabel,
  color = 'orange', // 'orange' | 'teal'
  className = '',
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const colorMap = {
    orange: 'bg-brand-orange',
    teal: 'bg-brand-teal',
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || sublabel) && (
        <div className="flex items-center justify-between text-xs font-semibold mb-1">
          {label && <span className="font-archivo font-extrabold uppercase tracking-wider text-ink">{label}</span>}
          {sublabel !== undefined ? (
            <span className="text-ink-muted">{sublabel}</span>
          ) : (
            <span className="font-mono text-ink font-bold">{percentage}%</span>
          )}
        </div>
      )}

      <div className="w-full h-4 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm overflow-hidden p-0.5">
        <div
          className={`h-full rounded-[2px] transition-all duration-300 ${colorMap[color] || colorMap.orange}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
