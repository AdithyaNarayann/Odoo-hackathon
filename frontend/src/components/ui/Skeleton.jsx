import React from 'react';

export default function Skeleton({ className = '', rounded = 'rounded-[4px]' }) {
  return (
    <div
      className={`
        animate-pulse bg-[#E5E0D5] border-2 border-ink/20 ${rounded} ${className}
      `}
    />
  );
}
