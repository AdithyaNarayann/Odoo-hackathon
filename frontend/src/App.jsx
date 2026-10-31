import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-cream p-8 flex flex-col items-center justify-center">
      <div className="border-2 border-ink rounded-[4px] shadow-neo p-6 bg-white text-center max-w-md">
        <h1 className="font-anton text-3xl uppercase tracking-wider text-brand-orange mb-2">
          Brightloop
        </h1>
        <p className="font-archivo font-extrabold uppercase text-xs tracking-wider text-ink mb-4">
          Subscription Management System
        </p>
        <p className="text-sm font-medium text-ink-muted">
          Design system and components initialized successfully.
        </p>
      </div>
    </div>
  );
}
