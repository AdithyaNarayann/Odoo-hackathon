import React from 'react';

export default function Tabs({ tabs = [], activeTab, onChange, className = '' }) {
  return (
    <div className={`inline-flex border-2 border-ink rounded-[4px] shadow-neo bg-white overflow-hidden p-0.5 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`
              px-4 py-1.5 text-xs font-archivo font-extrabold uppercase tracking-wider transition-all
              rounded-[2px] cursor-pointer select-none
              ${
                isActive
                  ? 'bg-brand-orange text-white shadow-neo-sm'
                  : 'text-ink hover:bg-cream-light font-bold'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive ? 'bg-white text-brand-orange' : 'bg-black/10 text-ink'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
