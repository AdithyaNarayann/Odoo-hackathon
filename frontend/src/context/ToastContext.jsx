import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, Info, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { apiEvents } from '../api/client';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, message, type = 'info', duration = 4000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen to 403 Forbidden events dispatched by fetch client
  useEffect(() => {
    const handleForbidden = (event) => {
      addToast({
        type: 'error',
        title: 'Access Forbidden',
        message: event.detail || 'You do not have permission to perform this action.',
      });
    };

    apiEvents.addEventListener('auth:forbidden', handleForbidden);
    return () => apiEvents.removeEventListener('auth:forbidden', handleForbidden);
  }, [addToast]);

  const success = useCallback((message, title = 'Success') => addToast({ type: 'success', title, message }), [addToast]);
  const error = useCallback((message, title = 'Error') => addToast({ type: 'error', title, message }), [addToast]);
  const warning = useCallback((message, title = 'Warning') => addToast({ type: 'warning', title, message }), [addToast]);
  const info = useCallback((message, title = 'Info') => addToast({ type: 'info', title, message }), [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
      {children}

      {/* Fixed Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const typeConfig = {
            success: {
              bg: 'bg-brand-teal text-white',
              icon: CheckCircle2,
            },
            info: {
              bg: 'bg-brand-slate text-white',
              icon: Info,
            },
            warning: {
              bg: 'bg-brand-amber text-ink',
              icon: AlertTriangle,
            },
            error: {
              bg: 'bg-brand-orange text-white',
              icon: AlertCircle,
            },
          }[toast.type] || { bg: 'bg-white text-ink', icon: Info };

          const IconComponent = typeConfig.icon;

          return (
            <div
              key={toast.id}
              className={`
                pointer-events-auto border-2 border-ink rounded-[4px] shadow-neo p-3 flex items-start gap-3 transition-all animate-in slide-in-from-bottom-2
                ${typeConfig.bg}
              `}
            >
              <div className="mt-0.5 flex-shrink-0">
                <IconComponent size={18} strokeWidth={2.5} />
              </div>

              <div className="flex-1 text-xs">
                {toast.title && <div className="font-archivo font-extrabold uppercase tracking-wider leading-tight">{toast.title}</div>}
                <div className="font-medium mt-0.5 opacity-90">{toast.message}</div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 p-0.5 rounded transition-opacity"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
