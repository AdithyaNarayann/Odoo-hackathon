import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Button from './Button';

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  loading = false,
  icon: Icon = AlertTriangle,
  children,
  maxWidth = 'max-w-md',
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-[1px] transition-opacity"
        onClick={() => !loading && onClose()}
      />

      {/* Modal Dialog Card */}
      <div
        className={`
          relative w-full ${maxWidth} bg-white border-2 border-ink rounded-[4px] shadow-neo-lg p-5 z-10
          animate-in zoom-in-95 duration-100
        `}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-full border-2 border-ink bg-brand-orange text-white flex items-center justify-center shadow-neo-sm flex-shrink-0">
                <Icon size={20} strokeWidth={2.5} />
              </div>
            )}
            <div>
              <h3 className="font-archivo font-extrabold uppercase tracking-wide text-lg text-ink">
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1 rounded-[4px] border border-transparent hover:border-ink hover:bg-cream-light text-ink transition-all"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {description && <p className="text-sm font-medium text-ink-muted mb-5 leading-relaxed">{description}</p>}

        {children && <div className="mb-5">{children}</div>}

        <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-ink/10">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>

          {onConfirm && (
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
